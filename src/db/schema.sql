PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS restaurants (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  tagline TEXT,
  currency TEXT NOT NULL DEFAULT 'Rs',
  tax_rate REAL NOT NULL DEFAULT 0,
  persona TEXT,
  greeting TEXT,
  whatsapp_phone_number_id TEXT,
  emoji TEXT,
  theme TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS branches (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  delivery_radius_km REAL NOT NULL DEFAULT 6,
  is_open INTEGER NOT NULL DEFAULT 1,
  opens_at TEXT NOT NULL DEFAULT '11:00',
  closes_at TEXT NOT NULL DEFAULT '02:00',
  phone TEXT,
  prep_minutes INTEGER NOT NULL DEFAULT 15
);

CREATE TABLE IF NOT EXISTS delivery_zones (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL REFERENCES branches(id),
  max_km REAL NOT NULL,
  fee INTEGER NOT NULL,
  eta_min INTEGER NOT NULL,
  eta_max INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS areas (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  name TEXT NOT NULL,
  aliases TEXT NOT NULL DEFAULT '[]',
  city TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  category_id TEXT NOT NULL REFERENCES categories(id),
  name TEXT NOT NULL,
  description TEXT,
  base_price INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'item',
  keywords TEXT NOT NULL DEFAULT '[]',
  tags TEXT NOT NULL DEFAULT '[]',
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS modifier_groups (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  name TEXT NOT NULL,
  min_select INTEGER NOT NULL DEFAULT 0,
  max_select INTEGER NOT NULL DEFAULT 1,
  allow_repeat INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS modifiers (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES modifier_groups(id),
  name TEXT NOT NULL,
  price_delta INTEGER NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0,
  keywords TEXT NOT NULL DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS branch_product_availability (
  branch_id TEXT NOT NULL REFERENCES branches(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  is_available INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (branch_id, product_id)
);

CREATE TABLE IF NOT EXISTS promotions (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  code TEXT,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,              -- percent | fixed | free_delivery
  value INTEGER NOT NULL DEFAULT 0,
  min_subtotal INTEGER NOT NULL DEFAULT 0,
  max_discount INTEGER,
  product_scope TEXT NOT NULL DEFAULT '[]',
  category_scope TEXT NOT NULL DEFAULT '[]',
  branch_scope TEXT NOT NULL DEFAULT '[]',
  fulfilment_scope TEXT,           -- delivery | pickup | NULL (any)
  per_customer_limit INTEGER,
  starts_at TEXT,
  ends_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS promotion_usages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  promotion_id TEXT NOT NULL REFERENCES promotions(id),
  customer_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS upsell_rules (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  name TEXT NOT NULL,
  trigger TEXT NOT NULL,           -- JSON: {cart_has_category?, cart_lacks_category?, cart_has_product?, min_subtotal?}
  suggest_product_id TEXT NOT NULL REFERENCES products(id),
  pitch TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS upsell_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  restaurant_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  offered_at TEXT NOT NULL,
  accepted_at TEXT
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  channel TEXT NOT NULL,
  external_id TEXT NOT NULL,
  name TEXT,
  last_address TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (restaurant_id, channel, external_id)
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  customer_id TEXT NOT NULL REFERENCES customers(id),
  channel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',   -- active | human | closed
  cart_id TEXT,
  branch_id TEXT,
  fulfilment TEXT,                          -- delivery | pickup
  address TEXT,                             -- JSON {text, lat, lng, area}
  order_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  last_message_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  role TEXT NOT NULL,                       -- user | assistant | system
  content TEXT NOT NULL,                    -- JSON (Claude API content blocks)
  display_text TEXT,                        -- what the customer saw / typed
  latency_ms INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS carts (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  conversation_id TEXT,
  customer_id TEXT,
  promo_code TEXT,
  status TEXT NOT NULL DEFAULT 'open',      -- open | ordered | abandoned
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cart_items (
  id TEXT PRIMARY KEY,
  cart_id TEXT NOT NULL REFERENCES carts(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  selections TEXT NOT NULL DEFAULT '{}',    -- JSON {group_id: [{modifier_id, quantity}]}
  notes TEXT,
  line_no INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  branch_id TEXT NOT NULL REFERENCES branches(id),
  customer_id TEXT REFERENCES customers(id),
  conversation_id TEXT,
  order_number INTEGER NOT NULL,
  channel TEXT NOT NULL,                    -- whatsapp | web | app | walk-in
  source TEXT NOT NULL DEFAULT 'ai',        -- ai | manual
  status TEXT NOT NULL,
  fulfilment TEXT NOT NULL,
  address TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  items TEXT NOT NULL,                      -- JSON snapshot
  totals TEXT NOT NULL,                     -- JSON snapshot
  promo_code TEXT,
  payment_method TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  eta_min INTEGER,
  eta_max INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES orders(id),
  status TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_restaurant_created ON orders(restaurant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, id);
CREATE INDEX IF NOT EXISTS idx_products_restaurant ON products(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_conversations_restaurant ON conversations(restaurant_id, last_message_at);
