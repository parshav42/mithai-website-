import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient, QueryResultRow } from "pg";
import { getDatabasePool, isDatabaseConfigured } from "../db.ts";
import {
  InventoryConflictError,
  type FulfillmentStatus,
  type NewPaymentOrder,
  type OrderStatus,
  type PaymentOrderLine,
  type PaymentOrderStore,
  type PaymentStatus,
  type PersistedPaymentOrder,
  type ProcessProviderEventResult,
  type VerifiedProviderEvent,
} from "./order-model.ts";
import { transitionPaymentState } from "./payment-state.ts";

type OrderRow = QueryResultRow & {
  id: string;
  receipt: string;
  provider_order_id: string | null;
  provider_payment_id: string | null;
  customer_name: string;
  customer_phone: string;
  fulfillment_method: "delivery" | "pickup";
  delivery_address: string | null;
  instructions: string | null;
  amount_in_paise: string | number;
  refunded_amount_in_paise: string | number;
  currency: "INR";
  order_status: OrderStatus;
  fulfillment_status: FulfillmentStatus;
  payment_status: PaymentStatus;
  created_at: Date;
  updated_at: Date;
  idempotency_key: string | null;
};

type ItemRow = QueryResultRow & {
  product_id: string;
  product_name: string;
  package_size: string;
  quantity: number;
  unit_price_in_paise: string | number;
};

function safeMoney(value: string | number) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error("Stored monetary amount is outside the safe INR range.");
  }
  return parsed;
}

