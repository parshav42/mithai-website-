const PAID_STATUSES = new Set([
  "captured",
  "refund_pending",
  "partially_refunded",
  "refunded",
]);

export type RevenueOrder = {
  amountInPaise: number;
  refundedAmountInPaise: number;
  paymentStatus: string;
  orderStatus?: string;
  fulfillmentStatus: string;
};

export function summarizeRevenue(orders: readonly RevenueOrder[]) {
  let paidGross = 0n;
  let refunds = 0n;
  let unpaid = 0n;
  let cancelledCount = 0;
  let cancelledValue = 0n;
  let paidOrderCount = 0;
  for (const order of orders) {
    const amount = BigInt(order.amountInPaise);
    const refunded = BigInt(order.refundedAmountInPaise);
    const cancelled =
      order.orderStatus === "cancelled" || order.fulfillmentStatus === "cancelled";
    if (PAID_STATUSES.has(order.paymentStatus)) {
      paidGross += amount;
      refunds += refunded;
      paidOrderCount += 1;
    } else if (!cancelled) {
      unpaid += amount;
    }
    if (cancelled) {
      cancelledCount += 1;
      cancelledValue += amount;
    }
  }
  return {
    paidGrossInPaise: paidGross,
    refundsInPaise: refunds,
    netPaidInPaise: paidGross - refunds,
    unpaidInPaise: unpaid,
    cancelledCount,
    cancelledValueInPaise: cancelledValue,
    paidOrderCount,
  };
}
