/**
 * Golden Bun — a fictional burger chain in the style of a global QSR giant (think Big Mac, Happy Meal, McFlurry).
 * Nothing here references a real brand; it exists to show the engine on a McDonald's-shaped menu.
 */
import { LAHORE_AREAS } from "./lahore-areas.js";
import type { SeedGroup, SeedProduct, TenantSeed } from "./types.js";

const MEAL_SIZE: SeedGroup = {
  name: "Meal size", min: 1, max: 1,
  modifiers: [
    { name: "Regular", default: true, keywords: ["small", "normal", "standard"] },
    { name: "Medium", delta: 150, keywords: ["mid"] },
    { name: "Large", delta: 250, keywords: ["big", "upsize", "large size", "bara"] },
  ],
};
const DRINK: SeedGroup = {
  name: "Drink", min: 1, max: 1,
  modifiers: [
    { name: "Coke", keywords: ["coca cola", "cola", "pepsi"] },
    { name: "Sprite", keywords: ["7up", "lemon"] },
    { name: "Fanta", keywords: ["orange"] },
    { name: "Diet Coke", keywords: ["coke zero", "zero", "diet"] },
    { name: "Iced Tea", keywords: ["tea", "lemon tea"] },
    { name: "Mineral Water", keywords: ["water", "pani"] },
  ],
};
const CUSTOMISE: SeedGroup = {
  name: "Customise", min: 0, max: 4,
  modifiers: [
    { name: "No Pickles", keywords: ["without pickles", "no pickle"] },
    { name: "No Onion", keywords: ["without onion", "no onions", "pyaz nahi"] },
    { name: "No Sauce", keywords: ["without sauce", "plain", "no mayo"] },
    { name: "Extra Cheese", delta: 80, keywords: ["cheese", "add cheese"] },
    { name: "Extra Patty", delta: 250, keywords: ["double patty", "extra meat"] },
  ],
};
const SAUCES = (max: number): SeedGroup => ({
  name: `Dipping sauces (up to ${max})`, min: 0, max, allow_repeat: true,
  modifiers: [
    { name: "BBQ", keywords: ["barbecue", "bbq sauce"] }, { name: "Sweet & Sour", keywords: ["sweet and sour", "sweet sour"] },
    { name: "Honey Mustard", keywords: ["mustard", "honey"] }, { name: "Ranch", keywords: ["ranch sauce"] }, { name: "Hot Sauce", keywords: ["chilli", "spicy sauce"] },
  ],
});
const burger = (id: string, name: string, price: number, description: string, keywords: string[] = []): SeedProduct => ({ id, category: "Burgers", name, price, description, keywords, groups: [CUSTOMISE] });
const meal = (id: string, name: string, price: number, description: string, keywords: string[] = []): SeedProduct => ({ id, category: "Meals", name, price, description, keywords, tags: ["meal"], groups: [MEAL_SIZE, DRINK, CUSTOMISE] });

