CREATE TABLE IF NOT EXISTS product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE CHECK (length(name) BETWEEN 1 AND 80),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 120),
  slug TEXT NOT NULL UNIQUE CHECK (length(slug) BETWEEN 2 AND 160),
  description TEXT NOT NULL CHECK (length(description) BETWEEN 1 AND 2000),
  image_url TEXT NOT NULL DEFAULT '/images/mithai-assortment.jpg',
  category_id UUID NOT NULL REFERENCES product_categories(id) ON DELETE RESTRICT,
  package_size TEXT NOT NULL CHECK (length(package_size) BETWEEN 1 AND 40),
  price_in_paise BIGINT NOT NULL CHECK (price_in_paise BETWEEN 1 AND 100000000000),
  original_price_in_paise BIGINT CHECK (
    original_price_in_paise IS NULL OR
    original_price_in_paise BETWEEN price_in_paise AND 100000000000
  ),
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity BETWEEN 0 AND 1000000),
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS products_category_active_idx
  ON products (category_id, name) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS products_storefront_idx
  ON products (is_featured DESC, name) WHERE archived_at IS NULL AND is_available = TRUE;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS package_size TEXT NOT NULL DEFAULT 'Standard';

CREATE TABLE IF NOT EXISTS stock_reservations (
  order_id UUID PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('reserved', 'consumed', 'released')),
  reserved_until TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS stock_reservations_expiry_idx
  ON stock_reservations (reserved_until) WHERE status = 'reserved';
