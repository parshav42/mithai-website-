import type { QueryResultRow } from "pg";
import { randomUUID } from "node:crypto";
import { getDatabasePool } from "../db.ts";
import type { FulfillmentStatus, OrderStatus, PaymentStatus } from "../payments/order-model.ts";
import { appendStatusHistory, insertAudit, releaseOrderStockReservation } from "../payments/order-store.ts";
import { parseCustomDateRange } from "./date-range.ts";
import { sendConfirmationSms } from "../notifications/sms.ts";
import {
  FULFILLMENT_STATUSES,
  getPagination,
  validateFulfillmentChange,
  validateOrderChange,
  type AdminOrderStatus,
} from "./order-status.ts";

export { FULFILLMENT_STATUSES, PAYMENT_STATUSES } from "./order-status.ts";

export type AdminOrderFilters = {
  search?: string;
  from?: string;
  to?: string;
  paymentStatus?: PaymentStatus;
  fulfillmentStatus?: FulfillmentStatus;
  orderStatus?: OrderStatus;
  page?: number;
};

type OrderDbRow = QueryResultRow & {
  id: string;
  receipt: string;
  created_at: Date;
  customer_name: string;
  customer_phone: string;
  fulfillment_method: "delivery" | "pickup";
  delivery_address: string | null;
  instructions: string | null;
  amount_in_paise: string | number;
  refunded_amount_in_paise: string | number;
  payment_status: PaymentStatus;
  fulfillment_status: FulfillmentStatus;
  order_status: string;
  lines: Array<{
    productId: string;
    productName: string;
    packageSize?: string;
    quantity: number;
    unitPriceInPaise: string | number;
  }>;
};

function safeMoney(value: string | number) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error("A stored order amount is outside the safe INR range.");
  }
  return parsed;
}

function mapOrder(row: OrderDbRow) {
  return {
    id: row.id,
    receipt: row.receipt,
    createdAt: row.created_at,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    fulfillment: row.fulfillment_method,
    deliveryAddress: row.delivery_address,
    instructions: row.instructions,
    amountInPaise: safeMoney(row.amount_in_paise),
    refundedAmountInPaise: safeMoney(row.refunded_amount_in_paise),
    paymentStatus: row.payment_status,
    fulfillmentStatus: row.fulfillment_status,
    orderStatus: row.order_status,
    lines: row.lines.map((line) => ({
      ...line,
      unitPriceInPaise: safeMoney(line.unitPriceInPaise),
    })),
  };
}

const ORDER_SELECT = `
  SELECT orders.*,
    COALESCE((
      SELECT json_agg(json_build_object(
        'productId', product_id,
        'productName', product_name,
        'packageSize', package_size,
        'quantity', quantity,
        'unitPriceInPaise', unit_price_in_paise
      ) ORDER BY order_items.id)
      FROM order_items WHERE order_items.order_id = orders.id
    ), '[]'::json) AS lines
  FROM orders
`;

function addFilter(
  clauses: string[],
  values: unknown[],
  expression: string,
  value: unknown,
) {
  values.push(value);
  clauses.push(`${expression} $${values.length}`);
}

function makeFilter(filters: AdminOrderFilters) {
  const clauses: string[] = [];
  const values: unknown[] = [];
  if (filters.from && filters.to) {
    const range = parseCustomDateRange(filters.from, filters.to);
    addFilter(clauses, values, "orders.created_at >=", range.start);
    addFilter(clauses, values, "orders.created_at <", range.end);
  }
  if (filters.paymentStatus) {
    addFilter(clauses, values, "orders.payment_status =", filters.paymentStatus);
  }
  if (filters.fulfillmentStatus) {
    addFilter(clauses, values, "orders.fulfillment_status =", filters.fulfillmentStatus);
  }
  if (filters.orderStatus) {
    addFilter(clauses, values, "orders.order_status =", filters.orderStatus);
  }
  const search = filters.search?.trim().slice(0, 100);
  if (search) {
    values.push(`%${search.replace(/[\\%_]/g, "\\$&")}%`);
    clauses.push(
      `(orders.id::text ILIKE $${values.length} ESCAPE '\\' OR
        orders.receipt ILIKE $${values.length} ESCAPE '\\' OR
        orders.customer_name ILIKE $${values.length} ESCAPE '\\' OR
        orders.customer_phone ILIKE $${values.length} ESCAPE '\\')`,
    );
  }
  return {
    where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    values,
  };
}