export const GOLDENBUN: TenantSeed = {
  restaurant: {
    id: "REST_GOLDENBUN", slug: "goldenbun", name: "Golden Bun", tagline: "Feel-good food, fast.", currency: "Rs", tax_rate: 0.05, emoji: "🍔",
    whatsapp_phone_number_id: "DEMO_PNID_GOLDENBUN",
    persona: "Upbeat, efficient and family-friendly, like the best drive-thru crew member. Short sentences. At most one emoji per message. Great with kids' orders and big family orders.",
    theme: { primary: "#d4a10a", secondary: "#b91c1c", on_primary: "#1a1a1a", logo_text: "Golden Bun" },
    greeting: "Hey there 🍔 Welcome to Golden Bun! What are we making for you today?",
  },
  categories: ["Burgers", "Meals", "Chicken & Nuggets", "Breakfast", "Sides", "Desserts", "Drinks", "Deals"],
  products: [
    burger("GB_BIGSTACK", "Big Stack", 850, "Two beef patties, special sauce, lettuce, cheese, pickles and onion on a triple-decker sesame bun.", ["big stack", "double beef", "signature"]),
    burger("GB_QUARTER", "Quarter Grill with Cheese", 900, "A quarter-pound flame-grilled beef patty with two slices of cheese, onion, pickles and ketchup.", ["quarter", "quarter pounder", "qp", "grill"]),
    burger("GB_CRISPYCHK", "Crispy Chicken Sandwich", 650, "Crispy chicken fillet with lettuce and creamy mayo.", ["crispy chicken", "chicken sandwich", "chicken burger"]),
    burger("GB_SPICYCHK", "Spicy Crispy Chicken", 680, "Crispy chicken fillet with a spicy kick, lettuce and mayo.", ["spicy chicken", "spicy"]),
    burger("GB_FISH", "Fish Fillet", 600, "Fried fish fillet with tartar sauce and cheese on a steamed bun.", ["fish", "fillet o fish", "fish burger"]),
    burger("GB_CHEESE", "Cheeseburger", 350, "Beef patty, cheese, pickles, onion, ketchup and mustard.", ["cheeseburger", "cheese burger", "small burger"]),
    burger("GB_DBLCHEESE", "Double Cheeseburger", 550, "Two beef patties, two slices of cheese, pickles and onion.", ["double cheese", "double cheeseburger"]),
    burger("GB_VEGGIE", "Veggie Burger", 500, "Crispy vegetable patty with lettuce, tomato and herb mayo.", ["veggie", "vegetarian", "veg burger"]),

    meal("GB_BIGSTACK_MEAL", "Big Stack Meal", 1250, "Big Stack + fries + drink.", ["big stack meal", "big stack combo"]),
    meal("GB_QUARTER_MEAL", "Quarter Grill Meal", 1300, "Quarter Grill with Cheese + fries + drink.", ["quarter meal", "quarter pounder meal", "qp meal"]),
    meal("GB_CRISPYCHK_MEAL", "Crispy Chicken Meal", 1000, "Crispy Chicken Sandwich + fries + drink.", ["chicken meal", "crispy chicken meal", "chicken sandwich meal"]),
    meal("GB_SPICYCHK_MEAL", "Spicy Crispy Chicken Meal", 1030, "Spicy Crispy Chicken + fries + drink.", ["spicy chicken meal", "spicy meal"]),
    meal("GB_FISH_MEAL", "Fish Fillet Meal", 950, "Fish Fillet + fries + drink.", ["fish meal"]),
    meal("GB_DBLCHEESE_MEAL", "Double Cheeseburger Meal", 850, "Double Cheeseburger + fries + drink.", ["double cheeseburger meal", "cheeseburger meal"]),

    { id: "GB_NUG6", category: "Chicken & Nuggets", name: "Chicken Nuggets 6 pc", price: 450, description: "Six golden chicken nuggets.", keywords: ["nuggets", "6 nuggets", "six nuggets", "nuggets 6"], groups: [SAUCES(2)] },
    { id: "GB_NUG9", category: "Chicken & Nuggets", name: "Chicken Nuggets 9 pc", price: 650, description: "Nine golden chicken nuggets.", keywords: ["9 nuggets", "nine nuggets"], groups: [SAUCES(3)] },
    { id: "GB_NUG20", category: "Chicken & Nuggets", name: "Chicken Nuggets 20 pc", price: 1300, description: "Twenty golden chicken nuggets for sharing.", keywords: ["20 nuggets", "twenty nuggets", "sharebox", "nuggets box"], groups: [SAUCES(4)] },
    { id: "GB_WINGS", category: "Chicken & Nuggets", name: "Spicy Wings 5 pc", price: 480, description: "Five spicy, crispy wings.", keywords: ["wings", "spicy wings"], groups: [SAUCES(2)] },

    { id: "GB_MUFFIN", category: "Breakfast", name: "Morning Muffin", price: 450, description: "Egg, cheese and a sausage patty on a toasted muffin. Served till 11am.", keywords: ["muffin", "egg muffin", "breakfast muffin", "sausage muffin"] },
    { id: "GB_HOTCAKES", category: "Breakfast", name: "Hotcakes", price: 480, description: "Three fluffy hotcakes with butter and syrup. Served till 11am.", keywords: ["pancakes", "hotcakes", "hot cakes"] },
    { id: "GB_HASHBROWN", category: "Breakfast", name: "Hash Brown", price: 150, description: "Crispy golden hash brown.", keywords: ["hash brown", "hashbrown"] },
    {
      id: "GB_BFAST_COMBO", category: "Deals", name: "Breakfast Combo", price: 650, type: "deal", description: "Morning Muffin or Hotcakes, a hash brown and a hot drink.", keywords: ["breakfast combo", "breakfast deal", "breakfast meal"],
      groups: [
        { name: "Main", min: 1, max: 1, modifiers: [{ name: "Morning Muffin", keywords: ["muffin"] }, { name: "Hotcakes", keywords: ["pancakes"] }] },
        { name: "Hot drink", min: 1, max: 1, modifiers: [{ name: "Coffee", keywords: ["americano", "black coffee"] }, { name: "Latte" }, { name: "Tea", keywords: ["chai"] }] },
      ],
    },

    { id: "GB_FRIES", category: "Sides", name: "Fries", price: 200, description: "World-famous golden fries.", keywords: ["fries", "chips", "french fries"], groups: [{ name: "Size", min: 1, max: 1, modifiers: [{ name: "Small", default: true, keywords: ["regular"] }, { name: "Medium", delta: 80 }, { name: "Large", delta: 150, keywords: ["big"] }] }] },
    { id: "GB_SALAD", category: "Sides", name: "Side Salad", price: 300, description: "Crisp greens with vinaigrette.", keywords: ["salad"] },
    { id: "GB_APPLE", category: "Sides", name: "Apple Slices", price: 120, description: "Fresh apple slices.", keywords: ["apple", "fruit"] },

    { id: "GB_SWIRL", category: "Desserts", name: "Swirl", price: 350, description: "Soft-serve ice cream swirled with your choice of mix-in.", keywords: ["swirl", "mcflurry", "flurry", "ice cream with oreo"], groups: [{ name: "Mix-in", min: 1, max: 1, modifiers: [{ name: "Oreo", keywords: ["cookie"] }, { name: "Brownie", keywords: ["chocolate brownie"] }, { name: "Caramel Crunch", keywords: ["caramel"] }] }] },
    { id: "GB_SUNDAE", category: "Desserts", name: "Sundae", price: 250, description: "Soft serve with a sauce topping.", keywords: ["sundae"], groups: [{ name: "Topping", min: 1, max: 1, modifiers: [{ name: "Chocolate", default: true }, { name: "Strawberry" }, { name: "Caramel" }] }] },
    { id: "GB_PIE", category: "Desserts", name: "Apple Pie", price: 180, description: "Crispy pie with warm apple filling.", keywords: ["pie", "apple pie"] },
    { id: "GB_CONE", category: "Desserts", name: "Soft Serve Cone", price: 120, keywords: ["cone", "ice cream", "softy"] },

    { id: "GB_COKE", category: "Drinks", name: "Coke", price: 150, keywords: ["coke", "cola", "coca cola", "pepsi"], groups: [{ name: "Size", min: 1, max: 1, modifiers: [{ name: "Regular", default: true }, { name: "Large", delta: 50 }] }] },
    { id: "GB_SPRITE", category: "Drinks", name: "Sprite", price: 150, keywords: ["sprite", "7up"], groups: [{ name: "Size", min: 1, max: 1, modifiers: [{ name: "Regular", default: true }, { name: "Large", delta: 50 }] }] },
    { id: "GB_FANTA", category: "Drinks", name: "Fanta", price: 150, keywords: ["fanta", "orange"], groups: [{ name: "Size", min: 1, max: 1, modifiers: [{ name: "Regular", default: true }, { name: "Large", delta: 50 }] }] },
    { id: "GB_ICEDTEA", category: "Drinks", name: "Iced Tea", price: 180, keywords: ["iced tea", "lemon tea"] },
    { id: "GB_COFFEE", category: "Drinks", name: "Hot Coffee", price: 250, keywords: ["coffee", "latte", "cappuccino", "americano"], groups: [{ name: "Style", min: 1, max: 1, modifiers: [{ name: "Americano", default: true, keywords: ["black"] }, { name: "Latte" }, { name: "Cappuccino" }] }] },
    { id: "GB_SHAKE", category: "Drinks", name: "Thick Shake", price: 400, keywords: ["shake", "milkshake"], groups: [{ name: "Flavour", min: 1, max: 1, modifiers: [{ name: "Chocolate" }, { name: "Vanilla" }, { name: "Strawberry" }] }] },
    { id: "GB_WATER", category: "Drinks", name: "Mineral Water", price: 80, keywords: ["water", "pani"] },

    {
      id: "GB_KIDS", category: "Deals", name: "Kids Box", price: 750, type: "deal", description: "A kids' main, a side, a drink and a surprise toy.", keywords: ["kids box", "happy meal", "kids meal", "bachon ka", "children"],
      groups: [
        { name: "Main", min: 1, max: 1, modifiers: [{ name: "Cheeseburger", keywords: ["burger"] }, { name: "Chicken Nuggets 4 pc", keywords: ["nuggets"] }, { name: "Crispy Chicken Sandwich", keywords: ["chicken sandwich"] }] },
        { name: "Side", min: 1, max: 1, modifiers: [{ name: "Small Fries", default: true, keywords: ["fries"] }, { name: "Apple Slices", keywords: ["apple", "fruit"] }] },
        { name: "Drink", min: 1, max: 1, modifiers: [{ name: "Juice Box", default: true, keywords: ["juice"] }, { name: "Milk" }, { name: "Coke", keywords: ["cola"] }, { name: "Mineral Water", keywords: ["water"] }] },
      ],
    },
    {
      id: "GB_FAMILY", category: "Deals", name: "Family Box", price: 3499, type: "deal", description: "4 burgers of your choice, 20 nuggets, 2 large fries and 4 drinks. Feeds 4-5.", keywords: ["family box", "family deal", "family meal", "box for 4"],
      groups: [
        { name: "Burgers (choose 4)", min: 4, max: 4, allow_repeat: true, modifiers: [{ name: "Big Stack", keywords: ["stack"] }, { name: "Crispy Chicken Sandwich", keywords: ["chicken", "crispy chicken"] }, { name: "Cheeseburger", keywords: ["cheese"] }, { name: "Fish Fillet", keywords: ["fish"] }] },
        { name: "Drinks (choose 4)", min: 4, max: 4, allow_repeat: true, modifiers: DRINK.modifiers },
        SAUCES(4),
      ],
    },
    {
      id: "GB_SHAREBOX", category: "Deals", name: "Share Box", price: 1799, type: "deal", description: "20 nuggets, 2 medium fries and 4 dips.", keywords: ["share box", "sharing box", "nuggets share"],
      groups: [SAUCES(4)],
    },
  ],
  branches: [
    { id: "GB_BR_GULBERG", name: "Gulberg Main Boulevard", address: "Main Boulevard, Gulberg II, Lahore", lat: 31.5180, lng: 74.3550, radius_km: 6, phone: "042-111-222-001", zones: [{ max_km: 3, fee: 99, eta_min: 20, eta_max: 30 }, { max_km: 6, fee: 149, eta_min: 30, eta_max: 45 }] },
    { id: "GB_BR_DHA", name: "DHA Phase 6", address: "Sector J, Phase 6, DHA, Lahore", lat: 31.4690, lng: 74.4280, radius_km: 6, phone: "042-111-222-002", unavailable: ["GB_HOTCAKES", "GB_SHAKE"], zones: [{ max_km: 3, fee: 99, eta_min: 20, eta_max: 30 }, { max_km: 6, fee: 149, eta_min: 30, eta_max: 45 }] },
    { id: "GB_BR_JOHAR", name: "Johar Town Emporium", address: "Emporium Mall, Johar Town, Lahore", lat: 31.4670, lng: 74.2660, radius_km: 7, phone: "042-111-222-003", zones: [{ max_km: 3, fee: 99, eta_min: 20, eta_max: 30 }, { max_km: 7, fee: 149, eta_min: 30, eta_max: 50 }] },
    { id: "GB_BR_MALL", name: "Mall Road", address: "The Mall, Lahore", lat: 31.5580, lng: 74.3300, radius_km: 5, phone: "042-111-222-004", zones: [{ max_km: 3, fee: 99, eta_min: 20, eta_max: 30 }, { max_km: 5, fee: 149, eta_min: 30, eta_max: 45 }] },
  ],
  areas: LAHORE_AREAS,
  promotions: [
    { id: "GB_PR_BIG20", code: "BIG20", name: "BIG20 — 20% off", description: "20% off orders over Rs 1,500 (max Rs 400 off). One use per customer.", type: "percent", value: 20, min_subtotal: 1500, max_discount: 400, per_customer_limit: 1 },
    { id: "GB_PR_FREEDEL", code: "FREEDEL", name: "Free delivery", description: "Free delivery on orders over Rs 1,200.", type: "free_delivery", min_subtotal: 1200, fulfilment_scope: "delivery" },
    { id: "GB_PR_NUG", code: "NUGGETS", name: "Rs 100 off nuggets", description: "Rs 100 off any Chicken & Nuggets item.", type: "fixed", value: 100, category_scope: ["Chicken & Nuggets"] },
  ],
  upsell_rules: [
    { id: "GB_UP_MEAL", name: "Make it a meal", suggest: "GB_BIGSTACK_MEAL", priority: 10, pitch: "make that Big Stack a meal with fries and a drink for Rs 400 more", trigger: { cart_has_product: "GB_BIGSTACK", cart_lacks_category: "Meals" } },
    { id: "GB_UP_MEAL_CHK", name: "Make it a meal (chicken)", suggest: "GB_CRISPYCHK_MEAL", priority: 10, pitch: "make that a meal with fries and a drink for Rs 350 more", trigger: { cart_has_product: "GB_CRISPYCHK", cart_lacks_category: "Meals" } },
    { id: "GB_UP_NUG", name: "Add nuggets", suggest: "GB_NUG6", priority: 8, pitch: "add 6 Chicken Nuggets for Rs 450", trigger: { cart_has_category: "Meals", cart_lacks_category: "Chicken & Nuggets" } },
    { id: "GB_UP_SWIRL", name: "Dessert", suggest: "GB_SWIRL", priority: 5, pitch: "finish with a Swirl for Rs 350", trigger: { min_subtotal: 1500, cart_lacks_category: "Desserts" } },
    { id: "GB_UP_PIE", name: "Apple pie", suggest: "GB_PIE", priority: 4, pitch: "add a warm Apple Pie for Rs 180", trigger: { cart_has_category: "Burgers", cart_lacks_category: "Desserts" } },
  ],
  demo_customers: [
    {
      phone: "923001234567", name: "Ahmed", address: { text: "House 12, Street 4, DHA Phase 6, Lahore", area: "DHA Phase 6" },
      past_orders: [
        { days_ago: 4, fulfilment: "delivery", branch: "GB_BR_DHA", items: [{ product: "GB_BIGSTACK_MEAL", quantity: 2, modifiers: ["Large", "Coke"] }, { product: "GB_KIDS", modifiers: ["Nuggets"] }] },
        { days_ago: 12, fulfilment: "pickup", branch: "GB_BR_GULBERG", items: [{ product: "GB_NUG20", modifiers: ["BBQ", "BBQ", "Ranch"] }, { product: "GB_FRIES", quantity: 2, modifiers: ["Large"] }] },
      ],
    },
    { phone: "923219876543", name: "Sara" },
  ],
  history: { days: 7, orders_per_day: 85, whatsapp_share: 0.2 },
};
