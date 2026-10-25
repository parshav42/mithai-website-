import assert from "node:assert/strict";
import { randomBytes, scryptSync } from "node:crypto";
import test from "node:test";
import {
  businessDateString,
  dateRangeForPreset,
  formatBusinessDateTime,
  InvalidDateRangeError,
  parseCustomDateRange,
} from "../lib/admin/date-range.ts";
import {
  createOrdersCsv,
  createOrdersPdf,
  getInvoiceBusinessConfiguration,
} from "../lib/admin/documents.ts";
import { getPagination, validateFulfillmentChange } from "../lib/admin/order-status.ts";
import { parseAdminOrderFilters } from "../lib/admin/query.ts";
import { summarizeRevenue } from "../lib/admin/revenue.ts";
import { isAdministratorRole } from "../lib/admin/role.ts";
import { isAdministratorConfigured, verifyAdminPassword } from "../lib/admin/password.ts";

function makePasswordHash(password: string) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64, {
    N: 32_768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

const order = {
  id: "00000000-0000-4000-8000-000000000001",
  receipt: "mithai_receipt_1",
  createdAt: new Date("2026-10-25T08:30:00Z"),
  customerName: "=cmd|customer",
  customerPhone: "+919876543210",
  fulfillment: "delivery" as const,
  deliveryAddress: "12 Sample Road, Jaipur",
  instructions: "Call at arrival",
  amountInPaise: 25_100,
  refundedAmountInPaise: 5_000,
  paymentStatus: "partially_refunded",
  orderStatus: "confirmed",
  fulfillmentStatus: "out_for_delivery",
  lines: [{ productName: "Kaju Katli", quantity: 2, unitPriceInPaise: 12_550 }],
};

test("administrator permissions require the explicit admin role", () => {
  assert.equal(isAdministratorRole("admin"), true);
  assert.equal(isAdministratorRole("customer"), false);
  assert.equal(isAdministratorRole(undefined), false);
});

test("administrator configuration rejects missing or malformed credentials", () => {
  const hash = makePasswordHash("long-secret-password");
  assert.equal(
    isAdministratorConfigured({
      AUTH_SECRET: "s".repeat(32),
      ADMIN_EMAIL: "owner@example.com",
      ADMIN_PASSWORD_HASH: hash,
    }),
    true,
  );
  assert.equal(
    isAdministratorConfigured({
      AUTH_SECRET: "short",
      ADMIN_EMAIL: "owner@example.com",
      ADMIN_PASSWORD_HASH: hash,
    }),
    false,
  );
  assert.equal(
    isAdministratorConfigured({
      AUTH_SECRET: "s".repeat(32),
      ADMIN_EMAIL: "owner@example.com",
      ADMIN_PASSWORD_HASH: "plaintext",
    }),
    false,
  );
});

test("scrypt password validation accepts only the matching administrator password", async () => {
  const hash = makePasswordHash("long-secret-password");
  assert.equal(await verifyAdminPassword("long-secret-password", hash), true);
  assert.equal(await verifyAdminPassword("wrong-password", hash), false);
  assert.equal(await verifyAdminPassword("long-secret-password", "invalid"), false);
});

test("order filters validate statuses, date boundaries, and normalize pagination", () => {
  const parsed = parseAdminOrderFilters(
    new URLSearchParams("search=owner&paymentStatus=captured&fulfillmentStatus=preparing&page=3"),
  );
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.filters.search, "owner");
    assert.equal(parsed.filters.paymentStatus, "captured");
    assert.equal(parsed.filters.page, 3);
  }
  assert.equal(
    parseAdminOrderFilters(new URLSearchParams("paymentStatus=made-up")).success,
    false,
  );
  assert.equal(
    parseAdminOrderFilters(new URLSearchParams("from=2026-10-25")).success,
    false,
  );
  assert.deepEqual(getPagination(3), { page: 3, pageSize: 20, offset: 40 });
  assert.deepEqual(getPagination(-1), { page: 1, pageSize: 20, offset: 0 });
});

