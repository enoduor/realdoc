const express = require("express");
const router = express.Router();
const Stripe = require("stripe");
const User = require("../models/User");

// Initialize Stripe
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

if (!process.env.STRIPE_SECRET_KEY) {
  console.error("❌ STRIPE_SECRET_KEY not set");
}

// Create checkout session for SEO report (one-time payment)
router.post("/create-checkout-session", async (req, res) => {
  try {
    // Destructure with default value - if redirectPath is not provided, use "/seo-generator"
    const { 
      formData, 
      priceId: providedPriceId, 
      redirectPath = "/seo-generator",
      // Optional user info to help link Stripe ↔ Mongo user
      clerkUserId,
      email,
      firstName,
      lastName
    } = req.body;

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
      // Optionally prefill customer email when we have it
      customer_email: email || undefined,
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
        // Optional linkage back to app user
        clerk_user_id: clerkUserId || "",
        user_email: email || "",
        first_name: firstName || "",
        last_name: lastName || "",
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
    
    // Expand subscription & customer so we can track subscriptions in Mongo
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription", "customer"],
    });
    
    if (session.payment_status !== "paid") {
      return res.status(400).json({ 
        error: "Payment not completed",
        paid: false 
      });
    }

    // Best-effort: link this paid session to a User document for subscription tracking
    try {
      if (session.mode === "subscription") {
        const clerkUserId = session.metadata?.clerk_user_id || null;
        const email =
          session.customer_details?.email ||
          (typeof session.customer === "object" ? session.customer.email : null) ||
          session.metadata?.user_email ||
          null;
        const stripeCustomerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id || null;

        // Get subscription object (may already be expanded)
        let subscription = session.subscription || null;
        if (subscription && typeof subscription === "string") {
          subscription = await stripe.subscriptions.retrieve(subscription);
        }

        const stripeSubscriptionId = subscription ? subscription.id : null;
        const subscriptionStatus = subscription?.status || "active";
        const planItem = subscription?.items?.data?.[0];
        const interval = planItem?.plan?.interval || "monthly";

        if (stripeCustomerId) {
          const query = clerkUserId
            ? { clerkUserId }
            : { stripeCustomerId };

          await User.findOneAndUpdate(
            query,
            {
              clerkUserId: clerkUserId || undefined,
              email: email || undefined,
              stripeCustomerId,
              stripeSubscriptionId,
              subscriptionStatus,
              billingCycle: interval === "year" ? "yearly" : interval,
              lastActiveDate: new Date(),
            },
            {
              upsert: true,
              new: true,
              setDefaultsOnInsert: true,
            }
          );
        }
      }
    } catch (trackingErr) {
      // Do not break checkout flow if tracking fails
      console.error("❌ Error tracking subscription in Mongo:", trackingErr);
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
      subscriptionId: stripeSubscriptionId || null, // Include subscription ID for AI Search state consumption
    });
  } catch (err) {
    console.error("❌ Error verifying session:", err);
    return res.status(500).json({ 
      error: err.message || "Failed to verify session" 
    });
  }
});

module.exports = router;
