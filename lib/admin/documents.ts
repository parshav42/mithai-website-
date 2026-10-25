import { PDFDocument, PageSizes, StandardFonts, rgb } from "pdf-lib";
import type { formatBusinessDateTime } from "./date-range.ts";

type AdminDocumentOrder = {
  id: string;
  receipt: string;
  createdAt: Date;
  customerName: string;
  customerPhone: string;
  fulfillment: "delivery" | "pickup";
  deliveryAddress: string | null;
  instructions: string | null;
  amountInPaise: number;
  refundedAmountInPaise: number;
  paymentStatus: string;
  fulfillmentStatus: string;
  lines: Array<{
    productName: string;
    quantity: number;
    unitPriceInPaise: number;
  }>;
};

type DateFormatter = typeof formatBusinessDateTime;

function formatInr(amountInPaise: number) {
  if (!Number.isSafeInteger(amountInPaise) || amountInPaise < 0) {
    throw new Error("Cannot export an invalid INR amount.");
  }
  const amount = BigInt(amountInPaise);
  const rupees = new Intl.NumberFormat("en-IN").format(Number(amount / 100n));
  const paise = String(amount % 100n).padStart(2, "0");
  return `INR ${rupees}.${paise}`;
}

function csvCell(value: string | number | null) {
  let text = value === null ? "" : String(value);
  if (/^[\s]*[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function orderLinesText(order: AdminDocumentOrder) {
  return order.lines
    .map(
      (line) =>
        `${line.productName} x ${line.quantity} @ ${formatInr(line.unitPriceInPaise)}`,
    )
    .join("; ");
}

export function createOrdersCsv(
  orders: AdminDocumentOrder[],
  generatedAt: Date,
  formatDate: DateFormatter,
) {
  const paid = orders
    .filter((order) =>
      ["captured", "refund_pending", "partially_refunded", "refunded"].includes(
        order.paymentStatus,
      ),
    )
    .reduce((sum, order) => sum + order.amountInPaise, 0);
  const refunds = orders.reduce((sum, order) => sum + order.refundedAmountInPaise, 0);
  const cancelled = orders.filter((order) => order.fulfillmentStatus === "cancelled").length;
  const unpaid = orders
    .filter(
      (order) =>
        !["captured", "refund_pending", "partially_refunded", "refunded"].includes(
          order.paymentStatus,
        ) && order.fulfillmentStatus !== "cancelled",
    )
    .reduce((sum, order) => sum + order.amountInPaise, 0);

  const rows: Array<Array<string | number | null>> = [
    ["Generated at", formatDate(generatedAt)],
    ["Order count", orders.length],
    ["Paid gross", formatInr(paid)],
    ["Completed refunds", formatInr(refunds)],
    ["Net paid after refunds", formatInr(paid - refunds)],
    ["Unpaid amount (excluding cancelled orders)", formatInr(unpaid)],
    ["Cancelled order count", cancelled],
    [],
    [
      "Order ID",
      "Order reference",
      "Created at",
      "Customer name",
      "Phone",
      "Fulfillment",
      "Delivery address",
      "Instructions",
      "Products",
      "Total",
      "Refunded",
      "Payment status",
      "Fulfillment status",
    ],
    ...orders.map((order) => [
      order.id,
      order.receipt,
      formatDate(order.createdAt),
      order.customerName,
      order.customerPhone,
      order.fulfillment,
      order.deliveryAddress,
      order.instructions,
      orderLinesText(order),
      formatInr(order.amountInPaise),
      formatInr(order.refundedAmountInPaise),
      order.paymentStatus,
      order.fulfillmentStatus,
    ]),
  ];
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
}

function pdfLines(text: string, maxLength = 88) {
  const lines: string[] = [];
  for (const original of text.replace(/[^\x20-\x7E]/g, "?").split("\n")) {
    let remaining = original;
    while (remaining.length > maxLength) {
      let end = remaining.lastIndexOf(" ", maxLength);
      if (end < 1) end = maxLength;
      lines.push(remaining.slice(0, end));
      remaining = remaining.slice(end).trimStart();
    }
    lines.push(remaining);
  }
  return lines;
}

export async function createOrdersPdf(
  title: string,
  orders: AdminDocumentOrder[],
  generatedAt: Date,
  formatDate: DateFormatter,
) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage(PageSizes.A4);
  let y = page.getHeight() - 48;
  const margin = 42;
  const paidGross = orders
    .filter((order) =>
      ["captured", "refund_pending", "partially_refunded", "refunded"].includes(
        order.paymentStatus,
      ),
    )
    .reduce((sum, order) => sum + order.amountInPaise, 0);
  const refunds = orders.reduce((sum, order) => sum + order.refundedAmountInPaise, 0);
  const unpaid = orders
    .filter(
      (order) =>
        !["captured", "refund_pending", "partially_refunded", "refunded"].includes(
          order.paymentStatus,
        ) && order.fulfillmentStatus !== "cancelled",
    )
    .reduce((sum, order) => sum + order.amountInPaise, 0);
  const cancelled = orders.filter((order) => order.fulfillmentStatus === "cancelled").length;

  const draw = (text: string, options: { bold?: boolean; size?: number } = {}) => {
    for (const line of pdfLines(text)) {
      if (y < 48) {
        page = pdf.addPage(PageSizes.A4);
        y = page.getHeight() - 48;
      }
      page.drawText(line, {
        x: margin,
        y,
        size: options.size ?? 9,
        font: options.bold ? bold : regular,
        color: rgb(0.22, 0.14, 0.12),
      });
      y -= (options.size ?? 9) + 5;
    }
  };

  draw("Mithai shop admin report", { bold: true, size: 16 });
  draw(title, { bold: true, size: 12 });
  draw(`Generated at: ${formatDate(generatedAt)}`);
  draw(`Orders: ${orders.length}`);
  draw(`Paid gross: ${formatInr(paidGross)}`);
  draw(`Completed refunds: ${formatInr(refunds)}`);
  draw(`Net paid after refunds: ${formatInr(paidGross - refunds)}`);
  draw(`Unpaid amount (excluding cancelled orders): ${formatInr(unpaid)}`);
  draw(`Cancelled orders: ${cancelled}`);
  draw("");
  for (const order of orders) {
    draw(`${order.receipt} | ${formatDate(order.createdAt)} | ${formatInr(order.amountInPaise)}`, {
      bold: true,
    });
    draw(`${order.customerName} | ${order.customerPhone} | ${order.fulfillment}`);
    if (order.deliveryAddress) draw(`Delivery address: ${order.deliveryAddress}`);
    if (order.instructions) draw(`Instructions: ${order.instructions}`);
    for (const line of order.lines) {
      draw(
        `- ${line.productName} x ${line.quantity} @ ${formatInr(line.unitPriceInPaise)}`,
      );
    }
    draw(
      `Payment: ${order.paymentStatus} | Fulfillment: ${order.fulfillmentStatus} | Refunded: ${formatInr(order.refundedAmountInPaise)}`,
    );
    draw("");
  }
  return pdf.save();
}

export async function createOrderDocumentPdf(
  order: AdminDocumentOrder,
  kind: "label" | "packing-slip" | "invoice",
  formatDate: DateFormatter,
  shop?: { name: string; address: string; phone: string; email: string | null; gstin: string | null },
) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage(kind === "label" ? [288, 216] : PageSizes.A4);
  const margin = kind === "label" ? 24 : 48;
  let y = page.getHeight() - margin;
  const heading = kind === "label" ? "Delivery address" : kind === "invoice" ? "Order invoice - not a tax invoice" : "Packing slip";
  const draw = (text: string, isBold = false, size = 11) => {
    for (const line of pdfLines(text, kind === "label" ? 38 : 88)) {
      if (y < margin) return;
      page.drawText(line, {
        x: margin,
        y,
        size,
        font: isBold ? bold : regular,
        color: rgb(0.22, 0.14, 0.12),
      });
      y -= size + 8;
    }
  };
  draw(heading, true, 16);
  if (kind === "invoice" && shop) {
    draw(shop.name, true, 13);
    draw(shop.address);
    draw(`Phone: ${shop.phone}`);
    if (shop.email) draw(`Email: ${shop.email}`);
    if (shop.gstin) draw(`GSTIN: ${shop.gstin}`);
  }
  draw(`Order reference: ${order.receipt}`, true);
  draw(`Created: ${formatDate(order.createdAt)}`);
  draw(`Customer: ${order.customerName} | ${order.customerPhone}`);
  if (order.fulfillment === "delivery" && order.deliveryAddress) {
    draw(`Address: ${order.deliveryAddress}`);
  } else {
    draw("Pickup requested");
  }
  if (order.instructions) draw(`Instructions: ${order.instructions}`);
  if (kind !== "label") {
    draw("");
    for (const line of order.lines) {
      draw(`${line.productName} x ${line.quantity} @ ${formatInr(line.unitPriceInPaise)}`);
    }
    draw(`Order total: ${formatInr(order.amountInPaise)}`, true);
    draw(`Payment status: ${order.paymentStatus}`);
    draw(`Refunded to date: ${formatInr(order.refundedAmountInPaise)}`);
    if (kind === "invoice") {
      draw("");
      draw("This order summary is not a tax invoice. Tax and statutory amounts are not calculated.");
    }
  }
  return pdf.save();
}

export function getInvoiceBusinessConfiguration(environment: NodeJS.ProcessEnv = process.env) {
  const name = environment.SHOP_NAME?.trim();
  const address = environment.SHOP_ADDRESS?.trim();
  const phone = environment.SHOP_PHONE?.trim();
  if (
    environment.SHOP_INVOICE_DETAILS_CONFIRMED !== "true" ||
    !name ||
    !address ||
    !phone
  ) {
    return null;
  }
  return {
    name,
    address,
    phone,
    email: environment.SHOP_EMAIL?.trim() || null,
    gstin: environment.SHOP_GSTIN?.trim() || null,
  };
}
