import type { ReplayScript } from "./replay.js";

/** Client-presentation scripts. Customer lines and replies are fixed; every tool call hits the real engine. */
export const SCRIPTS: Record<string, ReplayScript[]> = {
  kfc: [
    {
      title: "KFC — full order journey on WhatsApp",
      phone: "923001234567",
      steps: [
        { say: "Hi", reply: "Hi Ahmed 👋 Welcome back to KFC! Would you like to see the menu, or do you already know what you'd like?", note: "Returning customer recognised by phone number. The agent offers the menu instead of dumping it." },
        {
          say: "Show me the menu",
          tools: [{ name: "get_menu_overview" }],
          reply: "Here's our menu 🍗\n\n{{menu}}\n\nJust tell me what you'd like — for example \"2 Zinger combos, one large\".",
          note: "The menu comes from the backend catalogue (branch-aware: sold-out items are marked). On real WhatsApp this can also be an interactive list or a PDF.",
        },
        {
          say: "2 Zinger combos",
          tools: [{ name: "add_cart_item", input: { product: "KFC_ZINGER_COMBO", quantity: 2 } }],
          reply: "Two Zinger Combos, coming up. Which drinks would you like with them? Pepsi, 7UP, Mirinda, Pepsi Diet or Mineral Water?",
          note: "Natural language becomes a structured cart line. The backend reports the missing required option (Drink), so the agent asks exactly that.",
        },
        {
          say: "One Pepsi one 7UP",
          tools: [
            { name: "update_cart_item", input: { item: "$line[0]", add_modifiers: ["Pepsi"] } },
            { name: "update_cart_item", input: { item: "$line[0]", units: 1, add_modifiers: ["7UP"] } },
          ],
          reply: "Done:\n• 1 × Zinger Combo – Regular – Pepsi\n• 1 × Zinger Combo – Regular – 7UP\nAnything else?",
          note: "One line of 2 splits into two lines with different drinks. This is the hard part most bots get wrong.",
        },
        {
          say: "Make the 7UP one large",
          tools: [{ name: "update_cart_item", input: { item: "$line[1]", add_modifiers: ["Large"] } }],
          reply: "Upgraded the 7UP combo to Large (+Rs 200). Subtotal is Rs {{last.cart.subtotal}}. Anything else?",
          note: "Only the unit the customer meant changes. Price comes from the backend.",
        },
        {
          say: "Add 10 hot wings, and no mayo on the Pepsi one",
          tools: [
            { name: "add_cart_item", input: { product: "KFC_WINGS10" } },
            { name: "update_cart_item", input: { item: "$line[0]", add_modifiers: ["No Mayo"] } },
            { name: "get_upsell_suggestions" },
          ],
          reply: "Added Hot Wings 10 pc and removed the mayo from the Pepsi combo. Would you like to finish with a warm Chocolate Lava Cake for Rs 370?",
          note: "Two changes in one sentence, both mapped correctly. The upsell comes from a backend rule (subtotal over Rs 2,000, no dessert), not from the model.",
        },
        {
          say: "No thanks. Delivery to House 12, Street 4, DHA Phase 6",
          tools: [{ name: "set_fulfilment", input: { type: "delivery", address_text: "House 12, Street 4, DHA Phase 6, Lahore" } }],
          reply: "No problem. Your order will be prepared by {{last.branch}}. Delivery is Rs {{last.delivery_fee}}, estimated {{last.eta}}. Do you have a promo code, or shall I take you to checkout?",
          note: "Routing geocodes the area, picks the nearest open branch in range and quotes fee and ETA from the delivery zone.",
        },
        {
          say: "Apply SAVE20",
          tools: [{ name: "apply_promo_code", input: { code: "SAVE20" } }],
          reply: "SAVE20 applied 🎉 That's Rs {{last.cart.discount}} off. Your total is Rs {{last.cart.total}}. Cash on delivery or card on delivery?",
          note: "Eligibility, minimum order, cap and one-use-per-customer are checked by the backend.",
        },
        {
          say: "Cash",
          tools: [{ name: "get_checkout_summary" }],
          reply: "Please confirm your order:\n\n• 1 × Zinger Combo – Regular – Pepsi – No Mayo\n• 1 × Zinger Combo – Large – 7UP\n• 1 × Hot Wings 10 pc – Spicy\n\nSubtotal: Rs {{last.cart.subtotal}}\nDiscount (SAVE20): − Rs {{last.cart.discount}}\nTax: Rs {{last.cart.tax}}\nDelivery: Rs {{last.cart.delivery_fee}}\nTotal: Rs {{last.cart.total}}\n\nDelivery to: House 12, Street 4, DHA Phase 6, Lahore\nPayment: cash on delivery\n\nShall I place the order?",
          note: "Explicit confirmation before anything reaches the kitchen.",
        },
        {
          say: "Yes",
          tools: [{ name: "place_order", input: { payment_method: "cash", customer_confirmed: true } }],
          reply: "Your order #{{last.order_number}} is confirmed 🍗 Total Rs {{last.total}}, cash on delivery, estimated {{last.eta}}. I'll message you here as it's prepared and on its way.",
          note: "Switch to the dashboard: the order is already on the live board.",
        },
        {
          say: "Where's my order?",
          tools: [{ name: "get_order_status" }],
          reply: "Order #{{last.order_number}} is {{last.status}} at {{last.branch}}. I'll message you the moment it's out for delivery.",
        },
        {
          say: "Order my usual again",
          tools: [{ name: "get_recent_orders" }],
          reply: "Your usual is:\n• 2 × Zinger Combo (Regular / Pepsi)\n• 1 × Large Fries\nfrom {{last.orders.1.when}}. Shall I add the same again?",
          note: "Order history per customer makes repeat orders effortless.",
        },
        {
          say: "Yes but 7UP instead of Pepsi",
          tools: [
            { name: "reorder", input: { order_number: "$order[1]" } },
            { name: "update_cart_item", input: { item: "$line[0]", add_modifiers: ["7UP"] } },
          ],
          reply: "Done — 2 × Zinger Combo (Regular / 7UP) and 1 × Large Fries are in your cart, subtotal Rs {{last.cart.subtotal}}. Same delivery address?",
        },
        {
          say: "Actually I'll pick up from Gulberg",
          tools: [{ name: "set_fulfilment", input: { type: "pickup", branch: "Gulberg" } }],
          reply: "Set to pickup from KFC Gulberg — but the Zinger Combo is sold out at Gulberg right now. Would you like to pick up from KFC DHA Phase 5 instead, or switch to Mighty Zinger Combos which Gulberg has?",
          note: "Branch-level inventory: Gulberg has Zinger marked sold out (toggle it live on the Menu & branches tab).",
        },
        {
          say: "DHA then, card",
          tools: [{ name: "set_fulfilment", input: { type: "pickup", branch: "DHA" } }, { name: "get_checkout_summary" }],
          reply: "Pickup from KFC DHA Phase 5, ready about 15 minutes after you confirm:\n\n• 2 × Zinger Combo – Regular – 7UP\n• 1 × Large Fries\n\nSubtotal: Rs {{last.cart.subtotal}}\nTax: Rs {{last.cart.tax}}\nTotal: Rs {{last.cart.total}}\nPay by card at the counter.\n\nShall I place the order?",
        },
        {
          say: "Confirm",
          tools: [{ name: "place_order", input: { payment_method: "card", customer_confirmed: true } }],
          reply: "Order #{{last.order_number}} confirmed for pickup at KFC DHA Phase 5 🍗 Total Rs {{last.total}}. I'll message you when it's ready.",
        },
        {
          say: "Mujhe kisi insaan se baat karni hai",
          tools: [{ name: "request_human_agent", input: { reason: "Customer asked for a person" } }],
          reply: "Zaroor. I've passed this chat to a team member — they'll reply right here shortly.",
          note: "Roman Urdu understood. Human handoff shows on the dashboard.",
        },
      ],
    },
  ],
  crunchbird: [
    {
      title: "Full order journey (KFC-style chain)",
      phone: "923001234567",
      steps: [
        { say: "Hi", reply: "Hi Ahmed 👋 Welcome back to CrunchBird! What can I get for you today?", note: "Returning customer is recognised by phone number. No menu dump, just a greeting." },
        {
          say: "2 spicy chicken burger meals",
          tools: [{ name: "add_cart_item", input: { product: "P_SPICY_MEAL", quantity: 2 } }],
          reply: "Two Spicy Chicken Meals, coming up. Which drinks would you like with them? Coke, Sprite, Fanta, Diet Coke or Mineral Water?",
          note: "Natural language becomes a structured cart line. The backend reports the missing required option (Drink), so the agent asks exactly that.",
        },
        {
          say: "One Coke one Sprite",
          tools: [
            { name: "update_cart_item", input: { item: "$line[0]", add_modifiers: ["Coke"] } },
            { name: "update_cart_item", input: { item: "$line[0]", units: 1, add_modifiers: ["Sprite"] } },
          ],
          reply: "Done:\n• 1 × Spicy Chicken Meal – Regular – Coke\n• 1 × Spicy Chicken Meal – Regular – Sprite\nAnything else?",
          note: "Watch the cart panel: one line of 2 splits into two lines with different drinks. This is the hard part most bots get wrong.",
        },
        {
          say: "Make the Sprite one large",
          tools: [{ name: "update_cart_item", input: { item: "$line[1]", add_modifiers: ["Large"] } }],
          reply: "Upgraded the Sprite meal to Large (+Rs 200). Subtotal is Rs {{last.cart.subtotal}}. Anything else?",
          note: "Only the unit the customer meant changes. Price comes from the backend.",
        },
        {
          say: "Add 6 hot wings, and no mayo on the Coke meal",
          tools: [
            { name: "add_cart_item", input: { product: "P_WINGS6" } },
            { name: "update_cart_item", input: { item: "$line[0]", add_modifiers: ["No Mayo"] } },
            { name: "get_upsell_suggestions" },
          ],
          reply: "Added 6 Hot Wings and removed the mayo from the Coke meal. Would you like to finish with a warm Chocolate Lava Cake for Rs 350?",
          note: "Two changes in one sentence, both mapped correctly. The upsell comes from a backend rule (subtotal over Rs 2,000 and no dessert), not from the model.",
        },
        {
          say: "No thanks. Delivery to House 12, Street 4, DHA Phase 6",
          tools: [{ name: "set_fulfilment", input: { type: "delivery", address_text: "House 12, Street 4, DHA Phase 6, Lahore" } }],
          reply: "No problem. Your order will be prepared by our {{last.branch}} branch. Delivery is Rs {{last.delivery_fee}}, estimated {{last.eta}}. Do you have a promo code, or shall I take you to checkout?",
          note: "The routing engine geocodes the area, picks the nearest open branch in range and quotes fee and ETA from the delivery zone.",
        },
        {
          say: "Apply SAVE20",
          tools: [{ name: "apply_promo_code", input: { code: "SAVE20" } }],
          reply: "SAVE20 applied 🎉 That's Rs {{last.cart.discount}} off. Your total is Rs {{last.cart.total}}. Cash on delivery or card on delivery?",
          note: "Eligibility, minimum order, cap and one-use-per-customer are all checked by the backend. Try the same code later and it is refused.",
        },
        {
          say: "Cash",
          tools: [{ name: "get_checkout_summary" }],
          reply: "Please confirm your order:\n\n• 1 × Spicy Chicken Meal – Regular – Coke – No Mayo\n• 1 × Spicy Chicken Meal – Large – Sprite\n• 1 × Hot Wings 6 pc – Spicy\n\nSubtotal: Rs {{last.cart.subtotal}}\nDiscount (SAVE20): − Rs {{last.cart.discount}}\nTax: Rs {{last.cart.tax}}\nDelivery: Rs {{last.cart.delivery_fee}}\nTotal: Rs {{last.cart.total}}\n\nDelivery to: House 12, Street 4, DHA Phase 6, Lahore\nPayment: cash on delivery\n\nShall I place the order?",
          note: "Explicit confirmation before anything is sent to the kitchen. No expensive misunderstandings.",
        },
        {
          say: "Yes",
          tools: [{ name: "place_order", input: { payment_method: "cash", customer_confirmed: true } }],
          reply: "Your order #{{last.order_number}} is confirmed 🍗 Total Rs {{last.total}}, cash on delivery, estimated {{last.eta}}. I'll message you here as it's prepared and on its way.",
          note: "Switch to the dashboard: the order is already on the live board. Click → Preparing, → Ready, → Rider assigned and watch the WhatsApp updates arrive.",
        },
        {
          say: "Where's my order?",
          tools: [{ name: "get_order_status" }],
          reply: "Order #{{last.order_number}} is {{last.status}} at our {{last.branch}} branch. I'll message you the moment it's out for delivery.",
          note: "Status comes from the order engine. Advance the order on the dashboard first to show a different answer.",
        },
        {
          say: "Order my usual again",
          tools: [{ name: "get_recent_orders" }],
          reply: "Your usual is:\n• 2 × Spicy Chicken Meal (Regular / Coke)\n• 1 × Large Fries\nfrom {{last.orders.1.when}}. Shall I add the same again?",
          note: "Order history per customer. This is the feature that makes conversational ordering faster than an app.",
        },
        {
          say: "Yes but Sprite instead of Coke",
          tools: [
            { name: "reorder", input: { order_number: "$order[1]" } },
            { name: "update_cart_item", input: { item: "$line[0]", add_modifiers: ["Sprite"] } },
          ],
          reply: "Done — 2 × Spicy Chicken Meal (Regular / Sprite) and 1 × Large Fries are in your cart, subtotal Rs {{last.cart.subtotal}}. Same delivery address?",
          note: "A previous order is rebuilt into a fresh cart and then edited in one go.",
        },
        {
          say: "Actually make those Zinger meals, and I'll pick up from Gulberg",
          tools: [
            { name: "remove_cart_item", input: { item: "$line[0]" } },
            { name: "add_cart_item", input: { product: "P_ZINGER_MEAL", quantity: 2, modifiers: ["Sprite"] } },
            { name: "set_fulfilment", input: { type: "pickup", branch: "Gulberg" } },
          ],
          reply: "Switched to 2 × Zinger Meal (Regular / Sprite) and set pickup from Gulberg — but the Zinger Meal is sold out at Gulberg right now. Would you like to pick up from DHA Phase 5 instead, or swap to Mighty Meals which Gulberg has?",
          note: "Branch-level inventory. Gulberg has Zinger marked sold out (you can toggle this live on the Menu & branches tab).",
        },
        {
          say: "Pick up from DHA then",
          tools: [{ name: "set_fulfilment", input: { type: "pickup", branch: "DHA" } }],
          reply: "Pickup from DHA Phase 5 — ready about {{last.ready_in_minutes}} minutes after you confirm. Cash or card at the counter?",
          note: "Pickup flow: no delivery fee, branch prep time drives the ETA.",
        },
        {
          say: "Card",
          tools: [{ name: "get_checkout_summary" }],
          reply: "Please confirm:\n\n• 2 × Zinger Meal – Regular – Sprite\n• 1 × Large Fries\n\nSubtotal: Rs {{last.cart.subtotal}}\nTax: Rs {{last.cart.tax}}\nTotal: Rs {{last.cart.total}}\n\nPickup from DHA Phase 5, pay by card at the counter.\n\nShall I place the order?",
        },
        {
          say: "Confirm",
          tools: [{ name: "place_order", input: { payment_method: "card", customer_confirmed: true } }],
          reply: "Order #{{last.order_number}} confirmed for pickup at DHA Phase 5 🍗 Total Rs {{last.total}}. I'll message you when it's ready.",
          note: "Second order in the same chat. The dashboard conversion and AI revenue tiles update live.",
        },
        {
          say: "Mujhe kisi insaan se baat karni hai",
          tools: [{ name: "request_human_agent", input: { reason: "Customer asked for a person" } }],
          reply: "Zaroor. I've passed this chat to a team member — they'll reply right here shortly.",
          note: "Roman Urdu understood. Human handoff: open the Conversations tab, reply as staff, then return the chat to the AI.",
        },
      ],
    },
  ],
  goldenbun: [
    {
      title: "Family order with a kids box (McDonald's-style chain)",
      phone: "923001234567",
      steps: [
        { say: "Hi", reply: "Hey Ahmed 🍔 Welcome back to Golden Bun! What are we making for you today?" },
        {
          say: "A large Big Stack meal with Coke and a kids box with nuggets",
          tools: [
            { name: "add_cart_item", input: { product: "GB_BIGSTACK_MEAL", modifiers: ["Large", "Coke"] } },
            { name: "add_cart_item", input: { product: "GB_KIDS", modifiers: ["nuggets"] } },
            { name: "get_upsell_suggestions" },
          ],
          reply: "Got it:\n• 1 × Big Stack Meal – Large – Coke\n• 1 × Kids Box – Chicken Nuggets 4 pc – Small Fries – Juice Box (toy included)\nWant to add 6 Chicken Nuggets for Rs 450 to share?",
          note: "Two products in one sentence, including a kids' bundle whose side and drink default sensibly. The nugget upsell is a backend rule.",
        },
        {
          say: "Sure, with BBQ and ranch",
          tools: [{ name: "add_cart_item", input: { product: "GB_NUG6", modifiers: ["BBQ", "Ranch"] } }],
          reply: "Added 6 Chicken Nuggets with BBQ and Ranch dips. Subtotal Rs {{last.cart.subtotal}}. Delivery or pickup?",
          note: "Multi-select dip options resolved from casual wording.",
        },
        {
          say: { lat: 31.4697, lng: 74.43, name: "DHA Phase 6" },
          tools: [{ name: "set_fulfilment", input: { type: "delivery", lat: 31.4697, lng: 74.43 } }],
          reply: "Thanks for the pin 📍 Our {{last.branch}} branch will deliver in {{last.eta}}, delivery Rs {{last.delivery_fee}}. Any promo code?",
          note: "A WhatsApp location pin is routed to the nearest branch. No typing required.",
        },
        {
          say: "BIG20",
          tools: [{ name: "apply_promo_code", input: { code: "BIG20" } }],
          reply: "BIG20 applied — Rs {{last.cart.discount}} off. Total Rs {{last.cart.total}}. Cash on delivery or card?",
        },
        {
          say: "Cash",
          tools: [{ name: "get_checkout_summary" }],
          reply: "Please confirm:\n\n• 1 × Big Stack Meal – Large – Coke\n• 1 × Kids Box – Chicken Nuggets 4 pc – Small Fries – Juice Box\n• 1 × Chicken Nuggets 6 pc – BBQ, Ranch\n\nSubtotal: Rs {{last.cart.subtotal}}\nDiscount (BIG20): − Rs {{last.cart.discount}}\nTax: Rs {{last.cart.tax}}\nDelivery: Rs {{last.cart.delivery_fee}}\nTotal: Rs {{last.cart.total}}\n\nDelivery to your shared location, cash on delivery. Place the order?",
        },
        {
          say: "Yes please",
          tools: [{ name: "place_order", input: { payment_method: "cash", customer_confirmed: true } }],
          reply: "Order #{{last.order_number}} confirmed 🍔 Total Rs {{last.total}}, arriving in {{last.eta}}. I'll keep you posted here.",
          note: "Order lands on the Golden Bun dashboard. Advance it to show live status messages.",
        },
      ],
    },
  ],
};