function toOrder(row: OrderRow, itemRows: ItemRow[]): PersistedPaymentOrder {
  return {
    id: row.id,
    receipt: row.receipt,
    providerOrderId: row.provider_order_id,
    providerPaymentId: row.provider_payment_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    fulfillment: row.fulfillment_method,
    deliveryAddress: row.delivery_address,
    instructions: row.instructions,
    lines: itemRows.map((item): PaymentOrderLine => ({
      productId: item.product_id,
      productName: item.product_name,
      packageSize: item.package_size,
      quantity: item.quantity,
      unitPriceInPaise: safeMoney(item.unit_price_in_paise),
    })),
    amountInPaise: safeMoney(row.amount_in_paise),
    refundedAmountInPaise: safeMoney(row.refunded_amount_in_paise),
    currency: row.currency,
    orderStatus: row.order_status,
    fulfillmentStatus: row.fulfillment_status,
    paymentStatus: row.payment_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function paymentTransitionInput(row: OrderRow) {
  return {
    orderStatus: row.order_status,
    paymentStatus: row.payment_status,
  };
}

async function appendStatusHistory(
  client: PoolClient,
  orderId: string,
  statusType: "payment" | "fulfillment" | "order",
  previousStatus: string | null,
  nextStatus: string,
  actor: string,
) {
  if (previousStatus === nextStatus) return;
  await client.query(
    `INSERT INTO order_status_history
      (order_id, status_type, previous_status, next_status, actor)
     VALUES ($1, $2, $3, $4, $5)`,
    [orderId, statusType, previousStatus, nextStatus, actor],
  );
}

async function insertAudit(
  client: PoolClient,
  actor: string,
  action: string,
  resourceType: string,
  resourceId: string,
  details: Record<string, string>,
) {
  await client.query(
    `INSERT INTO admin_audit_events
      (administrator, action, resource_type, resource_id, details)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [actor, action, resourceType, resourceId, JSON.stringify(details)],
  );
}

async function findItems(client: PoolClient, orderId: string) {
  const result = await client.query<ItemRow>(
    `SELECT product_id, product_name, package_size, quantity, unit_price_in_paise
     FROM order_items WHERE order_id = $1 ORDER BY id`,
    [orderId],
  );
  return result.rows;
}

async function findOrder(client: PoolClient, orderId: string, lock = false) {
  const result = await client.query<OrderRow>(
    `SELECT * FROM orders WHERE id = $1${lock ? " FOR UPDATE" : ""}`,
    [orderId],
  );
  return result.rows[0] ?? null;
}

async function reserveInventory(
  client: PoolClient,
  orderId: string,
  lines: PaymentOrderLine[],
) {
  const result = await client.query<{
    id: string;
    name: string;
    package_size: string;
    price_in_paise: string | number;
    stock_quantity: number;
    reserved_quantity: string;
    is_available: boolean;
    archived_at: Date | null;
  }>(
    `SELECT p.id, p.name, p.package_size, p.price_in_paise, p.stock_quantity,
       p.is_available, p.archived_at,
       COALESCE((
         SELECT SUM(oi.quantity) FROM stock_reservations sr
         JOIN order_items oi ON oi.order_id = sr.order_id
         WHERE sr.status = 'reserved' AND sr.reserved_until > NOW()
           AND oi.product_id = p.id::text
       ), 0)::text AS reserved_quantity
     FROM products p
     WHERE p.id = ANY($1::uuid[])
     ORDER BY p.id
     FOR UPDATE OF p`,
    [lines.map((line) => line.productId)],
  );
  if (result.rowCount !== lines.length) {
    throw new InventoryConflictError("A product is no longer available. Refresh your cart and try again.");
  }

  for (const line of lines) {
    const product = result.rows.find((row) => row.id === line.productId);
    if (
      !product ||
      product.archived_at !== null ||
      !product.is_available ||
      product.name !== line.productName ||
      product.package_size !== line.packageSize ||
      safeMoney(product.price_in_paise) !== line.unitPriceInPaise
    ) {
      throw new InventoryConflictError("A product changed during checkout. Refresh your cart and try again.");
    }
    const available = product.stock_quantity - Number(product.reserved_quantity);
    if (!Number.isInteger(available) || line.quantity > available) {
      throw new InventoryConflictError(`${line.productName} no longer has enough stock.`);
    }
  }

  await client.query(
    `INSERT INTO stock_reservations (order_id, status, reserved_until)
     VALUES ($1, 'reserved', NOW() + INTERVAL '15 minutes')`,
    [orderId],
  );
}

async function releaseReservation(
  client: PoolClient,
  orderId: string,
  onlyExpired = false,
) {
  const result = await client.query(
    `UPDATE stock_reservations SET status = 'released', updated_at = NOW()
     WHERE order_id = $1 AND status = 'reserved'
       ${onlyExpired ? "AND reserved_until <= NOW()" : ""}
     RETURNING order_id`,
    [orderId],
  );
  return result.rowCount === 1;
}

async function consumeReservation(client: PoolClient, orderId: string) {
  const reservation = await client.query<{ status: string; reserved_until: Date }>(
    `SELECT status, reserved_until FROM stock_reservations
     WHERE order_id = $1 FOR UPDATE`,
    [orderId],
  );
  const row = reservation.rows[0];
  if (!row || row.status !== "reserved") return "none" as const;
  if (row.reserved_until <= new Date()) {
    await releaseReservation(client, orderId);
    return "expired" as const;
  }

  const items = await findItems(client, orderId);
  for (const item of items) {
    const update = await client.query(
      `UPDATE products SET stock_quantity = stock_quantity - $2, updated_at = NOW()
       WHERE id::text = $1 AND stock_quantity >= $2`,
      [item.product_id, item.quantity],
    );
    if (update.rowCount !== 1) {
      throw new InventoryConflictError("Reserved inventory could not be fulfilled.");
    }
  }
  await client.query(
    `UPDATE stock_reservations SET status = 'consumed', updated_at = NOW()
     WHERE order_id = $1`,
    [orderId],
  );
  return "consumed" as const;
}

async function expireReservations(client: PoolClient) {
  const expired = await client.query<{ order_id: string }>(
    `SELECT order_id FROM stock_reservations
     WHERE status = 'reserved' AND reserved_until <= NOW()
     ORDER BY reserved_until LIMIT 500`,
  );
  for (const { order_id: orderId } of expired.rows) {
    const order = await findOrder(client, orderId, true);
    if (!(await releaseReservation(client, orderId, true))) continue;
    if (
      order &&
      order.order_status === "awaiting_payment" &&
      ["created", "pending", "authorized"].includes(order.payment_status)
    ) {
      await client.query(
        `UPDATE orders SET order_status = 'cancelled', payment_status = 'cancelled',
         updated_at = NOW() WHERE id = $1`,
        [orderId],
      );
      await client.query(
        `UPDATE payment_attempts SET status = 'cancelled', updated_at = NOW()
         WHERE order_id = $1 AND status IN ('created', 'pending', 'authorized')`,
        [orderId],
      );
      await appendStatusHistory(client, orderId, "order", order.order_status, "cancelled", "stock_reservation_expiry");
      await appendStatusHistory(client, orderId, "payment", order.payment_status, "cancelled", "stock_reservation_expiry");
    }
  }
  return expired.rowCount ?? 0;
}

class PostgresPaymentOrderStore implements PaymentOrderStore {
  async createPendingOrder(input: NewPaymentOrder) {
    const expectedAmount = input.lines.reduce(
      (sum, line) => sum + BigInt(line.unitPriceInPaise) * BigInt(line.quantity),
      0n,
    );
    if (
      expectedAmount !== BigInt(input.amountInPaise) ||
      input.lines.length === 0 ||
      !Number.isSafeInteger(input.amountInPaise)
    ) {
      throw new Error("Payment order total does not match its trusted line items.");
    }

    const client = await getDatabasePool().connect();
    const id = randomUUID();
    try {
      await client.query("BEGIN");
      await expireReservations(client);
      const result = await client.query<OrderRow>(
        `INSERT INTO orders (
           id, receipt, customer_name, customer_phone, fulfillment_method,
           delivery_address, instructions, amount_in_paise, currency,
           order_status, payment_status, idempotency_key
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
         RETURNING *`,
        [
          id,
          input.receipt,
          input.customerName,
          input.customerPhone,
          input.fulfillment,
          input.deliveryAddress,
          input.instructions,
          input.amountInPaise,
          input.currency,
          input.orderStatus,
          input.paymentStatus,
          input.idempotencyKey,
        ],
      );
      if (result.rowCount === 0) {
        const existingResult = await client.query<OrderRow>(
          `SELECT * FROM orders WHERE idempotency_key = $1 FOR UPDATE`,
          [input.idempotencyKey],
        );
        const existing = existingResult.rows[0];
        if (!existing) throw new Error("Idempotent checkout order could not be loaded.");
        const existingItems = await findItems(client, existing.id);
        const sameRequest = existing.customer_name === input.customerName &&
          existing.customer_phone === input.customerPhone &&
          existing.fulfillment_method === input.fulfillment &&
          existing.delivery_address === input.deliveryAddress &&
          existing.instructions === input.instructions &&
          safeMoney(existing.amount_in_paise) === input.amountInPaise &&
          existingItems.length === input.lines.length &&
          existingItems.every((item, index) => item.product_id === input.lines[index]?.productId &&
            item.quantity === input.lines[index]?.quantity &&
            item.package_size === input.lines[index]?.packageSize &&
            safeMoney(item.unit_price_in_paise) === input.lines[index]?.unitPriceInPaise);
        if (!sameRequest) throw new Error("Checkout key was already used for different order details.");
        if (
          existing.order_status !== "awaiting_payment" ||
          !["created", "pending", "authorized"].includes(existing.payment_status)
        ) {
          throw new InventoryConflictError("This checkout reservation has expired. Start checkout again.");
        }
        await client.query("COMMIT");
        return toOrder(existing, existingItems);
      }
      for (const line of input.lines) {
        await client.query(
          `INSERT INTO order_items (
             order_id, product_id, product_name, package_size, quantity,
             unit_price_in_paise, line_total_in_paise
           ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            id,
            line.productId,
            line.productName,
            line.packageSize,
            line.quantity,
            line.unitPriceInPaise,
            Number(BigInt(line.unitPriceInPaise) * BigInt(line.quantity)),
          ],
        );
      }
      await reserveInventory(client, id, input.lines);
      await appendStatusHistory(
        client,
        id,
        "payment",
        null,
        input.paymentStatus,
        "system",
      );
      await client.query("COMMIT");
      return {
        ...toOrder(result.rows[0], []),
        lines: input.lines.map((line) => ({ ...line })),
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async attachProviderOrder(orderId: string, providerOrderId: string) {
    const client = await getDatabasePool().connect();
    try {
      await client.query("BEGIN");
      const order = await findOrder(client, orderId, true);
      if (!order || order.provider_order_id) {
        throw new Error("Payment order is missing or already has a provider order.");
      }
      if (safeMoney(order.amount_in_paise) <= 0) {
        throw new Error("Stored payment amount is invalid.");
      }
      const now = new Date();
      await client.query(
        `UPDATE orders SET provider_order_id = $2, updated_at = $3 WHERE id = $1`,
        [orderId, providerOrderId, now],
      );
      await client.query(
        `INSERT INTO payment_attempts
          (id, order_id, provider, provider_order_id, amount_in_paise, currency, status)
         VALUES ($1, $2, 'razorpay', $3, $4, 'INR', 'created')`,
        [randomUUID(), orderId, providerOrderId, order.amount_in_paise],
      );
      await insertAudit(client, "system", "payment_order_created", "order", orderId, {
        providerOrderId,
      });
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async markProviderOrderCreationFailed(orderId: string) {
    const client = await getDatabasePool().connect();
    try {
      await client.query("BEGIN");
      const order = await findOrder(client, orderId, true);
      if (!order) {
        await client.query("COMMIT");
        return;
      }
      const next = transitionPaymentState(paymentTransitionInput(order), "failed");
      await client.query(
        `UPDATE orders SET payment_status = $2, order_status = $3, updated_at = NOW()
         WHERE id = $1`,
        [orderId, next.paymentStatus, next.orderStatus],
      );
      await client.query(
        `UPDATE payment_attempts SET status = 'failed', updated_at = NOW()
         WHERE order_id = $1 AND status = 'created'`,
        [orderId],
      );
      await releaseReservation(client, orderId);
      await appendStatusHistory(
        client,
        orderId,
        "payment",
        order.payment_status,
        next.paymentStatus,
        "system",
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async findByProviderOrderId(providerOrderId: string) {
    const client = await getDatabasePool().connect();
    try {
      const result = await client.query<OrderRow>(
        `SELECT * FROM orders WHERE provider_order_id = $1`,
        [providerOrderId],
      );
      const order = result.rows[0];
      return order ? toOrder(order, await findItems(client, order.id)) : null;
    } finally {
      client.release();
    }
  }

  async recordVerifiedPayment(
    orderId: string,
    providerPaymentId: string,
    paymentStatus: PaymentStatus,
  ) {
    const client = await getDatabasePool().connect();
    try {
      await client.query("BEGIN");
      const order = await findOrder(client, orderId, true);
      if (!order || !order.provider_order_id) {
        throw new Error("Verified payment has no matching saved provider order.");
      }
      let transitionOrder = order;
      if (paymentStatus === "captured") {
        if ((await consumeReservation(client, orderId)) === "expired") {
          transitionOrder = {
            ...order,
            order_status: "cancelled",
            payment_status: "cancelled",
          };
        }
      } else if (paymentStatus === "failed" || paymentStatus === "cancelled") {
        await releaseReservation(client, orderId);
      }
      const next = transitionPaymentState(paymentTransitionInput(transitionOrder), paymentStatus);
      const attempt = await client.query(
        `INSERT INTO payment_attempts (
           id, order_id, provider, provider_order_id, provider_payment_id,
           amount_in_paise, currency, status
         ) VALUES ($1, $2, 'razorpay', $3, $4, $5, $6, $7)
         ON CONFLICT (provider_payment_id) DO UPDATE
           SET status = EXCLUDED.status, updated_at = NOW()
           WHERE payment_attempts.order_id = EXCLUDED.order_id
             AND payment_attempts.provider_order_id = EXCLUDED.provider_order_id
         RETURNING id`,
        [
          randomUUID(),
          orderId,
          order.provider_order_id,
          providerPaymentId,
          order.amount_in_paise,
          order.currency,
          next.paymentStatus,
        ],
      );
      if (attempt.rowCount !== 1) {
        throw new Error("Payment reference is already associated with another order.");
      }
      await client.query(
        `UPDATE orders
         SET provider_payment_id = $2, payment_status = $3, order_status = $4, updated_at = NOW()
         WHERE id = $1`,
        [orderId, providerPaymentId, next.paymentStatus, next.orderStatus],
      );
      await appendStatusHistory(
        client,
        orderId,
        "payment",
        transitionOrder.payment_status,
        next.paymentStatus,
        "razorpay_signature_verification",
      );
      if (transitionOrder.order_status !== order.order_status) {
        await appendStatusHistory(
          client,
          orderId,
          "order",
          order.order_status,
          transitionOrder.order_status,
          "stock_reservation_expiry",
        );
      }
      await insertAudit(
        client,
        "system",
        "payment_signature_verified",
        "order",
        orderId,
        { paymentStatus: next.paymentStatus },
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async processProviderEvent(
    event: VerifiedProviderEvent,
  ): Promise<ProcessProviderEventResult> {
    const client = await getDatabasePool().connect();
    try {
      await client.query("BEGIN");
      const priorEvent = await client.query(
        `SELECT 1 FROM payment_events WHERE provider_event_id = $1`,
        [event.providerEventId],
      );
      if (priorEvent.rowCount) {
        await client.query("COMMIT");
        return "duplicate";
      }

      const orderResult =
        event.eventType === "payment"
          ? await client.query<OrderRow>(
              `SELECT * FROM orders WHERE provider_order_id = $1 FOR UPDATE`,
              [event.providerOrderId],
            )
          : await client.query<OrderRow>(
              `SELECT orders.* FROM orders
               JOIN payment_attempts ON payment_attempts.order_id = orders.id
               WHERE payment_attempts.provider_payment_id = $1
               FOR UPDATE OF orders`,
              [event.providerPaymentId],
            );
      const order = orderResult.rows[0];
      if (!order) {
        await client.query("ROLLBACK");
        return "order-not-found";
      }

      if (event.eventType === "payment") {
        if (event.amountInPaise !== safeMoney(order.amount_in_paise)) {
          await client.query("ROLLBACK");
          return "amount-mismatch";
        }
      } else if (
        !event.providerRefundId ||
        !Number.isSafeInteger(event.refundAmountInPaise) ||
        (event.refundAmountInPaise ?? 0) <= 0 ||
        event.refundAmountInPaise! > safeMoney(order.amount_in_paise)
      ) {
        await client.query("ROLLBACK");
        return "amount-mismatch";
      }

      const eventInsert = await client.query(
        `INSERT INTO payment_events (
           provider_event_id, event_type, provider_order_id, provider_payment_id
         ) VALUES ($1, $2, $3, $4)
         ON CONFLICT (provider_event_id) DO NOTHING
         RETURNING provider_event_id`,
        [
          event.providerEventId,
          event.eventType,
          order.provider_order_id,
          event.providerPaymentId,
        ],
      );
      if (eventInsert.rowCount !== 1) {
        await client.query("COMMIT");
        return "duplicate";
      }

      if (event.eventType === "refund") {
        const payment = await client.query(
          `SELECT amount_in_paise FROM payment_attempts
           WHERE provider_payment_id = $1 AND order_id = $2 FOR UPDATE`,
          [event.providerPaymentId, order.id],
        );
        if (payment.rowCount !== 1) {
          await client.query("ROLLBACK");
          return "order-not-found";
        }
        const refund = await client.query(
          `INSERT INTO refunds (
             provider_refund_id, order_id, provider_payment_id, amount_in_paise, status
           ) VALUES ($1, $2, $3, $4, 'pending')
           ON CONFLICT (provider_refund_id) DO UPDATE
             SET status = CASE
               WHEN refunds.status = 'processed' THEN 'processed'
               WHEN EXCLUDED.status = 'processed' THEN 'processed'
               WHEN refunds.status = 'failed' AND EXCLUDED.status = 'pending' THEN 'failed'
               ELSE EXCLUDED.status
             END,
             updated_at = NOW()
             WHERE refunds.order_id = EXCLUDED.order_id
               AND refunds.provider_payment_id = EXCLUDED.provider_payment_id
               AND refunds.amount_in_paise = EXCLUDED.amount_in_paise
           RETURNING provider_refund_id`,
          [
            event.providerRefundId,
            order.id,
            event.providerPaymentId,
            event.refundAmountInPaise,
          ],
        );
        if (refund.rowCount !== 1) {
          await client.query("ROLLBACK");
          return "amount-mismatch";
        }
        await client.query(
          `UPDATE refunds SET status = $2, updated_at = NOW()
           WHERE provider_refund_id = $1`,
          [event.providerRefundId, event.refundStatus ?? "pending"],
        );
        const refundTotals = await client.query<{
          refunded: string;
          pending_count: string;
        }>(
          `SELECT
             COALESCE(SUM(amount_in_paise) FILTER (WHERE status = 'processed'), 0)::text AS refunded,
             COUNT(*) FILTER (WHERE status = 'pending')::text AS pending_count
           FROM refunds WHERE order_id = $1`,
          [order.id],
        );
        const refunded = safeMoney(refundTotals.rows[0].refunded);
        if (refunded > safeMoney(order.amount_in_paise)) {
          await client.query("ROLLBACK");
          return "amount-mismatch";
        }
        const paymentStatus: PaymentStatus =
          Number(refundTotals.rows[0].pending_count) > 0
            ? "refund_pending"
            : refunded >= safeMoney(order.amount_in_paise)
              ? "refunded"
              : refunded > 0
                ? "partially_refunded"
                : "captured";
        await client.query(
          `UPDATE orders
           SET refunded_amount_in_paise = $2, payment_status = $3, updated_at = NOW()
           WHERE id = $1`,
          [order.id, refunded, paymentStatus],
        );
        await client.query(
          `UPDATE payment_attempts
           SET status = $2, updated_at = NOW()
           WHERE provider_payment_id = $1`,
          [event.providerPaymentId, paymentStatus],
        );
        await appendStatusHistory(
          client,
          order.id,
          "payment",
          order.payment_status,
          paymentStatus,
          "razorpay_webhook",
        );
      } else {
        let transitionOrder = order;
        if (event.paymentStatus === "captured") {
          if ((await consumeReservation(client, order.id)) === "expired") {
            transitionOrder = {
              ...order,
              order_status: "cancelled",
              payment_status: "cancelled",
            };
          }
        } else if (event.paymentStatus === "failed" || event.paymentStatus === "cancelled") {
          await releaseReservation(client, order.id);
        }
        const next = transitionPaymentState(paymentTransitionInput(transitionOrder), event.paymentStatus);
        const attempt = await client.query(
          `INSERT INTO payment_attempts (
             id, order_id, provider, provider_order_id, provider_payment_id,
             amount_in_paise, currency, status
           ) VALUES ($1, $2, 'razorpay', $3, $4, $5, $6, $7)
           ON CONFLICT (provider_payment_id) DO UPDATE
             SET status = EXCLUDED.status, updated_at = NOW()
             WHERE payment_attempts.order_id = EXCLUDED.order_id
               AND payment_attempts.provider_order_id = EXCLUDED.provider_order_id
           RETURNING id`,
          [
            randomUUID(),
            order.id,
            event.providerOrderId,
            event.providerPaymentId,
            order.amount_in_paise,
            order.currency,
            next.paymentStatus,
          ],
        );
        if (attempt.rowCount !== 1) {
          await client.query("ROLLBACK");
          return "amount-mismatch";
        }
        await client.query(
          `UPDATE orders
           SET provider_payment_id = $2, payment_status = $3, order_status = $4, updated_at = NOW()
           WHERE id = $1`,
          [order.id, event.providerPaymentId, next.paymentStatus, next.orderStatus],
        );
        await appendStatusHistory(
          client,
          order.id,
          "payment",
          transitionOrder.payment_status,
          next.paymentStatus,
          "razorpay_webhook",
        );
        if (transitionOrder.order_status !== order.order_status) {
          await appendStatusHistory(
            client,
            order.id,
            "order",
            order.order_status,
            transitionOrder.order_status,
            "stock_reservation_expiry",
          );
        }
      }

      await client.query("COMMIT");
      return "applied";
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

const store = new PostgresPaymentOrderStore();

export async function releaseExpiredStockReservations() {
  const client = await getDatabasePool().connect();
  try {
    await client.query("BEGIN");
    const released = await expireReservations(client);
    await client.query("COMMIT");
    return released;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function releaseOrderStockReservation(
  client: PoolClient,
  orderId: string,
) {
  return releaseReservation(client, orderId);
}

export function getPaymentOrderStore(): PaymentOrderStore | null {
  return isDatabaseConfigured() ? store : null;
}

export { appendStatusHistory, insertAudit, findOrder, findItems, toOrder };
export type { OrderRow, ItemRow };