export async function listAdminOrders(filters: AdminOrderFilters) {
  const { page, pageSize, offset } = getPagination(filters.page ?? 1);
  const { where, values } = makeFilter(filters);
  const pool = getDatabasePool();
  const count = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM orders ${where}`,
    values,
  );
  const total = Number(count.rows[0]?.count ?? 0);
  const orders = await pool.query<OrderDbRow>(
    `${ORDER_SELECT} ${where}
     ORDER BY orders.created_at DESC
     LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, pageSize, offset],
  );
  return {
    orders: orders.rows.map(mapOrder),
    page,
    pageSize,
    total,
    pages: Math.ceil(total / pageSize),
  };
}

export async function getAdminOrderDetails(orderId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return null;
  const pool = getDatabasePool();
  const result = await pool.query<OrderDbRow>(
    `${ORDER_SELECT} WHERE orders.id = $1`,
    [orderId],
  );
  const row = result.rows[0];
  if (!row) return null;

  const [history, attempts, refunds, notification] = await Promise.all([
    pool.query(
      `SELECT status_type, previous_status, next_status, actor, created_at
       FROM order_status_history WHERE order_id = $1 ORDER BY created_at DESC`,
      [orderId],
    ),
    pool.query(
      `SELECT provider, provider_order_id, provider_payment_id,
              amount_in_paise, currency, status, created_at, updated_at
       FROM payment_attempts WHERE order_id = $1 ORDER BY created_at DESC`,
      [orderId],
    ),
    pool.query(
      `SELECT provider_refund_id, amount_in_paise, status, created_at, updated_at
       FROM refunds WHERE order_id = $1 ORDER BY created_at DESC`,
      [orderId],
    ),
    pool.query(
      `SELECT status, provider, provider_reference, attempt_count, last_error, retryable, created_at, updated_at
       FROM order_notifications WHERE order_id = $1 AND notification_type = 'order_confirmed'`,
      [orderId],
    ),
  ]);

  return {
    ...mapOrder(row),
    history: history.rows.map((event) => ({
      ...event,
      createdAt: event.created_at as Date,
    })),
    paymentAttempts: attempts.rows.map((attempt) => ({
      provider: attempt.provider as string,
      providerOrderId: attempt.provider_order_id as string,
      providerPaymentId: attempt.provider_payment_id as string | null,
      amountInPaise: safeMoney(attempt.amount_in_paise as string | number),
      currency: attempt.currency as string,
      status: attempt.status as PaymentStatus,
      createdAt: attempt.created_at as Date,
      updatedAt: attempt.updated_at as Date,
    })),
    refunds: refunds.rows.map((refund) => ({
      id: refund.provider_refund_id as string,
      amountInPaise: safeMoney(refund.amount_in_paise as string | number),
      status: refund.status as string,
      createdAt: refund.created_at as Date,
      updatedAt: refund.updated_at as Date,
    })),
    confirmationNotification: notification.rows[0] ? {
      status: notification.rows[0].status as string,
      provider: notification.rows[0].provider as string,
      providerReference: notification.rows[0].provider_reference as string | null,
      attemptCount: Number(notification.rows[0].attempt_count),
      lastError: notification.rows[0].last_error as string | null,
      retryable: notification.rows[0].retryable as boolean,
      createdAt: notification.rows[0].created_at as Date,
      updatedAt: notification.rows[0].updated_at as Date,
    } : null,
  };
}

export type FulfillmentUpdateResult =
  | { success: true; status: FulfillmentStatus | AdminOrderStatus }
  | { success: false; reason: "not-found" | "invalid-transition" | "payment-not-eligible" };

