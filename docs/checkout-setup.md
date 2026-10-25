# Checkout setup

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

The current catalog consists only of demonstration entries with unconfirmed prices
and availability. Therefore, WhatsApp order preparation is intentionally blocked
until real products, prices, and availability are configured. No customer order is
persisted by this application.

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

The server endpoints and SDK adapter are prepared, but **live payment creation is
disabled** until all guard conditions exist. `getPaymentOrderStore()` currently
returns `null` because this project has no database adapter. The product catalog
also contains demonstration entries only. The endpoints therefore cannot create
real Razorpay orders, even if keys are supplied. No credentials are configured here.

### Environment variables

Copy `.env.example` to `.env.local` for local development, and use deployment
environment settings in production:

- `NEXT_PUBLIC_RAZORPAY_KEY_ID`: public Razorpay key ID (`rzp_test_...` during testing).
- `RAZORPAY_KEY_SECRET`: private API key secret, server-only.
- `RAZORPAY_WEBHOOK_SECRET`: private secret configured for the webhook endpoint,
  server-only and separate from the API key secret.

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

There is no persistent database configured. The integration point is
`PaymentOrderStore` in `lib/payments/order-model.ts`; implement it with PostgreSQL
(or another transactional database) before enabling payment endpoints. Its durable
order records must include:

- Internal order ID and unique Razorpay receipt/provider order ID.
- Customer name, phone, fulfillment choice, delivery address when applicable, and
  optional instructions, with a business-approved retention policy.
- Immutable line snapshots: product ID/name, quantity, unit price in paise, total in
  paise, and currency (`INR`).
- Separate order and payment status, provider payment ID, timestamps, and a unique
  webhook event ID table/index for deduplication.

Use a transaction for idempotent event application and status transitions. Never
store card data, Razorpay secrets, or customer checkout data in browser local storage.
Only the cart remains browser-local. Do not replace the store with in-memory server
state: it is not durable across restarts or instances.

### Why ordering is not live

The owner must provide confirmed product IDs, prices, availability, currency/pack
details and fulfillment rules. The business must configure its Razorpay account and
test/live credentials, and the application must receive a real durable order-store
adapter with the required uniqueness and transaction behavior. Shop confirmation,
delivery policies, privacy/retention decisions, and webhook deployment URL must also
be finalized. Until then, the website cannot accept real orders, record payment
status durably, or claim an order is confirmed.
