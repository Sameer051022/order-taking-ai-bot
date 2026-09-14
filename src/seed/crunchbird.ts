import { LAHORE_AREAS } from "./lahore-areas.js";
import type { SeedGroup, SeedProduct, TenantSeed } from "./types.js";

const SIZE: SeedGroup = {
  name: "Size", min: 1, max: 1,
  modifiers: [
    { name: "Regular", default: true, keywords: ["normal", "medium", "standard", "small"] },
    { name: "Large", delta: 200, keywords: ["big", "upsize", "large size", "bara"] },
  ],
};
const DRINK: SeedGroup = {
  name: "Drink", min: 1, max: 1,
  modifiers: [
    { name: "Coke", keywords: ["coca cola", "cola", "pepsi"] },
    { name: "Sprite", keywords: ["7up", "seven up", "lemon"] },
    { name: "Fanta", keywords: ["orange"] },
    { name: "Diet Coke", keywords: ["coke zero", "zero", "diet"] },
    { name: "Mineral Water", keywords: ["water", "pani"] },
  ],
};
const CUSTOMISE: SeedGroup = {
  name: "Burger customisation", min: 0, max: 4,
  modifiers: [
    { name: "No Mayo", keywords: ["without mayo", "mayo nahi", "no mayonnaise", "no sauce"] },
    { name: "No Lettuce", keywords: ["without lettuce", "no salad"] },
    { name: "Extra Cheese", delta: 100, keywords: ["cheese", "add cheese"] },
    { name: "Extra Patty", delta: 300, keywords: ["double patty", "extra chicken"] },
    { name: "Extra Spicy", keywords: ["more spicy", "very spicy", "zyada spicy"] },
  ],
};
const SPICE: SeedGroup = {
  name: "Flavour", min: 1, max: 1,
  modifiers: [
    { name: "Spicy", default: true, keywords: ["hot"] },
    { name: "Original", keywords: ["normal", "non spicy", "mild", "plain"] },
  ],
};

const burger = (id: string, name: string, price: number, description: string, keywords: string[] = []): SeedProduct => ({
  id, category: "Burgers", name, price, description, keywords, groups: [CUSTOMISE],
});
const meal = (id: string, name: string, price: number, description: string, keywords: string[] = []): SeedProduct => ({
  id, category: "Meals", name, price, description, keywords, tags: ["meal"], groups: [SIZE, DRINK, CUSTOMISE],
});

