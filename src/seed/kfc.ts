/**
 * KFC-branded concept tenant for pitching KFC Pakistan. Menu names follow the KFC Pakistan menu;
 * prices are indicative. Prepared by Kodevengers; not an official KFC product.
 */
import { LAHORE_AREAS } from "./lahore-areas.js";
import type { SeedGroup, SeedProduct, TenantSeed } from "./types.js";

const SIZE: SeedGroup = { name: "Size", min: 1, max: 1, modifiers: [{ name: "Regular", default: true, keywords: ["normal", "standard", "small"] }, { name: "Large", delta: 200, keywords: ["big", "upsize", "bara"] }] };
const DRINK: SeedGroup = { name: "Drink", min: 1, max: 1, modifiers: [
  { name: "Pepsi", keywords: ["coke", "cola", "coca cola"] }, { name: "7UP", keywords: ["sprite", "seven up", "lemon"] }, { name: "Mirinda", keywords: ["fanta", "orange"] },
  { name: "Pepsi Diet", keywords: ["diet", "zero", "diet coke"] }, { name: "Mineral Water", keywords: ["water", "pani"] },
] };
const CUSTOMISE: SeedGroup = { name: "Burger customisation", min: 0, max: 4, modifiers: [
  { name: "No Mayo", keywords: ["without mayo", "mayo nahi", "no sauce"] }, { name: "No Lettuce", keywords: ["no salad"] },
  { name: "Extra Cheese", delta: 100, keywords: ["cheese", "add cheese"] }, { name: "Extra Fillet", delta: 300, keywords: ["double fillet", "extra chicken", "extra patty"] },
  { name: "Extra Spicy", keywords: ["more spicy", "zyada spicy"] },
] };
const SPICE: SeedGroup = { name: "Flavour", min: 1, max: 1, modifiers: [{ name: "Spicy", default: true, keywords: ["hot"] }, { name: "Original", keywords: ["normal", "non spicy", "mild", "plain"] }] };
const burger = (id: string, name: string, price: number, description: string, keywords: string[] = []): SeedProduct => ({ id, category: "Burgers", name, price, description, keywords, groups: [CUSTOMISE] });
const combo = (id: string, name: string, price: number, description: string, keywords: string[] = []): SeedProduct => ({ id, category: "Combos", name, price, description, keywords, tags: ["meal"], groups: [SIZE, DRINK, CUSTOMISE] });

