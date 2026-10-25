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

## Online payments

No payment provider has been selected or integrated. The checkout displays online
payment as unavailable; it does not create provider orders, accept redirects as
payment proof, or mark an order paid. The `PaymentProvider` interface in
`lib/payments/provider.ts` is the integration boundary. A provider adapter must
create orders using server-calculated totals and verify provider signatures before
any future order can be considered paid.

After selecting a provider, configure its public key as
`NEXT_PUBLIC_PAYMENT_PUBLIC_KEY`, its secret as `PAYMENT_SECRET_KEY`, and its webhook
secret as `PAYMENT_WEBHOOK_SECRET` in deployment environment settings. Set
`PAYMENT_PROVIDER` to the chosen provider identifier only after an adapter and
verification flow have been implemented and reviewed. These placeholder variables
do not enable payments by themselves. Never commit real credentials.

## Order persistence and statuses

There is no database or order-management integration. Cart contents are saved in the
customer's browser. A prepared WhatsApp message is not an order record. The site
cannot observe whether the customer sends that message or whether the shop confirms
it. Payment pending, successful, failed, or cancelled statuses cannot be truthfully
recorded until a server-side provider integration and persistent order store exist.
