import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient, QueryResultRow } from "pg";
import { getDatabasePool, isDatabaseConfigured } from "../db.ts";
import type {
  FulfillmentStatus,
  NewPaymentOrder,
  OrderStatus,
  PaymentOrderLine,
  PaymentOrderStore,
  PaymentStatus,
  PersistedPaymentOrder,
  ProcessProviderEventResult,
  VerifiedProviderEvent,
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
};

type ItemRow = QueryResultRow & {
  product_id: string;
  product_name: string;
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
    `SELECT product_id, product_name, quantity, unit_price_in_paise
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
      const result = await client.query<OrderRow>(
        `INSERT INTO orders (
           id, receipt, customer_name, customer_phone, fulfillment_method,
           delivery_address, instructions, amount_in_paise, currency,
           order_status, payment_status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
        ],
      );
      for (const line of input.lines) {
        await client.query(
          `INSERT INTO order_items (
             order_id, product_id, product_name, quantity,
             unit_price_in_paise, line_total_in_paise
           ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            id,
            line.productId,
            line.productName,
            line.quantity,
            line.unitPriceInPaise,
            line.unitPriceInPaise * line.quantity,
          ],
        );
      }
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
      const next = transitionPaymentState(paymentTransitionInput(order), paymentStatus);
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
        order.payment_status,
        next.paymentStatus,
        "razorpay_signature_verification",
      );
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
        const next = transitionPaymentState(paymentTransitionInput(order), event.paymentStatus);
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
          order.payment_status,
          next.paymentStatus,
          "razorpay_webhook",
        );
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

export function getPaymentOrderStore(): PaymentOrderStore | null {
  return isDatabaseConfigured() ? store : null;
}

export { appendStatusHistory, insertAudit, findOrder, findItems, toOrder };
export type { OrderRow, ItemRow };
