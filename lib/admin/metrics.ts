import { getDatabasePool } from "../db.ts";
import { dateRangeForPreset, getBusinessTimeZone } from "./date-range.ts";
import type { DateRange } from "./date-range.ts";

const PAID_STATES = ["captured", "refund_pending", "partially_refunded", "refunded"];
const MONEY_SQL = `
  COALESCE(SUM(amount_in_paise - refunded_amount_in_paise)
    FILTER (WHERE payment_status = ANY($3::text[])), 0)::text
`;

function safeInteger(value: string | number | null | undefined) {
  const result = Number(value ?? 0);
  if (!Number.isSafeInteger(result)) throw new Error("Dashboard metric exceeds safe INR bounds.");
  return result;
}

export async function getDashboardMetrics(now = new Date()) {
  const today = dateRangeForPreset("today", now);
  const last7 = dateRangeForPreset("last7", now);
  const thisMonth = dateRangeForPreset("thisMonth", now);
  const pool = getDatabasePool();

  const [todayResult, weekResult, monthResult, statesResult, productsResult, totalResult] =
    await Promise.all([
      pool.query(
        `SELECT COUNT(*)::text AS order_count,
          ${MONEY_SQL} AS paid_revenue,
          COALESCE(AVG(amount_in_paise - refunded_amount_in_paise)
            FILTER (WHERE payment_status = ANY($3::text[])), 0)::text AS average_order_value
         FROM orders
         WHERE created_at >= $1 AND created_at < $2`,
        [today.start, today.end, PAID_STATES],
      ),
      pool.query(
        `SELECT ${MONEY_SQL} AS paid_revenue FROM orders
         WHERE created_at >= $1 AND created_at < $2`,
        [last7.start, last7.end, PAID_STATES],
      ),
      pool.query(
        `SELECT ${MONEY_SQL} AS paid_revenue FROM orders
         WHERE created_at >= $1 AND created_at < $2`,
        [thisMonth.start, thisMonth.end, PAID_STATES],
      ),
      pool.query(
        `SELECT
          COUNT(*) FILTER (WHERE payment_status IN ('created', 'pending', 'authorized'))::text
            AS pending_payment_count,
          COUNT(*) FILTER (WHERE fulfillment_status IN ('new', 'preparing'))::text
            AS new_preparing_count,
          COUNT(*) FILTER (WHERE fulfillment_status IN ('ready_for_dispatch', 'out_for_delivery'))::text
            AS dispatch_count
         FROM orders`,
      ),
      pool.query(
        `SELECT order_items.product_id, order_items.product_name,
          SUM(order_items.quantity)::text AS quantity,
          SUM(order_items.line_total_in_paise)::text AS gross_sales
         FROM order_items
         JOIN orders ON orders.id = order_items.order_id
         WHERE orders.payment_status = ANY($1::text[])
         GROUP BY order_items.product_id, order_items.product_name
         ORDER BY SUM(order_items.quantity) DESC, SUM(order_items.line_total_in_paise) DESC
         LIMIT 5`,
        [PAID_STATES],
      ),
      pool.query(`SELECT COUNT(*)::text AS count FROM orders`),
    ]);

  const todayRow = todayResult.rows[0];
  const stateRow = statesResult.rows[0];
  return {
    today: {
      orderCount: safeInteger(todayRow.order_count),
      paidRevenueInPaise: safeInteger(todayRow.paid_revenue),
      averageOrderValueInPaise: safeInteger(todayRow.average_order_value),
    },
    last7DaysRevenueInPaise: safeInteger(weekResult.rows[0]?.paid_revenue),
    thisMonthRevenueInPaise: safeInteger(monthResult.rows[0]?.paid_revenue),
    pendingPaymentCount: safeInteger(stateRow?.pending_payment_count),
    newPreparingCount: safeInteger(stateRow?.new_preparing_count),
    dispatchCount: safeInteger(stateRow?.dispatch_count),
    allTimeOrderCount: safeInteger(totalResult.rows[0]?.count),
    bestSellingProducts: productsResult.rows.map((row) => ({
      productId: row.product_id as string,
      productName: row.product_name as string,
      quantity: safeInteger(row.quantity),
      grossSalesInPaise: safeInteger(row.gross_sales),
    })),
  };
}

