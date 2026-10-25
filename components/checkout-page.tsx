"use client";

import { useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Container } from "@/components/container";
import { useCart } from "@/components/cart-provider";
import {
  formatPrice,
  getProductById,
  isPurchasable,
  products,
} from "@/data/products";
import {
  type CheckoutField,
  type CheckoutFieldErrors,
  type CheckoutSubmission,
  type FulfillmentMethod,
  validateCheckoutSubmission,
} from "@/lib/checkout";
import type { PaymentSetupStatus } from "@/lib/payments/provider";

type RazorpayCheckoutResult = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayOrderResponse = {
  providerOrderId: string;
  amountInPaise: number;
  currency: "INR";
  keyId: string;
};

type RazorpayCheckoutOptions = {
  key: string;
  amount: number;
  currency: "INR";
  name: string;
  description: string;
  order_id: string;
  prefill: { name: string; contact: string };
  handler: (result: RazorpayCheckoutResult) => void | Promise<void>;
  modal: { ondismiss: () => void };
  theme: { color: string };
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => {
      open: () => void;
    };
  }
}

type CheckoutPageProps = {
  whatsappConfigured: boolean;
  paymentSetupStatus: PaymentSetupStatus;
};

type PreparedMessage = {
  whatsappUrl: string;
  message: string;
  subtotalInPaise: string;
};

const fieldLabels: Record<CheckoutField, string> = {
  customerName: "Name",
  phone: "Phone number",
  fulfillment: "Fulfilment",
  address: "Delivery address",
  instructions: "Order instructions",
  items: "Cart",
};

