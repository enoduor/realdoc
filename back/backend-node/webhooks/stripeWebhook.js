// webhooks/stripeWebhook.js
const express = require("express");
const router = express.Router();
const Stripe = require("stripe");
require("dotenv").config(); // ✅ Load environment variables

// Stripe setup
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

router.post("/", express.raw({ type: "application/json" }), (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error("❌ Webhook signature error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // ✅ Handle events
  switch (event.type) {
    case "checkout.session.completed":
      const session = event.data.object;
      console.log("✅ Checkout completed:", session.id);
      // TODO: Update user payment status in database
      break;

    default:
      console.log(`📬 Unhandled event type: ${event.type}`);
  }

  res.status(200).json({ received: true });
});

module.exports = router;