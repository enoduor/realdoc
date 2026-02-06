const express = require("express");
const router = express.Router();
const Stripe = require("stripe");

// Initialize Stripe
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

if (!process.env.STRIPE_SECRET_KEY) {
  console.error("❌ STRIPE_SECRET_KEY not set");
}

// Create checkout session for SEO report (one-time payment)
router.post("/create-checkout-session", async (req, res) => {
  try {
    // Destructure with default value - if redirectPath is not provided, use "/seo-generator"
    const { formData, priceId: providedPriceId, redirectPath = "/seo-generator" } = req.body;

    // Use provided priceId or fall back to environment variable
    const priceId = providedPriceId || process.env.STRIPE_SEO_REPORT_PRICE_ID;

    if (!priceId) {
      return res.status(400).json({ 
        error: "Price ID is required. Please set STRIPE_SEO_REPORT_PRICE_ID environment variable or provide priceId in request." 
      });
    }

    if (!formData) {
      return res.status(400).json({ error: "Form data is required" });
    }
    
    // Validate based on report type (seo/analytics need website_url, documentation needs app_name, pricing/subscription doesn't need validation)
    if (redirectPath.includes("pricing") || redirectPath === "/pricing") {
      // No validation needed for subscription/pricing checkout
    } else if (redirectPath.includes("documentation")) {
      if (!formData.app_name || !formData.feature_description) {
        return res.status(400).json({ error: "Form data with app_name and feature_description is required for documentation" });
      }
    } else {
      if (!formData.website_url) {
        return res.status(400).json({ error: "Form data with website_url is required" });
      }
    }

    const frontendUrl = process.env.FRONTEND_URL || "https://app.reelpostly.com";

    // Create a subscription checkout session (we only use recurring prices)
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      payment_method_types: ["card"],
      // Enable promo codes in Checkout (Stripe Dashboard must have active coupons/promo codes)
      allow_promotion_codes: true,
      success_url: `${frontendUrl}${redirectPath}?session_id={CHECKOUT_SESSION_ID}&payment=success`,
      cancel_url: `${frontendUrl}${redirectPath}?payment=cancelled`,
      metadata: {
        type: redirectPath === "/website-analytics" 
          ? "analytics_report" 
          : redirectPath === "/documentation-generator"
          ? "documentation_report"
          : "seo_report",
        website_url: formData.website_url || formData.app_url || "",
        app_name: formData.app_name || "",
        form_data: JSON.stringify(formData),
      },
    });

    console.log("✅ SEO report checkout session created:", {
      sessionId: session.id,
      url: session.url,
    });

    return res.status(200).json({ 
      url: session.url, 
      sessionId: session.id 
    });
  } catch (err) {
    console.error("❌ Error creating SEO checkout session:", err);
    return res.status(500).json({ 
      error: err.message || "Failed to create checkout session" 
    });
  }
});

// Verify payment and return session details
router.get("/verify-session/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (session.payment_status !== "paid") {
      return res.status(400).json({ 
        error: "Payment not completed",
        paid: false 
      });
    }

    // Extract form data from metadata
    const formData = session.metadata?.form_data 
      ? JSON.parse(session.metadata.form_data)
      : null;

    return res.status(200).json({
      paid: true,
      sessionId: session.id,
      paymentStatus: session.payment_status,
      formData: formData,
    });
  } catch (err) {
    console.error("❌ Error verifying session:", err);
    return res.status(500).json({ 
      error: err.message || "Failed to verify session" 
    });
  }
});

module.exports = router;