export function CheckoutPage({
  whatsappConfigured,
  paymentSetupStatus,
}: CheckoutPageProps) {
  const { items, itemCount, subtotalInPaise, isReady } = useCart();
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [fulfillment, setFulfillment] = useState<FulfillmentMethod>("delivery");
  const [address, setAddress] = useState("");
  const [instructions, setInstructions] = useState("");
  const [errors, setErrors] = useState<CheckoutFieldErrors>({});
  const [requestError, setRequestError] = useState("");
  const [isPreparing, setIsPreparing] = useState(false);
  const [preparedMessage, setPreparedMessage] = useState<PreparedMessage | null>(null);
  const [isStartingPayment, setIsStartingPayment] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState("");
  const [paymentScriptError, setPaymentScriptError] = useState(false);
  const checkoutKeys = useRef(new Map<string, string>());

  if (!isReady) {
    return (
      <main id="main-content" aria-busy="true" className="bg-white">
        <Container className="section-space">
          <div className="h-10 w-56 animate-pulse bg-gold/20" />
          <div className="mt-8 h-48 animate-pulse bg-gold/15" />
        </Container>
      </main>
    );
  }

  const cartLines = Object.entries(items)
    .map(([productId, quantity]) => ({
      product: getProductById(productId),
      quantity,
    }))
    .filter(
      (line): line is { product: (typeof products)[number]; quantity: number } =>
        Boolean(line.product),
    );
  const unavailableItems = cartLines.filter((line) => !isPurchasable(line.product));
  const canPrepare = cartLines.length > 0 && unavailableItems.length === 0;

  function buildSubmission(): CheckoutSubmission {
    return {
      customerName,
      phone,
      fulfillment,
      address: fulfillment === "delivery" ? address : "",
      instructions,
      items: cartLines.map(({ product, quantity }) => ({
        productId: product.id,
        quantity,
      })),
    };
  }

  async function handleRazorpayPayment() {
    setPaymentMessage("");
    setRequestError("");
    const submission = buildSubmission();
    const validation = validateCheckoutSubmission(submission, products);
    if (!validation.success) {
      setErrors(validation.errors);
      return;
    }
    setErrors({});

    if (!canPrepare || paymentSetupStatus !== "ready") {
      setPaymentMessage(
        "Online payment is unavailable until confirmed products and persistent order storage are configured.",
      );
      return;
    }
    if (!window.Razorpay) {
      setPaymentMessage(
        paymentScriptError
          ? "Razorpay Checkout could not be loaded. No payment was started."
          : "Razorpay Checkout is still loading. Please try again.",
      );
      return;
    }

    setIsStartingPayment(true);
    try {
      const requestKey = JSON.stringify(submission);
      let idempotencyKey = checkoutKeys.current.get(requestKey);
      if (!idempotencyKey) {
        idempotencyKey = crypto.randomUUID();
        checkoutKeys.current.set(requestKey, idempotencyKey);
      }
      const response = await fetch("/api/payments/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(submission),
      });
      const result: unknown = await response.json();
      if (!response.ok || !isRazorpayOrderResponse(result)) {
        const responseData = isRecord(result) ? result : {};
        setPaymentMessage(
          typeof responseData.error === "string"
            ? responseData.error
            : "The payment order could not be prepared. No payment was started.",
        );
        return;
      }

      const RazorpayCheckout = window.Razorpay;
      if (!RazorpayCheckout) {
        setPaymentMessage(
          "Razorpay Checkout could not be loaded. The payment order was prepared but no payment was started. Contact the shop before retrying.",
        );
        return;
      }

      const checkout = new RazorpayCheckout({
        key: result.keyId,
        amount: result.amountInPaise,
        currency: result.currency,
        name: "Mithai House",
        description: "Mithai order",
        order_id: result.providerOrderId,
        prefill: { name: customerName.trim(), contact: phone.trim() },
        theme: { color: "#6B1827" },
        modal: {
          ondismiss: () => {
            setPaymentMessage(
              "The Razorpay window was closed. Payment status is not confirmed; please check with the shop before trying again.",
            );
          },
        },
        handler: async (payment) => {
          setPaymentMessage("Verifying payment with the shop server…");
          try {
            const verificationResponse = await fetch("/api/payments/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                providerOrderId: payment.razorpay_order_id,
                providerPaymentId: payment.razorpay_payment_id,
                signature: payment.razorpay_signature,
              }),
            });
            const verification: unknown = await verificationResponse.json();
            const responseData = isRecord(verification) ? verification : {};
            if (!verificationResponse.ok) {
              setPaymentMessage(
                typeof responseData.error === "string"
                  ? responseData.error
                  : "Payment verification is pending. This browser response is not an order confirmation.",
              );
              return;
            }

            setPaymentMessage(
              responseData.paymentStatus === "captured"
                ? "Payment was verified by Razorpay. The shop must still confirm your order."
                : responseData.paymentStatus === "failed"
                  ? "Razorpay reports that the payment failed. Your order is not confirmed."
                  : responseData.paymentStatus === "refunded"
                    ? "Razorpay reports that this payment was refunded. The shop must review the order."
                    : "Payment is not captured yet. Your order is not confirmed; the shop will need to verify its status.",
            );
            if (responseData.paymentStatus === "captured") {
              checkoutKeys.current.delete(requestKey);
            }
          } catch {
            setPaymentMessage(
              "Payment verification could not be reached. Your payment status is unknown; contact the shop before retrying.",
            );
          }
        },
      });
      checkout.open();
    } catch {
      setPaymentMessage(
        "The payment request could not be completed. Check with the shop before trying again.",
      );
    } finally {
      setIsStartingPayment(false);
    }
  }

  async function handlePrepareMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPreparedMessage(null);
    setRequestError("");

    const submission = buildSubmission();
    const validation = validateCheckoutSubmission(submission, products);
    if (!validation.success) {
      setErrors(validation.errors);
      return;
    }
    setErrors({});

    if (!whatsappConfigured) {
      setRequestError(
        "WhatsApp ordering is not configured yet. Please contact the shop directly.",
      );
      return;
    }
    if (!canPrepare) {
      setRequestError(
        "This cart contains items whose prices or availability are not confirmed by the shop.",
      );
      return;
    }

    setIsPreparing(true);
    try {
      const response = await fetch("/api/checkout/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submission),
      });
      const result: unknown = await response.json();
      if (!response.ok || !isPreparedMessage(result)) {
        const responseData = isRecord(result) ? result : {};
        const responseErrors = responseData.errors;
        setErrors(isFieldErrors(responseErrors) ? responseErrors : {});
        setRequestError(
          typeof responseData.error === "string"
            ? responseData.error
            : "We could not prepare the WhatsApp message. Please try again.",
        );
        return;
      }

      setPreparedMessage(result);
    } catch {
      setRequestError("We could not reach the checkout service. Please try again.");
    } finally {
      setIsPreparing(false);
    }
  }

  if (cartLines.length === 0) {
    return (
      <main id="main-content" className="bg-white">
        <Container className="section-space text-center">
          <p className="eyebrow">Before the sweet moments</p>
          <h1 className="section-heading mt-3 text-maroon">Your cart is empty</h1>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-brown/80">
            Add products to your cart before choosing how you would like to place an
            enquiry.
          </p>
          <Link
            href="/products"
            className="mt-7 inline-flex min-h-12 items-center justify-center border border-maroon bg-maroon px-6 text-sm font-semibold text-ivory hover:bg-brown"
          >
            Browse mithai
          </Link>
        </Container>
      </main>
    );
  }

  return (
    <main id="main-content" className="bg-white">
      <Container className="section-space">
        {paymentSetupStatus === "ready" && (
          <Script
            src="https://checkout.razorpay.com/v1/checkout.js"
            strategy="afterInteractive"
            onError={() => setPaymentScriptError(true)}
          />
        )}
        <Link
          href="/cart"
          className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-maroon underline decoration-gold underline-offset-4 hover:text-brown"
        >
          <ArrowLeft aria-hidden="true" size={16} />
          Return to cart
        </Link>
        <p className="eyebrow mt-8">Your order enquiry</p>
        <h1 className="section-heading mt-3 text-maroon">Checkout</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-brown/75">
          Review your selection and choose WhatsApp to prepare a message for the shop.
          No order is submitted until you send that message, and the shop must confirm
          availability and final details.
        </p>

        {unavailableItems.length > 0 && (
          <div
            role="status"
            className="mt-7 border border-gold/60 bg-ivory px-4 py-3 text-sm leading-6 text-brown"
          >
            Ordering is unavailable for this cart because one or more demonstration
            products still need confirmed prices and availability from the shop.
          </div>
        )}

        <div className="mt-9 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-14">
          <section aria-labelledby="customer-details-heading">
            <h2
              id="customer-details-heading"
              className="font-display text-2xl text-brown sm:text-3xl"
            >
              Customer details
            </h2>

            <form className="mt-6 space-y-6" onSubmit={handlePrepareMessage} noValidate>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  id="customer-name"
                  label="Name"
                  error={errors.customerName}
                  help="Enter the name the shop can use to follow up."
                >
                  <input
                    id="customer-name"
                    name="customerName"
                    autoComplete="name"
                    required
                    minLength={2}
                    maxLength={100}
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    aria-invalid={Boolean(errors.customerName)}
                    aria-describedby={
                      errors.customerName ? "customer-name-error" : "customer-name-help"
                    }
                    className={inputClass(Boolean(errors.customerName))}
                  />
                </Field>

                <Field id="customer-phone" label="Phone number" error={errors.phone}>
                  <input
                    id="customer-phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    required
                    maxLength={24}
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    aria-invalid={Boolean(errors.phone)}
                    aria-describedby={errors.phone ? "customer-phone-error" : undefined}
                    className={inputClass(Boolean(errors.phone))}
                  />
                </Field>
              </div>

              <fieldset>
                <legend className="text-sm font-semibold text-brown">
                  How would you like to receive your order?
                </legend>
                <div className="mt-3 flex flex-wrap gap-3">
                  {(["delivery", "pickup"] as const).map((method) => (
                    <label
                      key={method}
                      className={`inline-flex min-h-11 cursor-pointer items-center gap-2 border px-4 text-sm ${
                        fulfillment === method
                          ? "border-maroon bg-maroon text-ivory"
                          : "border-gold/60 text-brown"
                      }`}
                    >
                      <input
                        className="accent-saffron"
                        type="radio"
                        name="fulfillment"
                        value={method}
                        checked={fulfillment === method}
                        onChange={() => {
                          setFulfillment(method);
                          setErrors((current) => ({ ...current, fulfillment: undefined }));
                        }}
                      />
                      {method === "delivery" ? "Delivery" : "Pickup"}
                    </label>
                  ))}
                </div>
                {errors.fulfillment && (
                  <p className="mt-2 text-sm text-maroon" role="alert">
                    {errors.fulfillment}
                  </p>
                )}
              </fieldset>

              {fulfillment === "delivery" && (
                <Field
                  id="delivery-address"
                  label="Delivery address"
                  error={errors.address}
                  help="Address details are sent only when you choose to prepare the WhatsApp message."
                >
                  <textarea
                    id="delivery-address"
                    name="address"
                    autoComplete="street-address"
                    required
                    minLength={5}
                    maxLength={500}
                    rows={3}
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    aria-invalid={Boolean(errors.address)}
                    aria-describedby={
                      errors.address ? "delivery-address-error" : "delivery-address-help"
                    }
                    className={inputClass(Boolean(errors.address))}
                  />
                </Field>
              )}

              <Field
                id="order-instructions"
                label="Order instructions"
                hint="Optional"
                error={errors.instructions}
              >
                <textarea
                  id="order-instructions"
                  name="instructions"
                  maxLength={500}
                  rows={3}
                  value={instructions}
                  onChange={(event) => setInstructions(event.target.value)}
                  aria-invalid={Boolean(errors.instructions)}
                  aria-describedby={
                    errors.instructions ? "order-instructions-error" : undefined
                  }
                  className={inputClass(Boolean(errors.instructions))}
                />
              </Field>

              {errors.items && (
                <p className="text-sm text-maroon" role="alert">
                  {errors.items}
                </p>
              )}
              {requestError && (
                <p className="border border-maroon/30 bg-maroon/5 px-4 py-3 text-sm leading-6 text-maroon" role="alert">
                  {requestError}
                </p>
              )}

              <fieldset className="border border-gold/45 p-4 sm:p-5">
                <legend className="px-1 font-display text-xl text-brown">
                  Choose how to continue
                </legend>
                <div className="mt-2 border-b border-gold/35 pb-5">
                  <h3 className="font-semibold text-maroon">WhatsApp order enquiry</h3>
                  {whatsappConfigured ? (
                    <p className="mt-2 text-sm leading-6 text-brown/75">
                      We prepare a message for your review. You must choose “Open WhatsApp”
                      and send it yourself; the shop then confirms the order.
                    </p>
                  ) : (
                    <p className="mt-2 text-sm leading-6 text-brown/75">
                      WhatsApp is not configured yet. The shop must add its number before
                      an enquiry can be prepared.
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={!canPrepare || !whatsappConfigured || isPreparing}
                    className="mt-4 inline-flex min-h-12 w-full items-center justify-center border border-maroon bg-maroon px-5 text-sm font-semibold text-ivory transition-colors hover:bg-brown disabled:cursor-not-allowed disabled:border-brown/30 disabled:bg-brown/10 disabled:text-brown/55 sm:w-auto"
                  >
                    {isPreparing ? "Preparing message…" : "Prepare WhatsApp message"}
                  </button>
                </div>
                <div className="pt-5">
                  <h3 className="font-semibold text-brown">Pay online with Razorpay</h3>
                  <p className="mt-2 text-sm leading-6 text-brown/75">
                    {paymentSetupStatus === "credentials-missing"
                      ? "Not yet available. Razorpay test or live credentials, confirmed product prices and availability, and persistent order storage are required."
                      : paymentSetupStatus === "catalog-unconfirmed"
                        ? "Not yet available. The shop must confirm product prices and availability before the server can create Razorpay orders."
                        : paymentSetupStatus === "order-storage-unavailable"
                          ? "Not yet available. Persistent order storage and confirmed product prices are required before Razorpay orders can be created."
                          : "Razorpay Checkout is available. Payment is verified on the server; the shop must separately confirm the order."}
                  </p>
                  <button
                    type="button"
                    disabled={
                      paymentSetupStatus !== "ready" ||
                      !canPrepare ||
                      isStartingPayment
                    }
                    onClick={handleRazorpayPayment}
                    className="mt-4 min-h-11 w-full border border-brown/25 bg-brown/5 px-4 text-sm font-semibold text-brown/50 enabled:border-maroon enabled:bg-maroon enabled:text-ivory enabled:hover:bg-brown disabled:cursor-not-allowed sm:w-auto"
                  >
                    {isStartingPayment
                      ? "Preparing secure payment…"
                      : paymentSetupStatus === "ready"
                        ? "Continue to Razorpay"
                        : "Razorpay payments not available"}
                  </button>
                  {paymentMessage && (
                    <p className="mt-3 text-sm leading-6 text-brown" role="status">
                      {paymentMessage}
                    </p>
                  )}
                </div>
              </fieldset>
            </form>
          </section>

          <aside className="h-fit border border-gold/45 bg-ivory p-5 sm:p-6">
            <h2 className="font-display text-2xl text-brown">Order summary</h2>
            <p className="mt-2 text-sm text-brown/70">
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </p>
            <ul className="mt-5 divide-y divide-gold/35 border-y border-gold/35">
              {cartLines.map(({ product, quantity }) => {
                const purchasable = isPurchasable(product);
                return (
                  <li key={product.id} className="flex gap-3 py-4">
                    <div className="relative size-16 shrink-0 overflow-hidden bg-[#ead9bb]">
                      <Image
                        src={product.image}
                        alt={product.imageAlt}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-brown">{product.name}</h3>
                      <p className="mt-1 text-xs text-brown/70">Quantity: {quantity}</p>
                      <p className="mt-1 text-xs text-brown/70">
                        {purchasable
                          ? formatPrice(BigInt(product.priceInPaise) * BigInt(quantity))
                          : "Price pending shop confirmation"}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="mt-5 flex justify-between gap-3 text-sm">
              <span>Subtotal</span>
              <span className="font-semibold text-maroon">
                {unavailableItems.length > 0
                  ? "Pending confirmation"
                  : formatPrice(subtotalInPaise)}
              </span>
            </div>
            <p className="mt-3 text-xs leading-5 text-brown/75">
              This browser subtotal is informational only. The server recalculates item
              prices before preparing a message. Delivery charges and final totals must be
              confirmed by the shop.
            </p>
          </aside>
        </div>

        {preparedMessage && (
          <section
            aria-labelledby="prepared-message-heading"
            className="mt-10 border border-gold/60 bg-ivory p-5 sm:p-7"
          >
            <h2
              id="prepared-message-heading"
              className="font-display text-2xl text-maroon"
            >
              Your message is ready
            </h2>
            <p className="mt-2 text-sm leading-6 text-brown/75">
              Nothing has been sent or submitted. Review the details below, then choose
              the link to open WhatsApp and send it to the shop. The shop must confirm
              availability and the final order.
            </p>
            <pre className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap break-words border border-gold/35 bg-white p-4 font-sans text-sm leading-6 text-brown">
              {preparedMessage.message}
            </pre>
            <a
              href={preparedMessage.whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 border border-maroon bg-maroon px-5 text-sm font-semibold text-ivory hover:bg-brown"
            >
              Open WhatsApp
              <ExternalLink aria-hidden="true" size={16} />
            </a>
          </section>
        )}
      </Container>
    </main>
  );
}

function Field({
  id,
  label,
  hint,
  help,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  help?: string;
  error?: string;
  children: React.ReactNode;
}) {
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-brown">
        {label}
        {hint && <span className="ml-2 font-normal text-brown/60">({hint})</span>}
      </label>
      <div className="mt-2">{children}</div>
      {error ? (
        <p id={errorId} className="mt-2 text-sm text-maroon" role="alert">
          {error}
        </p>
      ) : (
        help && (
          <p id={helpId} className="mt-2 text-xs leading-5 text-brown/70">
            {help}
          </p>
        )
      )}
    </div>
  );
}

function inputClass(hasError: boolean) {
  return `min-h-11 w-full border bg-white px-3 py-2 text-sm text-brown outline-none focus-visible:ring-2 focus-visible:ring-saffron ${
    hasError ? "border-maroon" : "border-gold/55"
  }`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPreparedMessage(value: unknown): value is PreparedMessage {
  return (
    isRecord(value) &&
    typeof value.whatsappUrl === "string" &&
    value.whatsappUrl.startsWith("https://wa.me/") &&
    typeof value.message === "string" &&
    typeof value.subtotalInPaise === "string"
  );
}

function isRazorpayOrderResponse(value: unknown): value is RazorpayOrderResponse {
  return (
    isRecord(value) &&
    typeof value.providerOrderId === "string" &&
    typeof value.amountInPaise === "number" &&
    Number.isSafeInteger(value.amountInPaise) &&
    value.amountInPaise > 0 &&
    value.currency === "INR" &&
    typeof value.keyId === "string"
  );
}

function isFieldErrors(value: unknown): value is CheckoutFieldErrors {
  if (!isRecord(value)) return false;
  return Object.entries(value).every(
    ([field, message]) => field in fieldLabels && typeof message === "string",
  );
}