export const KFC: TenantSeed = {
  restaurant: {
    id: "REST_KFC", slug: "kfc", name: "KFC", tagline: "Finger Lickin' Good", currency: "Rs", tax_rate: 0.05, emoji: "🍗",
    whatsapp_phone_number_id: "DEMO_PNID_KFC",
    theme: { primary: "#E4002B", secondary: "#141414", on_primary: "#ffffff", logo_text: "KFC", logo_url: "/brands/kfc.svg" },
    persona: "Warm, quick and confident, like the best KFC counter staff in Lahore. Uses at most one emoji per message. Knows the KFC menu inside out and never invents items or prices.",
    greeting: "Hi 👋 Welcome to KFC! Would you like to see the menu, or do you already know what you'd like?",
  },
  categories: ["Burgers", "Combos", "Wraps & Rice", "Chicken", "Deals", "Sides", "Drinks", "Desserts"],
  products: [
    burger("KFC_ZINGER", "Zinger Burger", 720, "The original crispy spicy chicken fillet with lettuce and mayo.", ["zinger", "spicy burger", "spicy chicken burger"]),
    burger("KFC_MIGHTY_ZINGER", "Mighty Zinger", 1050, "Two Zinger fillets, cheese and jalapeños. Our biggest burger.", ["mighty zinger", "double zinger", "mighty", "big zinger"]),
    burger("KFC_ZINGER_STACKER", "Zinger Stacker", 950, "Zinger fillet stacked with a crispy patty, cheese and stacker sauce.", ["stacker", "zinger stacker"]),
    burger("KFC_KRUNCH", "Krunch Burger", 390, "Crispy chicken fillet with lettuce and mayo. Great value.", ["krunch", "crunch burger", "value burger", "small burger", "cheap burger"]),
    burger("KFC_KRUNCH_CHEESE", "Krunch Burger with Cheese", 450, "Krunch Burger with a slice of cheese.", ["krunch cheese", "krunch with cheese"]),
    burger("KFC_GRILLED", "Grilled Zinger", 780, "Flame-grilled chicken fillet with lettuce, tomato and garlic mayo.", ["grilled", "grilled zinger", "healthy"]),

    combo("KFC_ZINGER_COMBO", "Zinger Combo", 1150, "Zinger Burger + regular fries + drink.", ["zinger combo", "zinger meal", "zinger deal"]),
    combo("KFC_MIGHTY_COMBO", "Mighty Zinger Combo", 1450, "Mighty Zinger + regular fries + drink.", ["mighty zinger combo", "mighty combo", "mighty zinger meal", "mighty meal"]),
    combo("KFC_STACKER_COMBO", "Zinger Stacker Combo", 1350, "Zinger Stacker + regular fries + drink.", ["stacker combo", "stacker meal"]),
    combo("KFC_KRUNCH_COMBO", "Krunch Combo", 690, "Krunch Burger + regular fries + drink.", ["krunch combo", "krunch meal", "value meal", "cheap meal"]),
    combo("KFC_GRILLED_COMBO", "Grilled Zinger Combo", 1190, "Grilled Zinger + regular fries + drink.", ["grilled combo", "grilled meal"]),

    { id: "KFC_TWISTER", category: "Wraps & Rice", name: "Twister", price: 620, description: "Crispy chicken strips, lettuce, tomato and pepper mayo in a soft tortilla.", keywords: ["twister", "wrap", "chicken wrap"], groups: [SPICE, CUSTOMISE] },
    { id: "KFC_TWISTER_COMBO", category: "Wraps & Rice", name: "Twister Combo", price: 1050, description: "Twister + regular fries + drink.", keywords: ["twister combo", "twister meal", "wrap meal"], tags: ["meal"], groups: [SIZE, DRINK, SPICE] },
    { id: "KFC_RICE", category: "Wraps & Rice", name: "Rice & Spice", price: 690, description: "Spiced rice topped with crispy chicken chunks and sauce.", keywords: ["rice", "rice and spice", "rice bowl", "chawal"], groups: [SPICE] },
    { id: "KFC_ARABIC_RICE", category: "Wraps & Rice", name: "Arabian Rice", price: 750, description: "Fragrant rice with grilled chicken and garlic sauce.", keywords: ["arabian rice", "arabic rice", "garlic rice"] },

    { id: "KFC_WINGS10", category: "Chicken", name: "Hot Wings 10 pc", price: 690, description: "Ten crispy hot wings.", keywords: ["wings", "hot wings", "10 wings"], groups: [SPICE] },
    { id: "KFC_WINGS5", category: "Chicken", name: "Hot Wings 5 pc", price: 390, description: "Five crispy hot wings.", keywords: ["5 wings", "five wings", "small wings"], groups: [SPICE] },
    { id: "KFC_HOTSHOTS", category: "Chicken", name: "Hot Shots 12 pc", price: 490, description: "Twelve bite-sized crispy chicken pieces.", keywords: ["hot shots", "hotshots", "bites", "popcorn chicken"], groups: [SPICE] },
    { id: "KFC_CHK2", category: "Chicken", name: "Crispy Chicken 2 pc", price: 590, description: "Two pieces of bone-in crispy chicken.", keywords: ["2 piece", "2 pc chicken", "chicken pieces", "fried chicken"], groups: [SPICE] },
    { id: "KFC_CHK_CHIPS", category: "Chicken", name: "Chicken & Chips", price: 850, description: "Two pieces of crispy chicken with regular fries.", keywords: ["chicken and chips", "chicken chips", "2 pc with fries"], groups: [SPICE] },
    { id: "KFC_STRIPS", category: "Chicken", name: "Chicken Strips 5 pc", price: 650, description: "Five crispy boneless strips with a dip.", keywords: ["strips", "tenders", "boneless"], groups: [SPICE] },
    { id: "KFC_BUCKET9", category: "Chicken", name: "9 pc Bucket", price: 2490, description: "Nine pieces of bone-in crispy chicken in a bucket.", keywords: ["9 piece", "9 pc bucket", "bucket", "bucket of chicken"], groups: [SPICE] },

    {
      id: "KFC_FAMILY_FESTIVAL", category: "Deals", name: "Family Festival", price: 3290, type: "deal",
      description: "9 pieces of crispy chicken, 2 sides of your choice, 1 × 1.5L drink and optional dips. Feeds 4–5.",
      keywords: ["family festival", "family deal", "family bucket", "bucket deal", "family"],
      groups: [
        { name: "Sides (choose 2)", min: 2, max: 2, allow_repeat: true, modifiers: [{ name: "Regular Fries", keywords: ["fries", "chips"] }, { name: "Coleslaw", keywords: ["slaw", "salad"] }, { name: "Corn on the Cob", keywords: ["corn"] }, { name: "Dinner Rolls", keywords: ["rolls", "bread"] }] },
        { name: "1.5L Drink", min: 1, max: 1, modifiers: [{ name: "Pepsi 1.5L", keywords: ["pepsi", "coke", "cola"] }, { name: "7UP 1.5L", keywords: ["7up", "sprite"] }, { name: "Mirinda 1.5L", keywords: ["mirinda", "fanta", "orange"] }] },
        { name: "Extra dips", min: 0, max: 3, allow_repeat: true, modifiers: [{ name: "Garlic Dip", delta: 60, keywords: ["garlic"] }, { name: "BBQ Dip", delta: 60, keywords: ["bbq"] }, { name: "Chilli Dip", delta: 60, keywords: ["chilli", "hot sauce"] }] },
      ],
    },
    {
      id: "KFC_CRISPY_DUO", category: "Deals", name: "Crispy Duo Box", price: 1690, type: "deal", description: "2 Zinger Burgers, 2 pieces of chicken, 2 regular fries and 2 drinks.", keywords: ["crispy duo", "duo box", "deal for two", "couple deal"],
      groups: [{ name: "Drinks (choose 2)", min: 2, max: 2, allow_repeat: true, modifiers: DRINK.modifiers }, { ...CUSTOMISE, name: "Burger customisation (applies to both)" }],
    },
    {
      id: "KFC_WOW_BOX", category: "Deals", name: "Wow Box", price: 990, type: "deal", description: "Krunch Burger, 1 pc chicken, regular fries, a dip and a drink.", keywords: ["wow box", "box meal", "krunch box"],
      groups: [DRINK, { name: "Dip", min: 1, max: 1, modifiers: [{ name: "Garlic Dip", default: true, keywords: ["garlic"] }, { name: "BBQ Dip", keywords: ["bbq"] }, { name: "Chilli Dip", keywords: ["chilli"] }] }, CUSTOMISE],
    },
    {
      id: "KFC_WINGS_BUCKET", category: "Deals", name: "Wings Bucket", price: 1290, type: "deal", description: "20 hot wings, 2 regular fries and a 1.5L drink.", keywords: ["wings bucket", "wings deal", "20 wings"],
      groups: [{ name: "1.5L Drink", min: 1, max: 1, modifiers: [{ name: "Pepsi 1.5L", keywords: ["pepsi", "coke"] }, { name: "7UP 1.5L", keywords: ["7up", "sprite"] }, { name: "Mirinda 1.5L", keywords: ["mirinda", "fanta"] }] }, SPICE],
    },
    {
      id: "KFC_KIDS", category: "Deals", name: "Kids Meal", price: 690, type: "deal", description: "A Krunch Burger or 4 nuggets, small fries, a drink and a toy.", keywords: ["kids", "kids meal", "children", "bachon ka"],
      groups: [
        { name: "Main", min: 1, max: 1, modifiers: [{ name: "Krunch Burger", keywords: ["burger", "krunch"] }, { name: "Nuggets 4 pc", keywords: ["nuggets"] }] },
        { name: "Drink", min: 1, max: 1, modifiers: [{ name: "Juice Box", default: true, keywords: ["juice"] }, { name: "Pepsi", keywords: ["cola", "coke"] }, { name: "7UP", keywords: ["sprite"] }, { name: "Mineral Water", keywords: ["water"] }] },
      ],
    },

    { id: "KFC_FRIES_R", category: "Sides", name: "Regular Fries", price: 260, description: "Golden crispy fries.", keywords: ["fries", "chips", "small fries", "french fries"] },
    { id: "KFC_FRIES_L", category: "Sides", name: "Large Fries", price: 370, description: "A big portion of golden crispy fries.", keywords: ["large fries", "big fries"] },
    { id: "KFC_LOADED", category: "Sides", name: "Loaded Fries", price: 480, description: "Fries with cheese sauce, jalapeños and crispy chicken bits.", keywords: ["loaded", "cheese fries"] },
    { id: "KFC_SLAW", category: "Sides", name: "Coleslaw", price: 190, description: "Creamy crunchy coleslaw.", keywords: ["slaw", "salad"] },
    { id: "KFC_CORN", category: "Sides", name: "Corn on the Cob", price: 230, description: "Buttered corn on the cob.", keywords: ["corn"] },
    { id: "KFC_ROLLS", category: "Sides", name: "Dinner Rolls 2 pc", price: 120, description: "Soft buttered dinner rolls.", keywords: ["rolls", "bread", "dinner rolls"] },

    { id: "KFC_PEPSI", category: "Drinks", name: "Pepsi 500ml", price: 130, keywords: ["pepsi", "coke", "cola"] },
    { id: "KFC_7UP", category: "Drinks", name: "7UP 500ml", price: 130, keywords: ["7up", "sprite"] },
    { id: "KFC_MIRINDA", category: "Drinks", name: "Mirinda 500ml", price: 130, keywords: ["mirinda", "fanta", "orange"] },
    { id: "KFC_WATER", category: "Drinks", name: "Mineral Water 500ml", price: 90, keywords: ["water", "pani"] },
    { id: "KFC_PEPSI_L", category: "Drinks", name: "Pepsi 1.5L", price: 260, keywords: ["large pepsi", "big pepsi", "1.5 litre"] },

    { id: "KFC_LAVA", category: "Desserts", name: "Chocolate Lava Cake", price: 370, description: "Warm chocolate cake with a molten centre.", keywords: ["lava", "chocolate cake", "cake"] },
    { id: "KFC_SUNDAE", category: "Desserts", name: "Sundae", price: 190, description: "Soft serve with chocolate or strawberry sauce.", keywords: ["sundae", "ice cream", "softy"], groups: [{ name: "Topping", min: 1, max: 1, modifiers: [{ name: "Chocolate", default: true }, { name: "Strawberry" }] }] },
    { id: "KFC_BROWNIE", category: "Desserts", name: "Fudge Brownie", price: 290, description: "Rich chocolate fudge brownie.", keywords: ["brownie"] },
  ],
  branches: [
    { id: "KFC_BR_DHA", name: "KFC DHA Phase 5", address: "Sector CCA, Phase 5, DHA, Lahore", lat: 31.4680, lng: 74.4000, radius_km: 6, phone: "042-111-532-532", zones: [{ max_km: 3, fee: 120, eta_min: 25, eta_max: 35 }, { max_km: 5, fee: 180, eta_min: 30, eta_max: 40 }, { max_km: 6, fee: 250, eta_min: 40, eta_max: 55 }] },
    { id: "KFC_BR_GULBERG", name: "KFC Gulberg", address: "Main Boulevard, Gulberg III, Lahore", lat: 31.5160, lng: 74.3500, radius_km: 6, phone: "042-111-532-532", unavailable: ["KFC_ZINGER", "KFC_ZINGER_COMBO"], zones: [{ max_km: 3, fee: 120, eta_min: 25, eta_max: 35 }, { max_km: 5, fee: 180, eta_min: 30, eta_max: 40 }, { max_km: 6, fee: 250, eta_min: 40, eta_max: 55 }] },
    { id: "KFC_BR_JOHAR", name: "KFC Johar Town", address: "Block G1, Johar Town, Lahore", lat: 31.4700, lng: 74.2730, radius_km: 7, phone: "042-111-532-532", unavailable: ["KFC_LAVA"], zones: [{ max_km: 3, fee: 120, eta_min: 25, eta_max: 35 }, { max_km: 5, fee: 180, eta_min: 30, eta_max: 45 }, { max_km: 7, fee: 250, eta_min: 40, eta_max: 55 }] },
    { id: "KFC_BR_MALL", name: "KFC Mall Road", address: "The Mall, Lahore", lat: 31.5580, lng: 74.3300, radius_km: 5, phone: "042-111-532-532", zones: [{ max_km: 3, fee: 120, eta_min: 25, eta_max: 35 }, { max_km: 5, fee: 180, eta_min: 30, eta_max: 45 }] },
  ],
  areas: LAHORE_AREAS,
  promotions: [
    { id: "KFC_PR_SAVE20", code: "SAVE20", name: "SAVE20 — 20% off", description: "20% off orders over Rs 1,500 (max Rs 500 off). One use per customer.", type: "percent", value: 20, min_subtotal: 1500, max_discount: 500, per_customer_limit: 1 },
    { id: "KFC_PR_FREEDEL", code: "FREEDEL", name: "Free delivery", description: "Free delivery on orders over Rs 1,000.", type: "free_delivery", min_subtotal: 1000, fulfilment_scope: "delivery" },
    { id: "KFC_PR_FAMILY10", code: "FAMILY10", name: "10% off deals", description: "10% off any item from the Deals menu.", type: "percent", value: 10, category_scope: ["Deals"] },
    { id: "KFC_PR_OLD", code: "EID15", name: "Eid special", description: "15% off (expired).", type: "percent", value: 15, ends_at: "2026-06-30T00:00:00.000Z" },
  ],
  upsell_rules: [
    { id: "KFC_UP_COMBO", name: "Make it a combo", suggest: "KFC_ZINGER_COMBO", priority: 10, pitch: "make that Zinger a combo with fries and a drink for Rs 430 more", trigger: { cart_has_product: "KFC_ZINGER", cart_lacks_category: "Combos" } },
    { id: "KFC_UP_WINGS", name: "Add wings", suggest: "KFC_WINGS5", priority: 8, pitch: "add 5 Hot Wings for Rs 390", trigger: { cart_has_category: "Combos", cart_lacks_category: "Chicken" } },
    { id: "KFC_UP_FRIES", name: "Add fries", suggest: "KFC_FRIES_R", priority: 6, pitch: "add Regular Fries for Rs 260", trigger: { cart_has_category: "Burgers", cart_lacks_category: "Sides" } },
    { id: "KFC_UP_DESSERT", name: "Dessert", suggest: "KFC_LAVA", priority: 4, pitch: "finish with a Chocolate Lava Cake for Rs 370", trigger: { min_subtotal: 2000, cart_lacks_category: "Desserts" } },
  ],
  demo_customers: [
    {
      phone: "923001234567", name: "Ahmed", address: { text: "House 12, Street 4, DHA Phase 6, Lahore", area: "DHA Phase 6" },
      past_orders: [
        { days_ago: 3, fulfilment: "delivery", branch: "KFC_BR_DHA", items: [{ product: "KFC_ZINGER_COMBO", quantity: 2, modifiers: ["Pepsi"] }, { product: "KFC_FRIES_L" }] },
        { days_ago: 10, fulfilment: "delivery", branch: "KFC_BR_DHA", items: [{ product: "KFC_FAMILY_FESTIVAL", modifiers: ["Regular Fries", "Coleslaw", "Pepsi 1.5L"] }] },
        { days_ago: 17, fulfilment: "pickup", branch: "KFC_BR_DHA", items: [{ product: "KFC_ZINGER", quantity: 2, modifiers: ["No Mayo"] }, { product: "KFC_PEPSI", quantity: 2 }] },
      ],
    },
    { phone: "923219876543", name: "Sara" },
  ],
  history: { days: 7, orders_per_day: 110, whatsapp_share: 0.22 },
};