test("date boundaries use the configured business time zone and reject invalid ranges", () => {
  const range = parseCustomDateRange("2026-10-25", "2026-10-25", "Asia/Kolkata");
  assert.equal(range.start.toISOString(), "2026-10-24T18:30:00.000Z");
  assert.equal(range.end.toISOString(), "2026-10-25T18:30:00.000Z");
  assert.throws(
    () => parseCustomDateRange("2026-02-30", "2026-03-01", "Asia/Kolkata"),
    InvalidDateRangeError,
  );
  assert.throws(
    () => parseCustomDateRange("2026-10-26", "2026-10-25", "Asia/Kolkata"),
    InvalidDateRangeError,
  );
  const today = dateRangeForPreset("today", new Date("2026-10-25T08:00:00Z"));
  assert.equal(businessDateString(today.start), "2026-10-25");
  assert.match(formatBusinessDateTime(today.start), /25/);
});

test("paid revenue excludes pending/failed orders and reports refunds and cancellations separately", () => {
  const result = summarizeRevenue([
    {
      amountInPaise: 25_100,
      refundedAmountInPaise: 5_000,
      paymentStatus: "partially_refunded",
      orderStatus: "confirmed",
      fulfillmentStatus: "out_for_delivery",
    },
    {
      amountInPaise: 10_000,
      refundedAmountInPaise: 10_000,
      paymentStatus: "refunded",
      orderStatus: "cancelled",
      fulfillmentStatus: "cancelled",
    },
    {
      amountInPaise: 12_000,
      refundedAmountInPaise: 0,
      paymentStatus: "failed",
      orderStatus: "cancelled",
      fulfillmentStatus: "cancelled",
    },
    {
      amountInPaise: 7_000,
      refundedAmountInPaise: 0,
      paymentStatus: "pending",
      orderStatus: "awaiting_payment",
      fulfillmentStatus: "new",
    },
  ]);
  assert.equal(result.paidGrossInPaise, 35_100n);
  assert.equal(result.refundsInPaise, 15_000n);
  assert.equal(result.netPaidInPaise, 20_100n);
  assert.equal(result.unpaidInPaise, 7_000n);
  assert.equal(result.cancelledCount, 2);
  assert.equal(result.cancelledValueInPaise, 22_000n);
  assert.equal(result.paidOrderCount, 2);
});

test("fulfillment transitions are validated independently of payment", () => {
  assert.equal(validateFulfillmentChange("new", "preparing", "captured"), "valid");
  assert.equal(
    validateFulfillmentChange("new", "preparing", "pending"),
    "payment-not-eligible",
  );
  assert.equal(
    validateFulfillmentChange("delivered", "preparing", "captured"),
    "invalid-transition",
  );
});

test("CSV exports escape spreadsheet formulas and PDF generation returns a document", async () => {
  const csv = createOrdersCsv([order], new Date("2026-10-25T10:00:00Z"), formatBusinessDateTime);
  assert.match(csv, /Paid gross/);
  assert.match(csv, /'=cmd\|customer/);
  assert.match(csv, /Net paid after refunds/);
  const pdf = await createOrdersPdf(
    "Daily report",
    [order],
    new Date("2026-10-25T10:00:00Z"),
    formatBusinessDateTime,
  );
  assert.equal(new TextDecoder().decode(pdf.slice(0, 5)), "%PDF-");
});

test("invoice configuration is unavailable until shop details are explicitly confirmed", () => {
  assert.equal(getInvoiceBusinessConfiguration({}), null);
  assert.deepEqual(
    getInvoiceBusinessConfiguration({
      SHOP_INVOICE_DETAILS_CONFIRMED: "true",
      SHOP_NAME: "Owner supplied shop name",
      SHOP_ADDRESS: "Owner supplied address",
      SHOP_PHONE: "Owner supplied phone",
      SHOP_EMAIL: "owner@example.com",
      SHOP_GSTIN: "",
    }),
    {
      name: "Owner supplied shop name",
      address: "Owner supplied address",
      phone: "Owner supplied phone",
      email: "owner@example.com",
      gstin: null,
    },
  );
});