export const CRUNCHBIRD: TenantSeed = {
  restaurant: {
    id: "REST_CRUNCHBIRD",
    slug: "crunchbird",
    name: "CrunchBird",
    tagline: "Crispy. Spicy. Fast.",
    currency: "Rs",
    tax_rate: 0.05,
    emoji: "🍗",
    whatsapp_phone_number_id: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "DEMO_PNID_CRUNCHBIRD",
    persona: "Friendly, quick and helpful, like the best counter staff at a busy fast-food branch. Uses a light touch of emoji (one per message at most). Never pushy.",
    theme: { primary: "#c2410c", secondary: "#1f1a17", on_primary: "#ffffff", logo_text: "CrunchBird" },
    greeting: "Hi 👋 Welcome to CrunchBird! What can I get started for you today?",
  },
  categories: ["Burgers", "Meals", "Wraps & Rice", "Chicken", "Deals", "Sides", "Drinks", "Desserts"],
  products: [
    burger("P_ZINGER", "Zinger Burger", 550, "Our signature crispy spicy chicken fillet with lettuce and mayo in a soft bun.", ["zinger", "spicy burger"]),
    burger("P_SPICY", "Spicy Chicken Burger", 520, "Crispy chicken fillet with a fiery kick, lettuce and mayo.", ["spicy chicken", "spicy"]),
    burger("P_MIGHTY", "Mighty Burger", 750, "Double crispy fillet, double cheese, jalapeños and smoky sauce.", ["mighty", "double", "double burger"]),
    burger("P_STACK", "Chicken Stack", 690, "Crispy fillet stacked with a grilled patty, cheese and stack sauce.", ["stack", "chicken stack"]),
    burger("P_GRILLED", "Grilled Chicken Burger", 580, "Flame-grilled chicken breast with lettuce, tomato and garlic mayo.", ["grilled", "healthy"]),
    burger("P_FILLET", "Fillet Burger", 500, "Classic crispy fillet with lettuce and mayo. Not spicy.", ["fillet", "plain burger", "normal burger", "non spicy burger"]),
    burger("P_MIGHTY_ZINGER", "Mighty Zinger", 850, "Two Zinger fillets, double cheese and jalapeños. Our biggest burger.", ["mighty zinger", "double zinger", "big zinger"]),
    burger("P_KRUNCH", "Krunch Burger", 350, "Value crispy chicken burger with lettuce and mayo.", ["krunch", "crunch burger", "value burger", "cheap burger", "small burger"]),

    meal("P_ZINGER_MEAL", "Zinger Meal", 950, "Zinger Burger + fries + drink.", ["zinger meal", "zinger combo", "zinger deal"]),
    meal("P_SPICY_MEAL", "Spicy Chicken Meal", 920, "Spicy Chicken Burger + fries + drink.", ["spicy chicken meal", "spicy meal", "spicy chicken burger meal", "chicken meal"]),
    meal("P_MIGHTY_MEAL", "Mighty Meal", 1150, "Mighty Burger + fries + drink.", ["mighty meal"]),
    meal("P_STACK_MEAL", "Chicken Stack Meal", 1090, "Chicken Stack + fries + drink.", ["stack meal"]),
    meal("P_GRILLED_MEAL", "Grilled Chicken Meal", 980, "Grilled Chicken Burger + fries + drink.", ["grilled meal"]),
    meal("P_FILLET_MEAL", "Fillet Meal", 900, "Fillet Burger + fries + drink. Not spicy.", ["fillet meal", "normal meal", "non spicy meal", "plain meal"]),
    meal("P_MIGHTY_ZINGER_MEAL", "Mighty Zinger Meal", 1250, "Mighty Zinger + fries + drink.", ["mighty zinger meal", "double zinger meal"]),
    meal("P_KRUNCH_MEAL", "Krunch Meal", 650, "Krunch Burger + fries + drink.", ["krunch meal", "value meal", "cheap meal"]),

    { id: "P_TWISTER", category: "Wraps & Rice", name: "Twister Wrap", price: 550, description: "Crispy chicken strips, lettuce, tomato and pepper mayo in a soft tortilla.", keywords: ["twister", "wrap", "chicken wrap", "tortilla"], groups: [SPICE, CUSTOMISE] },
    { id: "P_TWISTER_MEAL", category: "Wraps & Rice", name: "Twister Meal", price: 950, description: "Twister Wrap + fries + drink.", keywords: ["twister meal", "wrap meal"], tags: ["meal"], groups: [SIZE, DRINK, SPICE] },
    { id: "P_RICE", category: "Wraps & Rice", name: "Rice & Spice", price: 650, description: "Spiced rice topped with crispy chicken chunks and sauce.", keywords: ["rice", "rice bowl", "rice and spice", "chawal"], groups: [SPICE] },

    { id: "P_WINGS6", category: "Chicken", name: "Hot Wings 6 pc", price: 499, description: "Six crispy hot wings.", keywords: ["wings", "hot wings", "6 wings", "six wings"], groups: [SPICE] },
    { id: "P_WINGS12", category: "Chicken", name: "Hot Wings 12 pc", price: 899, description: "Twelve crispy hot wings.", keywords: ["12 wings", "twelve wings", "dozen wings"], groups: [SPICE] },
    { id: "P_CHK2", category: "Chicken", name: "Crispy Chicken 2 pc", price: 550, description: "Two pieces of bone-in crispy chicken.", keywords: ["2 piece", "fried chicken", "chicken pieces", "2 pc chicken"], groups: [SPICE] },
    { id: "P_CHK4", category: "Chicken", name: "Crispy Chicken 4 pc", price: 1050, description: "Four pieces of bone-in crispy chicken.", keywords: ["4 piece", "4 pc chicken"], groups: [SPICE] },
    { id: "P_STRIPS", category: "Chicken", name: "Chicken Strips 5 pc", price: 620, description: "Five crispy boneless strips with a dip.", keywords: ["strips", "tenders", "boneless"], groups: [SPICE] },
    { id: "P_HOTSHOTS", category: "Chicken", name: "Hot Shots 12 pc", price: 480, description: "Twelve bite-sized crispy chicken pieces.", keywords: ["hot shots", "hotshots", "bites", "popcorn chicken"], groups: [SPICE] },
    { id: "P_CHK_CHIPS", category: "Chicken", name: "Chicken & Chips", price: 750, description: "Two pieces of crispy chicken with regular fries.", keywords: ["chicken and chips", "chicken chips", "2 pc with fries"], groups: [SPICE] },
    { id: "P_BUCKET12", category: "Chicken", name: "12 pc Bucket", price: 2799, description: "Twelve pieces of bone-in crispy chicken in a bucket.", keywords: ["12 piece", "12 pc bucket", "bucket of chicken", "12 pieces"], groups: [SPICE] },

    {
      id: "P_FAMILY_BUCKET", category: "Deals", name: "Family Bucket Deal", price: 2999, type: "deal",
      description: "8 pieces of crispy chicken, 2 sides of your choice, 1 × 1.5L drink and optional dips. Feeds 4.",
      keywords: ["family deal", "family bucket", "bucket", "family"],
      groups: [
        { name: "Sides (choose 2)", min: 2, max: 2, allow_repeat: true, modifiers: [
          { name: "Regular Fries", keywords: ["fries", "chips"] }, { name: "Coleslaw", keywords: ["slaw", "salad"] }, { name: "Corn on the Cob", keywords: ["corn"] }, { name: "Nuggets 6 pc", keywords: ["nuggets"] },
        ] },
        { name: "1.5L Drink", min: 1, max: 1, modifiers: [
          { name: "Coke 1.5L", keywords: ["coke", "cola", "pepsi"] }, { name: "Sprite 1.5L", keywords: ["sprite", "7up"] }, { name: "Fanta 1.5L", keywords: ["fanta", "orange"] },
        ] },
        { name: "Extra dips", min: 0, max: 3, allow_repeat: true, modifiers: [
          { name: "Garlic Dip", delta: 50, keywords: ["garlic"] }, { name: "BBQ Dip", delta: 50, keywords: ["bbq", "barbecue"] }, { name: "Chilli Dip", delta: 50, keywords: ["chilli", "hot sauce"] },
        ] },
      ],
    },
    {
      id: "P_DUO_DEAL", category: "Deals", name: "Duo Deal", price: 1699, type: "deal",
      description: "2 Zinger Burgers, 2 regular fries and 2 drinks. Perfect for two.",
      keywords: ["duo", "deal for two", "couple deal", "2 zinger deal"],
      groups: [
        { name: "Drinks (choose 2)", min: 2, max: 2, allow_repeat: true, modifiers: DRINK.modifiers },
        { ...CUSTOMISE, name: "Burger customisation (applies to both)" },
      ],
    },
    {
      id: "P_WINGS_COMBO", category: "Deals", name: "Wings Combo", price: 799, type: "deal",
      description: "6 hot wings, regular fries and a drink.", keywords: ["wings combo", "wings deal", "wings meal"],
      groups: [DRINK, SPICE],
    },
    {
      id: "P_ZINGER_BOX", category: "Deals", name: "Zinger Combo Box", price: 1299, type: "deal",
      description: "Zinger Burger, 1 pc crispy chicken, regular fries, a dip and a drink.", keywords: ["combo box", "zinger box", "box meal", "zinger combo"],
      groups: [DRINK, { name: "Dip", min: 1, max: 1, modifiers: [{ name: "Garlic Dip", default: true, keywords: ["garlic"] }, { name: "BBQ Dip", keywords: ["bbq"] }, { name: "Chilli Dip", keywords: ["chilli"] }] }, CUSTOMISE],
    },
    {
      id: "P_KIDS_MEAL", category: "Deals", name: "Kids Meal", price: 650, type: "deal",
      description: "A small burger or 4 nuggets, small fries, a drink and a toy.", keywords: ["kids", "children", "kid meal", "bachon ka"],
      groups: [
        { name: "Main", min: 1, max: 1, modifiers: [{ name: "Mini Fillet Burger", keywords: ["burger", "fillet"] }, { name: "Nuggets 4 pc", keywords: ["nuggets"] }] },
        { name: "Drink", min: 1, max: 1, modifiers: [{ name: "Juice Box", default: true, keywords: ["juice"] }, { name: "Coke", keywords: ["cola"] }, { name: "Sprite" }, { name: "Mineral Water", keywords: ["water"] }] },
      ],
    },

    { id: "P_FRIES_R", category: "Sides", name: "Regular Fries", price: 250, description: "Golden crispy fries.", keywords: ["fries", "chips", "small fries", "french fries"] },
    { id: "P_FRIES_L", category: "Sides", name: "Large Fries", price: 350, description: "A big portion of golden crispy fries.", keywords: ["large fries", "big fries"] },
    { id: "P_LOADED", category: "Sides", name: "Loaded Fries", price: 450, description: "Fries topped with cheese sauce, jalapeños and crispy chicken bits.", keywords: ["loaded", "cheese fries"] },
    { id: "P_SLAW", category: "Sides", name: "Coleslaw", price: 180, description: "Creamy crunchy coleslaw.", keywords: ["slaw", "salad"] },
    { id: "P_CORN", category: "Sides", name: "Corn on the Cob", price: 220, description: "Buttered corn on the cob.", keywords: ["corn"] },
    { id: "P_NUGGETS", category: "Sides", name: "Nuggets 6 pc", price: 420, description: "Six crispy chicken nuggets.", keywords: ["nuggets"] },

    { id: "P_COKE", category: "Drinks", name: "Coke 500ml", price: 120, keywords: ["coke", "cola", "coca cola", "pepsi"] },
    { id: "P_SPRITE", category: "Drinks", name: "Sprite 500ml", price: 120, keywords: ["sprite", "7up"] },
    { id: "P_FANTA", category: "Drinks", name: "Fanta 500ml", price: 120, keywords: ["fanta", "orange"] },
    { id: "P_DIET", category: "Drinks", name: "Diet Coke 500ml", price: 120, keywords: ["diet coke", "coke zero"] },
    { id: "P_WATER", category: "Drinks", name: "Mineral Water 500ml", price: 80, keywords: ["water", "pani"] },
    { id: "P_COKE_L", category: "Drinks", name: "Coke 1.5L", price: 250, keywords: ["large coke", "big coke", "1.5 litre"] },

    { id: "P_LAVA", category: "Desserts", name: "Chocolate Lava Cake", price: 350, description: "Warm chocolate cake with a molten centre.", keywords: ["lava", "chocolate cake", "cake"] },
    { id: "P_SOFTSERVE", category: "Desserts", name: "Soft Serve", price: 150, description: "Vanilla soft-serve cone.", keywords: ["ice cream", "cone", "softy"] },
    { id: "P_BROWNIE", category: "Desserts", name: "Fudge Brownie", price: 280, description: "Rich chocolate fudge brownie.", keywords: ["brownie"] },
  ],
  branches: [
    {
      id: "BR_DHA", name: "DHA Phase 5", address: "Sector CCA, Phase 5, DHA, Lahore", lat: 31.4680, lng: 74.4000, radius_km: 6, phone: "042-111-000-001",
      zones: [{ max_km: 3, fee: 120, eta_min: 25, eta_max: 35 }, { max_km: 5, fee: 180, eta_min: 30, eta_max: 40 }, { max_km: 6, fee: 250, eta_min: 40, eta_max: 55 }],
    },
    {
      id: "BR_GULBERG", name: "Gulberg", address: "Main Boulevard, Gulberg III, Lahore", lat: 31.5160, lng: 74.3500, radius_km: 6, phone: "042-111-000-002",
      unavailable: ["P_ZINGER", "P_ZINGER_MEAL"],
      zones: [{ max_km: 3, fee: 120, eta_min: 25, eta_max: 35 }, { max_km: 5, fee: 180, eta_min: 30, eta_max: 40 }, { max_km: 6, fee: 250, eta_min: 40, eta_max: 55 }],
    },
    {
      id: "BR_JOHAR", name: "Johar Town", address: "Block G1, Johar Town, Lahore", lat: 31.4700, lng: 74.2730, radius_km: 7, phone: "042-111-000-003",
      unavailable: ["P_LAVA"],
      zones: [{ max_km: 3, fee: 120, eta_min: 25, eta_max: 35 }, { max_km: 5, fee: 180, eta_min: 30, eta_max: 45 }, { max_km: 7, fee: 250, eta_min: 40, eta_max: 55 }],
    },
  ],
  areas: LAHORE_AREAS,
  promotions: [
    { id: "PR_SAVE20", code: "SAVE20", name: "SAVE20 — 20% off", description: "20% off orders over Rs 1,500 (max Rs 500 off). One use per customer.", type: "percent", value: 20, min_subtotal: 1500, max_discount: 500, per_customer_limit: 1 },
    { id: "PR_FREEDEL", code: "FREEDEL", name: "Free delivery", description: "Free delivery on orders over Rs 1,000.", type: "free_delivery", min_subtotal: 1000, fulfilment_scope: "delivery" },
    { id: "PR_FAMILY10", code: "FAMILY10", name: "10% off deals", description: "10% off any item from the Deals menu.", type: "percent", value: 10, category_scope: ["Deals"] },
    { id: "PR_OLD", code: "EID15", name: "Eid special", description: "15% off (expired).", type: "percent", value: 15, ends_at: "2026-06-30T00:00:00.000Z" },
  ],
  upsell_rules: [
    { id: "UP_MEAL", name: "Make it a meal", suggest: "P_ZINGER_MEAL", priority: 10, pitch: "make that Zinger a meal with fries and a drink for Rs 400 more", trigger: { cart_has_product: "P_ZINGER", cart_lacks_category: "Meals" } },
    { id: "UP_MEAL_SPICY", name: "Make it a meal (spicy)", suggest: "P_SPICY_MEAL", priority: 10, pitch: "make that a meal with fries and a drink for Rs 400 more", trigger: { cart_has_product: "P_SPICY", cart_lacks_category: "Meals" } },
    { id: "UP_WINGS", name: "Add wings", suggest: "P_WINGS6", priority: 8, pitch: "add 6 Hot Wings for Rs 499", trigger: { cart_has_category: "Meals", cart_lacks_category: "Chicken" } },
    { id: "UP_FRIES", name: "Add fries", suggest: "P_FRIES_R", priority: 6, pitch: "add Regular Fries for Rs 250", trigger: { cart_has_category: "Burgers", cart_lacks_category: "Sides" } },
    { id: "UP_DESSERT", name: "Dessert", suggest: "P_LAVA", priority: 4, pitch: "finish with a Chocolate Lava Cake for Rs 350", trigger: { min_subtotal: 2000, cart_lacks_category: "Desserts" } },
  ],
  demo_customers: [
    {
      phone: "923001234567", name: "Ahmed", address: { text: "House 12, Street 4, DHA Phase 6, Lahore", area: "DHA Phase 6" },
      past_orders: [
        { days_ago: 3, fulfilment: "delivery", branch: "BR_DHA", items: [{ product: "P_SPICY_MEAL", quantity: 2, modifiers: ["Coke"] }, { product: "P_FRIES_L" }] },
        { days_ago: 10, fulfilment: "delivery", branch: "BR_DHA", items: [{ product: "P_FAMILY_BUCKET", modifiers: ["Regular Fries", "Coleslaw", "Coke 1.5L"] }] },
        { days_ago: 17, fulfilment: "pickup", branch: "BR_DHA", items: [{ product: "P_ZINGER", quantity: 2, modifiers: ["No Mayo"] }, { product: "P_COKE", quantity: 2 }] },
      ],
    },
    { phone: "923219876543", name: "Sara" },
  ],
  history: { days: 7, orders_per_day: 60, whatsapp_share: 0.22 },
};
