import { LAHORE_AREAS } from "./lahore-areas.js";
import type { SeedGroup, SeedProduct, TenantSeed } from "./types.js";

const PIZZA_SIZE: SeedGroup = {
  name: "Size", min: 1, max: 1,
  modifiers: [{ name: "Small", delta: -400, keywords: ["6 inch", "personal"] }, { name: "Medium", default: true, keywords: ["9 inch", "regular"] }, { name: "Large", delta: 500, keywords: ["12 inch", "big", "family"] }],
};
const CRUST: SeedGroup = {
  name: "Crust", min: 1, max: 1,
  modifiers: [{ name: "Thin Crust", default: true, keywords: ["thin"] }, { name: "Pan Crust", keywords: ["pan", "thick", "deep"] }, { name: "Stuffed Crust", delta: 250, keywords: ["stuffed", "cheese crust"] }],
};
const TOPPINGS: SeedGroup = {
  name: "Extra toppings", min: 0, max: 5,
  modifiers: [{ name: "Extra Cheese", delta: 150 }, { name: "Jalapeños", delta: 80, keywords: ["jalapeno", "jalapenos"] }, { name: "Olives", delta: 80 }, { name: "Mushrooms", delta: 100 }, { name: "Extra Chicken", delta: 200 }],
};
const pizza = (id: string, name: string, price: number, description: string, keywords: string[] = []): SeedProduct => ({
  id, category: "Pizzas", name, price, description, keywords, groups: [PIZZA_SIZE, CRUST, TOPPINGS],
});

export const SLICEHOUSE: TenantSeed = {
  restaurant: {
    id: "REST_SLICEHOUSE", slug: "slicehouse", name: "Slice House", tagline: "Hand-tossed, wood-fired.", currency: "Rs", tax_rate: 0.05, emoji: "🍕",
    whatsapp_phone_number_id: "DEMO_PNID_SLICEHOUSE",
    persona: "Warm and relaxed, like a neighbourhood pizzeria. Knows the menu inside out. One emoji at most per message.",
    theme: { primary: "#16a34a", secondary: "#14532d", on_primary: "#ffffff", logo_text: "Slice House" },
    greeting: "Ciao 🍕 Welcome to Slice House! Craving a pizza today?",
  },
  categories: ["Pizzas", "Sides", "Drinks"],
  products: [
    pizza("SH_MARG", "Margherita", 1100, "Tomato, mozzarella, fresh basil.", ["margherita", "cheese pizza", "plain"]),
    pizza("SH_PEP", "Chicken Pepperoni", 1450, "Chicken pepperoni, mozzarella, tomato base.", ["pepperoni"]),
    pizza("SH_TIKKA", "Chicken Tikka", 1450, "Tikka chicken, onion, capsicum, mint drizzle.", ["tikka", "desi"]),
    pizza("SH_FAJITA", "Chicken Fajita", 1450, "Fajita chicken, peppers, onions, jalapeños.", ["fajita"]),
    pizza("SH_VEG", "Garden Veggie", 1250, "Mushrooms, olives, capsicum, onion, sweetcorn.", ["veggie", "vegetarian", "veg"]),
    pizza("SH_BBQ", "BBQ Chicken", 1500, "Smoky BBQ chicken, red onion, mozzarella.", ["bbq", "barbecue"]),
    { id: "SH_GARLIC", category: "Sides", name: "Garlic Bread", price: 350, description: "Six pieces with cheese.", keywords: ["garlic bread", "bread"] },
    { id: "SH_WINGS", category: "Sides", name: "Oven Wings 8 pc", price: 650, description: "Eight baked wings in buffalo sauce.", keywords: ["wings"] },
    { id: "SH_DIP", category: "Sides", name: "Ranch Dip", price: 80, keywords: ["dip", "ranch"] },
    { id: "SH_COKE", category: "Drinks", name: "Coke 1.5L", price: 250, keywords: ["coke", "cola"] },
    { id: "SH_SPRITE", category: "Drinks", name: "Sprite 1.5L", price: 250, keywords: ["sprite", "7up"] },
    { id: "SH_WATER", category: "Drinks", name: "Mineral Water 500ml", price: 80, keywords: ["water"] },
  ],
  branches: [
    { id: "SH_BR_GULBERG", name: "Gulberg", address: "MM Alam Road, Gulberg III, Lahore", lat: 31.5120, lng: 74.3480, radius_km: 7, zones: [{ max_km: 3, fee: 100, eta_min: 30, eta_max: 40 }, { max_km: 7, fee: 200, eta_min: 40, eta_max: 55 }] },
    { id: "SH_BR_DHA", name: "DHA Phase 3", address: "Y Block, Phase 3, DHA, Lahore", lat: 31.4790, lng: 74.3810, radius_km: 7, zones: [{ max_km: 3, fee: 100, eta_min: 30, eta_max: 40 }, { max_km: 7, fee: 200, eta_min: 40, eta_max: 55 }] },
  ],
  areas: LAHORE_AREAS,
  promotions: [
    { id: "SH_PR_BOGO", code: "TUESDAY", name: "Tuesday 30% off pizzas", description: "30% off all pizzas.", type: "percent", value: 30, category_scope: ["Pizzas"] },
    { id: "SH_PR_FREEDEL", code: "FREEDEL", name: "Free delivery", description: "Free delivery over Rs 1,500.", type: "free_delivery", min_subtotal: 1500, fulfilment_scope: "delivery" },
  ],
  upsell_rules: [
    { id: "SH_UP_GARLIC", name: "Garlic bread", suggest: "SH_GARLIC", priority: 10, pitch: "add cheesy Garlic Bread for Rs 350", trigger: { cart_has_category: "Pizzas", cart_lacks_category: "Sides" } },
    { id: "SH_UP_DRINK", name: "Drink", suggest: "SH_COKE", priority: 8, pitch: "add a 1.5L Coke for Rs 250", trigger: { cart_has_category: "Pizzas", cart_lacks_category: "Drinks" } },
  ],
  demo_customers: [{ phone: "923001234567", name: "Ahmed", address: { text: "House 12, Street 4, DHA Phase 6, Lahore", area: "DHA Phase 6" } }],
  history: { days: 7, orders_per_day: 25, whatsapp_share: 0.3 },
};
