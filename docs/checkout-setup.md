# Checkout setup

## Product catalog and administrator management

Products and categories live in PostgreSQL and are read at request time by the home,
products, product-detail, cart, and checkout flows. Product-management changes do not
require a deployment; the storefront refreshes its open catalog/product pages every
30 seconds and also reads the database on navigation. Browser prices are display-only:
payment checkout re-reads product prices, availability, and stock on the server.

After confirming the target database, run `npm run db:migrate` using
`DATABASE_URL_UNPOOLED` (preferred) or `DATABASE_URL`. Migration
`003_product_management` adds categories, product data, package-size snapshots, and
inventory reservations without deleting or migrating demo entries. Existing demo
catalog examples are not copied into the products table.

Product images use Vercel Blob. Configure server-only `BLOB_READ_WRITE_TOKEN` in
local/deployment environment settings. Only authenticated administrators can upload
JPG, PNG, or WebP images (maximum 4 MB); the server checks the content signature and
stores only the persistent Blob URL in PostgreSQL. Until the token is configured,
product editing still works with the built-in default image, but uploads return a
configuration error.

### Inventory reservation policy

An online payment order atomically reserves current stock for 15 minutes before a
Razorpay order is created. PostgreSQL product-row locks prevent concurrent checkout
requests from reserving more than the available quantity. The scheduled
`/api/cron/release-stock-reservations` endpoint runs every five minutes in Vercel and
requires server-only `CRON_SECRET`; expired, failed, or cancelled pending reservations
are released idempotently. Once payment is captured, the reservation is consumed and
stock on hand is deducted in the same database transaction. A late capture after the
reservation expires enters payment review rather than being treated as a confirmed
order. An unpaid online order is never marked paid.

Cash on delivery is not implemented in this project. WhatsApp checkout remains an
unconfirmed enquiry and does not create an order or reserve stock.

## WhatsApp order enquiries

Copy `.env.example` to `.env.local` and set
`NEXT_PUBLIC_SHOP_WHATSAPP_NUMBER` to the shop's WhatsApp number in international
format, including country code. Enter digits only, with no `+` prefix. Do not put a
personal or unapproved number in source control.

The checkout server validates customer fields and cart product IDs and quantities
against the product catalog. It derives all included prices from shop-configured,
available, non-demonstration products; prices and totals submitted by a browser are
ignored. A prepared message is only shown after the customer explicitly requests it.
The customer must then open WhatsApp and send the message. Opening it does not submit
or confirm an order, and the shop must confirm availability and final details.

WhatsApp checkout is available only for published products with a confirmed price and
current availability. It prepares an enquiry only; the shop must confirm it before
there is an order.

## Razorpay payment foundation

