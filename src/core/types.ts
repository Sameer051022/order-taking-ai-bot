export interface Restaurant {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  currency: string;
  tax_rate: number;
  persona: string | null;
  greeting: string | null;
  whatsapp_phone_number_id: string | null;
  emoji: string | null;
  theme: string | null; // JSON BrandTheme
}

export interface BrandTheme {
  primary: string;      // main brand colour
  secondary: string;    // dark accent
  on_primary: string;   // text colour on primary
  logo_text: string;    // wordmark fallback
  logo_url?: string;    // optional image
}

export interface Branch {
  id: string;
  restaurant_id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  delivery_radius_km: number;
  is_open: number;
  opens_at: string;
  closes_at: string;
  phone: string | null;
  prep_minutes: number;
}

export interface DeliveryZone {
  id: string;
  branch_id: string;
  max_km: number;
  fee: number;
  eta_min: number;
  eta_max: number;
}

export interface Area {
  id: string;
  restaurant_id: string;
  name: string;
  aliases: string[];
  city: string;
  lat: number;
  lng: number;
}

export interface Category {
  id: string;
  restaurant_id: string;
  name: string;
  sort_order: number;
}

export interface Modifier {
  id: string;
  group_id: string;
  name: string;
  price_delta: number;
  is_default: number;
  keywords: string[];
  sort_order: number;
}

export interface ModifierGroup {
  id: string;
  product_id: string;
  name: string;
  min_select: number;
  max_select: number;
  allow_repeat: number;
  sort_order: number;
  modifiers: Modifier[];
}

export interface Product {
  id: string;
  restaurant_id: string;
  category_id: string;
  category_name?: string;
  name: string;
  description: string | null;
  base_price: number;
  type: "item" | "deal";
  keywords: string[];
  tags: string[];
  is_active: number;
  sort_order: number;
}

export interface ProductWithOptions extends Product {
  groups: ModifierGroup[];
}

/** Normalised selection stored on a cart line: group_id -> [{modifier_id, quantity}] */
export type Selections = Record<string, { modifier_id: string; quantity: number }[]>;

/** Loose selection input accepted from the agent: group (id|name) -> modifier (id|name) | list | list of {modifier, quantity} */
export type SelectionInput = Record<
  string,
  string | (string | { modifier: string; quantity?: number })[] | null
>;

export interface CartLine {
  id: string;
  cart_id: string;
  product_id: string;
  quantity: number;
  selections: Selections;
  notes: string | null;
  line_no: number;
}

export interface Cart {
  id: string;
  restaurant_id: string;
  conversation_id: string | null;
  customer_id: string | null;
  promo_code: string | null;
  status: "open" | "ordered" | "abandoned";
  created_at: string;
  updated_at: string;
}

export interface PricedSelection {
  group_id: string;
  group_name: string;
  modifier_id: string;
  modifier_name: string;
  quantity: number;
  price_delta: number;
}

export interface PricedLine {
  id: string;
  product_id: string;
  product_name: string;
  product_type: "item" | "deal";
  quantity: number;
  unit_price: number;
  line_total: number;
  selections: PricedSelection[];
  notes: string | null;
  /** Human readable summary such as "Large / Sprite / No Mayo" */
  summary: string;
  issues: LineIssue[];
}

export interface LineIssue {
  type: "missing_selection" | "too_many" | "unavailable" | "invalid";
  group_id?: string;
  group_name?: string;
  message: string;
  options?: { modifier_id: string; name: string; price_delta: number }[];
  min?: number;
  max?: number;
}

export interface Totals {
  subtotal: number;
  discount: number;
  discount_label: string | null;
  tax: number;
  tax_rate: number;
  delivery_fee: number;
  total: number;
  currency: string;
}

export interface PricedCart {
  cart_id: string;
  lines: PricedLine[];
  totals: Totals;
  promo_code: string | null;
  promo_error: string | null;
  is_valid: boolean;
  issues: LineIssue[];
  item_count: number;
}

export interface Promotion {
  id: string;
  restaurant_id: string;
  code: string | null;
  name: string;
  description: string | null;
  type: "percent" | "fixed" | "free_delivery";
  value: number;
  min_subtotal: number;
  max_discount: number | null;
  product_scope: string[];
  category_scope: string[];
  branch_scope: string[];
  fulfilment_scope: "delivery" | "pickup" | null;
  per_customer_limit: number | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: number;
}

export interface Customer {
  id: string;
  restaurant_id: string;
  channel: string;
  external_id: string;
  name: string | null;
  last_address: Address | null;
  created_at: string;
}

export interface Address {
  text: string;
  lat?: number;
  lng?: number;
  area?: string;
  /** Filled by routing when the address was resolved for delivery. */
  distance_km?: number;
  delivery_fee?: number;
  eta_min?: number;
  eta_max?: number;
}

export interface Conversation {
  id: string;
  restaurant_id: string;
  customer_id: string;
  channel: "whatsapp" | "web";
  status: "active" | "human" | "closed";
  cart_id: string | null;
  branch_id: string | null;
  fulfilment: "delivery" | "pickup" | null;
  address: Address | null;
  order_count: number;
  created_at: string;
  last_message_at: string;
}

export type OrderStatus =
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "RIDER_ASSIGNED"
  | "ON_THE_WAY"
  | "DELIVERED"
  | "COLLECTED"
  | "CANCELLED";

export interface Order {
  id: string;
  restaurant_id: string;
  branch_id: string;
  branch_name?: string;
  customer_id: string | null;
  conversation_id: string | null;
  order_number: number;
  channel: string;
  source: "ai" | "manual";
  status: OrderStatus;
  fulfilment: "delivery" | "pickup";
  address: Address | null;
  customer_name: string | null;
  customer_phone: string | null;
  items: PricedLine[];
  totals: Totals;
  promo_code: string | null;
  payment_method: string;
  payment_status: string;
  eta_min: number | null;
  eta_max: number | null;
  created_at: string;
  updated_at: string;
}

export class DomainError extends Error {
  constructor(message: string, public readonly code: string = "DOMAIN_ERROR", public readonly details?: unknown) {
    super(message);
  }
}
