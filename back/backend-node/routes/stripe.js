const express = require("express");
const router = express.Router();
const Stripe = require("stripe");

// ✅ Load Stripe key from .env and verify it's loading
console.log("✅ Stripe key loaded:", process.env.STRIPE_SECRET_KEY?.slice(0, 10) + "...");

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// ✅ Create a checkout session
router.post("/create-checkout-session", async (req, res) => {
  try {
    console.log("🎯 Creating checkout session...");

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: 500, // $5.00 in cents
            product_data: {
              name: "AI Caption Pack",
              description: "Generate 100 captions with AI",
            },
          },
          quantity: 1,
        },
      ],
      success_url: "http://localhost:3000/success",
      cancel_url: "http://localhost:3000/cancel",
    });

    console.log("✅ Checkout session created:", session.url);
    res.status(200).json({ url: session.url });

  } catch (err) {
    console.error("❌ Stripe error:", err.message);
    res.status(500).json({ error: "Stripe session failed" });
  }
});

module.exports = router;