CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY,
  receipt TEXT NOT NULL UNIQUE,
  provider_order_id TEXT UNIQUE,
  provider_payment_id TEXT,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  fulfillment_method TEXT NOT NULL CHECK (fulfillment_method IN ('delivery', 'pickup')),
  delivery_address TEXT,
  instructions TEXT,
  amount_in_paise BIGINT NOT NULL CHECK (amount_in_paise > 0),
  refunded_amount_in_paise BIGINT NOT NULL DEFAULT 0 CHECK (refunded_amount_in_paise >= 0),
  currency TEXT NOT NULL CHECK (currency = 'INR'),
  order_status TEXT NOT NULL CHECK (order_status IN (
    'awaiting_payment', 'awaiting_shop_confirmation', 'confirmed', 'cancelled',
    'payment_received_review_required'
  )),
  fulfillment_status TEXT NOT NULL DEFAULT 'new' CHECK (fulfillment_status IN (
    'new', 'preparing', 'ready_for_dispatch', 'out_for_delivery', 'delivered',
    'picked_up', 'cancelled'
  )),
  payment_status TEXT NOT NULL CHECK (payment_status IN (
    'created', 'pending', 'authorized', 'captured', 'failed', 'cancelled',
    'refund_pending', 'partially_refunded', 'refunded'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  unit_price_in_paise BIGINT NOT NULL CHECK (unit_price_in_paise > 0),
  line_total_in_paise BIGINT NOT NULL CHECK (line_total_in_paise > 0),
  UNIQUE (order_id, product_id)
);

CREATE TABLE IF NOT EXISTS payment_attempts (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider = 'razorpay'),
  provider_order_id TEXT NOT NULL,
  provider_payment_id TEXT UNIQUE,
  amount_in_paise BIGINT NOT NULL CHECK (amount_in_paise > 0),
  currency TEXT NOT NULL CHECK (currency = 'INR'),
  status TEXT NOT NULL CHECK (status IN (
    'created', 'pending', 'authorized', 'captured', 'failed', 'cancelled',
    'refund_pending', 'partially_refunded', 'refunded'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payment_attempts_order_idx
  ON payment_attempts (order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_created_idx ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS orders_payment_status_idx ON orders (payment_status);
CREATE INDEX IF NOT EXISTS orders_fulfillment_status_idx ON orders (fulfillment_status);

CREATE TABLE IF NOT EXISTS refunds (
  provider_refund_id TEXT PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider_payment_id TEXT NOT NULL,
  amount_in_paise BIGINT NOT NULL CHECK (amount_in_paise > 0),
  status TEXT NOT NULL CHECK (status IN ('pending', 'processed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_events (
  provider_event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  provider_order_id TEXT NOT NULL,
  provider_payment_id TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_status_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status_type TEXT NOT NULL CHECK (status_type IN ('payment', 'fulfillment', 'order')),
  previous_status TEXT,
  next_status TEXT NOT NULL,
  actor TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS order_status_history_order_idx
  ON order_status_history (order_id, created_at DESC);

CREATE TABLE IF NOT EXISTS admin_audit_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  administrator TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_login_limits (
  identifier_hash CHAR(64) PRIMARY KEY,
  attempts INTEGER NOT NULL CHECK (attempts >= 0),
  window_started_at TIMESTAMPTZ NOT NULL,
  locked_until TIMESTAMPTZ
);
