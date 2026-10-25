ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS orders_idempotency_key_unique
  ON orders (idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS order_notifications (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('order_confirmed')),
  recipient_phone TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'accepted', 'delivered', 'failed')),
  provider TEXT NOT NULL,
  provider_reference TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (order_id, notification_type)
);
CREATE INDEX IF NOT EXISTS order_notifications_retry_idx
  ON order_notifications (status, updated_at)
  WHERE status IN ('pending', 'failed');