export async function getAnalytics(
  range: DateRange,
  timeZone = getBusinessTimeZone(),
) {
  const pool = getDatabasePool();
  const [daily, weekly, monthly, payments, fulfillment, products, delivery] =
    await Promise.all([
      pool.query(
        `SELECT
          to_char(date_trunc('day', created_at AT TIME ZONE $3), 'YYYY-MM-DD') AS period,
          COUNT(*)::text AS order_count,
          COUNT(*) FILTER (WHERE payment_status = ANY($4::text[]))::text AS paid_order_count,
          COALESCE(SUM(amount_in_paise - refunded_amount_in_paise)
            FILTER (WHERE payment_status = ANY($4::text[])), 0)::text AS revenue
         FROM orders WHERE created_at >= $1 AND created_at < $2
         GROUP BY period ORDER BY period`,
        [range.start, range.end, timeZone, PAID_STATES],
      ),
      pool.query(
        `SELECT
          to_char(date_trunc('week', created_at AT TIME ZONE $3), 'YYYY-MM-DD') AS period,
          COALESCE(SUM(amount_in_paise - refunded_amount_in_paise)
            FILTER (WHERE payment_status = ANY($4::text[])), 0)::text AS revenue
         FROM orders WHERE created_at >= $1 AND created_at < $2
         GROUP BY period ORDER BY period`,
        [range.start, range.end, timeZone, PAID_STATES],
      ),
      pool.query(
        `SELECT
          to_char(date_trunc('month', created_at AT TIME ZONE $3), 'YYYY-MM') AS period,
          COALESCE(SUM(amount_in_paise - refunded_amount_in_paise)
            FILTER (WHERE payment_status = ANY($4::text[])), 0)::text AS revenue
         FROM orders WHERE created_at >= $1 AND created_at < $2
         GROUP BY period ORDER BY period`,
        [range.start, range.end, timeZone, PAID_STATES],
      ),
      pool.query(
        `SELECT payment_status AS status, COUNT(*)::text AS count
         FROM orders WHERE created_at >= $1 AND created_at < $2
         GROUP BY payment_status ORDER BY payment_status`,
        [range.start, range.end],
      ),
      pool.query(
        `SELECT fulfillment_status AS status, COUNT(*)::text AS count
         FROM orders WHERE created_at >= $1 AND created_at < $2
         GROUP BY fulfillment_status ORDER BY fulfillment_status`,
        [range.start, range.end],
      ),
      pool.query(
        `SELECT order_items.product_id, order_items.product_name,
          SUM(order_items.quantity)::text AS quantity,
          SUM(order_items.line_total_in_paise)::text AS gross_revenue
         FROM order_items JOIN orders ON orders.id = order_items.order_id
         WHERE orders.created_at >= $1 AND orders.created_at < $2
           AND orders.payment_status = ANY($3::text[])
         GROUP BY order_items.product_id, order_items.product_name
         ORDER BY SUM(order_items.quantity) DESC`,
        [range.start, range.end, PAID_STATES],
      ),
      pool.query(
        `SELECT
          COUNT(*) FILTER (WHERE fulfillment_status = 'delivered')::text
            AS completed,
          COUNT(*) FILTER (WHERE fulfillment_method = 'delivery' AND fulfillment_status IN
            ('out_for_delivery', 'delivered'))::text
            AS dispatched_or_completed
         FROM orders WHERE created_at >= $1 AND created_at < $2
           AND payment_status = ANY($3::text[])`,
        [range.start, range.end, PAID_STATES],
      ),
    ]);

  const mapSeries = (rows: Array<Record<string, unknown>>) =>
    rows.map((row) => ({
      period: row.period as string,
      revenueInPaise: safeInteger(row.revenue as string),
      ...(row.order_count !== undefined
        ? { orderCount: safeInteger(row.order_count as string) }
        : {}),
    }));
  const delivered = safeInteger(delivery.rows[0]?.completed);
  const dispatchEligible = safeInteger(delivery.rows[0]?.dispatched_or_completed);

  return {
    daily: mapSeries(daily.rows),
    weekly: mapSeries(weekly.rows),
    monthly: mapSeries(monthly.rows),
    paymentBreakdown: payments.rows.map((row) => ({
      status: row.status as string,
      count: safeInteger(row.count),
    })),
    fulfillmentBreakdown: fulfillment.rows.map((row) => ({
      status: row.status as string,
      count: safeInteger(row.count),
    })),
    bestSellingProducts: products.rows.map((row) => ({
      productId: row.product_id as string,
      productName: row.product_name as string,
      quantity: safeInteger(row.quantity),
      grossRevenueInPaise: safeInteger(row.gross_revenue),
    })),
    averageOrderValueInPaise:
      (() => {
        const totalRevenue = daily.rows.reduce(
          (sum, row) => sum + BigInt(String(row.revenue)),
          0n,
        );
        const paidOrders = daily.rows.reduce(
          (sum, row) => sum + BigInt(String(row.paid_order_count)),
          0n,
        );
        return paidOrders > 0n ? Number(totalRevenue / paidOrders) : 0;
      })(),
    deliveryCompletionPercent:
      dispatchEligible > 0 ? Math.round((delivered / dispatchEligible) * 100) : null,
    deliveryDenominator: dispatchEligible,
  };
}
