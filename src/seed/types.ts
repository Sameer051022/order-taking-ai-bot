export interface SeedModifier { name: string; delta?: number; default?: boolean; keywords?: string[] }
export interface SeedGroup { name: string; min: number; max: number; allow_repeat?: boolean; modifiers: SeedModifier[] }
export interface SeedProduct {
  id: string; category: string; name: string; description?: string; price: number; type?: "item" | "deal";
  keywords?: string[]; tags?: string[]; groups?: SeedGroup[];
}
export interface SeedBranch {
  id: string; name: string; address: string; lat: number; lng: number; radius_km: number; phone?: string;
  opens?: string; closes?: string; is_open?: boolean; unavailable?: string[];
  zones: { max_km: number; fee: number; eta_min: number; eta_max: number }[];
}
export interface SeedArea { name: string; aliases?: string[]; city: string; lat: number; lng: number }
export interface SeedPromotion {
  id: string; code: string; name: string; description: string; type: "percent" | "fixed" | "free_delivery"; value?: number;
  min_subtotal?: number; max_discount?: number; category_scope?: string[]; product_scope?: string[]; fulfilment_scope?: "delivery" | "pickup";
  per_customer_limit?: number; ends_at?: string; starts_at?: string; is_active?: boolean;
}
export interface SeedUpsell {
  id: string; name: string; suggest: string; pitch: string; priority?: number;
  trigger: { cart_has_category?: string; cart_lacks_category?: string; cart_has_product?: string; cart_lacks_product?: string; min_subtotal?: number; max_subtotal?: number };
}
export interface SeedDemoCustomer {
  phone: string; name: string; address?: { text: string; area: string };
  past_orders?: { days_ago: number; items: { product: string; quantity?: number; modifiers?: string[] }[]; fulfilment: "delivery" | "pickup"; branch: string }[];
}
export interface TenantSeed {
  restaurant: { id: string; slug: string; name: string; tagline: string; currency: string; tax_rate: number; persona: string; greeting: string; emoji: string; whatsapp_phone_number_id?: string; theme?: { primary: string; secondary: string; on_primary: string; logo_text: string; logo_url?: string } };
  categories: string[];
  products: SeedProduct[];
  branches: SeedBranch[];
  areas: SeedArea[];
  promotions: SeedPromotion[];
  upsell_rules: SeedUpsell[];
  demo_customers: SeedDemoCustomer[];
  history?: { days: number; orders_per_day: number; whatsapp_share: number };
}