Razorpay-specific server code is isolated behind `PaymentProvider` in
`lib/payments/provider.ts` and the official [`razorpay` Node SDK](https://github.com/razorpay/razorpay-node)
adapter in `lib/payments/razorpay.ts`. No browser code receives the API secret.

The intended flow is:

1. The browser submits product identifiers, quantities, and checkout details to
   `POST /api/payments/orders`. It does not submit a trusted total.
2. The server validates customer fields, re-reads current catalog entries, rejects
   demo/unconfirmed or unavailable products, and calculates INR in integer paise.
3. A persistent order must be written before the server creates a Razorpay order.
   The server response then gives Razorpay Checkout the server-created provider order
   ID, amount, INR currency, and public key ID.
4. Razorpay Checkout returns payment identifiers and a signature to the browser.
   `POST /api/payments/verify` validates the signature server-side, fetches the
   payment from Razorpay, and compares its order ID, amount, and currency to the
   persisted order. A browser redirect or callback alone never marks an order paid.
5. `POST /api/payments/webhook` verifies `X-Razorpay-Signature` against the exact raw
   request body using the webhook secret. The database must uniquely record
   `X-Razorpay-Event-Id` and apply the event atomically to make retries idempotent.
   `payment.captured`, `payment.failed`, and `payment.authorized` events update the
   payment state. A captured payment leaves the shop order in
   `awaiting_shop_confirmation`; payment success does not confirm fulfillment.

Live payment creation requires a published, available product, enough stock, database
migrations, and the Razorpay credentials below. No credentials are configured here.

### Environment variables

Copy `.env.example` to `.env.local` for local development, and use deployment
environment settings in production:

- `NEXT_PUBLIC_RAZORPAY_KEY_ID`: public Razorpay key ID (`rzp_test_...` during testing).
- `RAZORPAY_KEY_SECRET`: private API key secret, server-only.
- `RAZORPAY_WEBHOOK_SECRET`: private secret configured for the webhook endpoint,
  server-only and separate from the API key secret.
- `BLOB_READ_WRITE_TOKEN`: Vercel Blob read/write token, server-only; needed for
  product image uploads.
- `CRON_SECRET`: secret sent by Vercel with the scheduled reservation cleanup request.

The shop owner must create/authorize a Razorpay account, obtain its test keys from
the Razorpay dashboard, select test mode for development, and configure a webhook
to `/api/payments/webhook` with the same webhook secret used by the deployment.
Never commit real keys or use live keys for automated tests. Automated tests use a
mock SDK client and local signature fixtures; they do not contact Razorpay or charge
money.

Official integration guidance: [Razorpay Standard Checkout integration
steps](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/),
[Orders API](https://razorpay.com/docs/api/orders/create/), and [official Node
SDK](https://github.com/razorpay/razorpay-node).

### Database and order model

The PostgreSQL store is `lib/payments/order-store.ts`. Run `npm run db:migrate` with
`DATABASE_URL_UNPOOLED` (preferred for schema changes) or `DATABASE_URL` to apply
the additive migrations `001_admin_orders` and `002_order_notifications`. The second
migration adds checkout idempotency and the SMS outbox. Do not run migrations against
production until the selected Neon database is confirmed. Its durable order records
include:

- Internal order ID and unique Razorpay receipt/provider order ID.
- Customer name, phone, fulfillment choice, delivery address when applicable, and
  optional instructions, with a business-approved retention policy.
- immutable line snapshots: product ID/name/package size, quantity, unit price in paise, total in
  paise, and currency (`INR`).
- Separate order and payment status, provider payment ID, timestamps, and a unique
  webhook event ID table/index for deduplication.

Checkout retries reuse the same `Idempotency-Key`; the unique database key prevents
duplicate order rows for the same checkout request. Admin order APIs require an
administrator session. The order list polls the protected API every 15 seconds.
Status changes and notification enqueueing share a transaction. The server attempts
the queued notification after commit, and admin users can retry failed messages up to
three attempts. Provider acceptance is shown separately from confirmed delivery.
Never store card data, Razorpay secrets, or customer checkout data in browser local
storage. Only the cart remains browser-local.

### Why ordering is not live

The shop must confirm product prices, availability, and delivery-fee policy before
production checkout. The current order total is the validated catalog subtotal;
delivery charges and cash-on-delivery are not configured. Confirmation requires a
provider-verified captured payment.

## SMS setup

The adapter is `lib/notifications/sms.ts`. With `SMS_PROVIDER=mock` (the default) or
`SMS_ENABLED=false`, confirmation records a local mock acceptance and never contacts
a provider. Configure these server-only Vercel variables to enable MSG91:

- `SMS_PROVIDER=msg91`
- `SMS_ENABLED=true`
- `MSG91_AUTH_KEY`
- `MSG91_TEMPLATE_ID`

The MSG91 template must map `VAR1` to customer name, `VAR2` to order number, and
`VAR3` to order total. Configure the sender ID, DLT registration, approved template,
consent, and applicable Indian messaging rules in MSG91. Do not use `NEXT_PUBLIC_`
for provider credentials. The app records provider acceptance and reference; a
delivery callback is not configured, so accepted does not mean delivered.

For an end-to-end local check, configure a test database and Razorpay test
credentials, run the migrations, replace demonstration products with approved test
products, place and verify an order, then confirm it in `/admin/orders`. The default
SMS mock should show an accepted notification with a mock reference. Test failures
in a non-production environment before enabling MSG91 in production.