export async function updateFulfillmentStatus(
  orderId: string,
  nextStatus: FulfillmentStatus,
  administrator: string,
): Promise<FulfillmentUpdateResult> {
  if (!FULFILLMENT_STATUSES.includes(nextStatus)) {
    return { success: false, reason: "invalid-transition" };
  }
  const pool = getDatabasePool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const orderResult = await client.query<{
      id: string;
      fulfillment_status: FulfillmentStatus;
      payment_status: PaymentStatus;
    }>(`SELECT id, fulfillment_status, payment_status
        FROM orders WHERE id = $1 FOR UPDATE`, [orderId]);
    const order = orderResult.rows[0];
    if (!order) {
      await client.query("ROLLBACK");
      return { success: false, reason: "not-found" };
    }
    const transition = validateFulfillmentChange(
      order.fulfillment_status,
      nextStatus,
      order.payment_status,
    );
    if (transition === "invalid-transition") {
      await client.query("ROLLBACK");
      return { success: false, reason: "invalid-transition" };
    }
    if (transition === "payment-not-eligible") {
      await client.query("ROLLBACK");
      return { success: false, reason: "payment-not-eligible" };
    }

    await client.query(
      `UPDATE orders SET fulfillment_status = $2, updated_at = NOW() WHERE id = $1`,
      [orderId, nextStatus],
    );
    await appendStatusHistory(
      client,
      orderId,
      "fulfillment",
      order.fulfillment_status,
      nextStatus,
      administrator,
    );
    await insertAudit(
      client,
      administrator,
      "fulfillment_status_updated",
      "order",
      orderId,
      { from: order.fulfillment_status, to: nextStatus },
    );
    await client.query("COMMIT");
    return { success: true, status: nextStatus };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateShopOrderStatus(
  orderId: string,
  nextStatus: AdminOrderStatus,
  administrator: string,
): Promise<FulfillmentUpdateResult> {
  if (nextStatus !== "confirmed" && nextStatus !== "cancelled") {
    return { success: false, reason: "invalid-transition" };
  }
  const client = await getDatabasePool().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{
      id: string;
      order_status: OrderStatus;
      payment_status: PaymentStatus;
    }>(
      `SELECT id, order_status, payment_status FROM orders WHERE id = $1 FOR UPDATE`,
      [orderId],
    );
    const order = result.rows[0];
    if (!order) {
      await client.query("ROLLBACK");
      return { success: false, reason: "not-found" };
    }
    const transition = validateOrderChange(
      order.order_status,
      nextStatus,
      order.payment_status,
    );
    if (transition !== "valid") {
      await client.query("ROLLBACK");
      return { success: false, reason: transition };
    }
    await client.query(
      `UPDATE orders SET order_status = $2, updated_at = NOW() WHERE id = $1`,
      [orderId, nextStatus],
    );
    await appendStatusHistory(
      client,
      orderId,
      "order",
      order.order_status,
      nextStatus,
      administrator,
    );
    await insertAudit(
      client,
      administrator,
      "shop_order_status_updated",
      "order",
      orderId,
      { from: order.order_status, to: nextStatus },
    );
    if (nextStatus === "confirmed") {
      await client.query(
        `INSERT INTO order_notifications
          (id, order_id, notification_type, recipient_phone, status, provider)
         SELECT $1, id, 'order_confirmed', customer_phone, 'pending', 'configured'
         FROM orders WHERE id = $2
         ON CONFLICT (order_id, notification_type) DO NOTHING`,
        [randomUUID(), orderId],
      );
    } else if (nextStatus === "cancelled") {
      await releaseOrderStockReservation(client, orderId);
    }
    await client.query("COMMIT");
    return { success: true, status: nextStatus };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function processConfirmationNotification(orderId: string) {
  const pool = getDatabasePool();
  const client = await pool.connect();
  let notificationId: string | null = null;
  try {
    await client.query("BEGIN");
    const result = await client.query<{
      id: string; customer_name: string; customer_phone: string; receipt: string;
      amount_in_paise: string | number;
    }>(
      `SELECT n.id, o.customer_name, n.recipient_phone AS customer_phone, o.receipt, o.amount_in_paise
       FROM order_notifications n JOIN orders o ON o.id = n.order_id
       WHERE n.order_id = $1 AND n.notification_type = 'order_confirmed'
         AND n.status = 'pending' FOR UPDATE OF n`,
      [orderId],
    );
    const row = result.rows[0];
    if (!row) {
      await client.query("COMMIT");
      return null;
    }
    notificationId = row.id;
    await client.query(
      `UPDATE order_notifications SET status = 'processing', attempt_count = attempt_count + 1,
       updated_at = NOW() WHERE id = $1`, [notificationId],
    );
    await client.query("COMMIT");
    const sendResult = await sendConfirmationSms({
      phone: row.customer_phone,
      customerName: row.customer_name,
      receipt: row.receipt,
      amountInPaise: safeMoney(row.amount_in_paise),
    });
    await pool.query(
      `UPDATE order_notifications SET status = $2, provider = $3, provider_reference = $4,
       last_error = $5, retryable = $6, updated_at = NOW() WHERE id = $1`,
      [notificationId, sendResult.accepted ? "accepted" : "failed", sendResult.provider,
        sendResult.accepted ? sendResult.reference : null,
        sendResult.accepted ? null : sendResult.error,
        sendResult.accepted ? false : sendResult.retryable],
    );
    return { status: sendResult.accepted ? "accepted" : "failed", error: sendResult.accepted ? null : sendResult.error };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (notificationId) {
      await pool.query(
        `UPDATE order_notifications SET status = 'failed', last_error = 'Notification processing failed.', updated_at = NOW() WHERE id = $1`,
        [notificationId],
      ).catch(() => undefined);
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function retryConfirmationNotification(orderId: string) {
  const result = await getDatabasePool().query(
    `UPDATE order_notifications SET status = 'pending', updated_at = NOW()
     WHERE order_id = $1 AND notification_type = 'order_confirmed'
       AND status = 'failed' AND retryable = TRUE AND attempt_count < 3
     RETURNING id`,
    [orderId],
  );
  if (result.rowCount !== 1) return null;
  return processConfirmationNotification(orderId);
}

export async function getReportOrders(from: string, to: string) {
  parseCustomDateRange(from, to);
  return getFilteredAdminOrders({ from, to });
}

export async function getFilteredAdminOrders(filters: AdminOrderFilters) {
  const { where, values } = makeFilter(filters);
  const result = await getDatabasePool().query<OrderDbRow>(
    `${ORDER_SELECT} ${where}
     ORDER BY orders.created_at ASC
     LIMIT 5001`,
    values,
  );
  if (result.rows.length > 5000) {
    throw new Error("The selected report contains more than 5,000 orders. Narrow the range.");
  }
  return result.rows.map(mapOrder);
}

export async function getPaymentOverview() {
  const pool = getDatabasePool();
  const [breakdown, recent] = await Promise.all([
    pool.query(
      `SELECT payment_status AS status, COUNT(*)::text AS count,
        COALESCE(SUM(amount_in_paise), 0)::text AS order_value,
        COALESCE(SUM(refunded_amount_in_paise), 0)::text AS refunded
       FROM orders GROUP BY payment_status ORDER BY payment_status`,
    ),
    pool.query(
      `SELECT orders.id, orders.receipt, orders.created_at, orders.customer_name,
         orders.amount_in_paise, orders.refunded_amount_in_paise,
         orders.payment_status, payment_attempts.provider_payment_id
       FROM orders
       LEFT JOIN payment_attempts ON payment_attempts.id = (
         SELECT id FROM payment_attempts recent_attempt
         WHERE recent_attempt.order_id = orders.id
         ORDER BY recent_attempt.created_at DESC LIMIT 1
       )
       ORDER BY orders.created_at DESC LIMIT 100`,
    ),
  ]);
  return {
    breakdown: breakdown.rows.map((row) => ({
      status: row.status as PaymentStatus,
      count: safeMoney(row.count as string),
      orderValueInPaise: safeMoney(row.order_value as string),
      refundedInPaise: safeMoney(row.refunded as string),
    })),
    recent: recent.rows.map((row) => ({
      id: row.id as string,
      receipt: row.receipt as string,
      createdAt: row.created_at as Date,
      customerName: row.customer_name as string,
      amountInPaise: safeMoney(row.amount_in_paise as string | number),
      refundedAmountInPaise: safeMoney(row.refunded_amount_in_paise as string | number),
      paymentStatus: row.payment_status as PaymentStatus,
      providerPaymentId: row.provider_payment_id as string | null,
    })),
  };
}
