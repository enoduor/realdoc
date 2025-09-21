const express = require("express");
const router = express.Router();
const Stripe = require("stripe");
const User = require("../models/User");
const { requireAuth } = require('@clerk/express');

// ✅ Load Stripe key from .env and verify it's loading
console.log("✅ Stripe key loaded:", process.env.STRIPE_SECRET_KEY?.slice(0, 10) + "...");

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Stripe price IDs (you'll need to create these in your Stripe dashboard)
const STRIPE_PRICES = {
  starter: {
    monthly: process.env.STRIPE_STARTER_MONTHLY_PRICE_ID,
    yearly: process.env.STRIPE_STARTER_YEARLY_PRICE_ID
  },
  creator: {
    monthly: process.env.STRIPE_CREATOR_MONTHLY_PRICE_ID,
    yearly: process.env.STRIPE_CREATOR_YEARLY_PRICE_ID
  },
  pro: {
    monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
    yearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID
  }
};

// ✅ Get Price ID for plan and billing cycle
router.post("/get-price-id", async (req, res) => {
  try {
    const { plan, billingCycle } = req.body;
    
    // Validate inputs
    if (!plan || !billingCycle) {
      return res.status(400).json({ error: "Plan and billing cycle required" });
    }
    
    if (!['starter', 'creator', 'pro'].includes(plan)) {
      return res.status(400).json({ error: "Invalid plan" });
    }
    
    if (!['monthly', 'yearly'].includes(billingCycle)) {
      return res.status(400).json({ error: "Invalid billing cycle" });
    }
    
    // Get Price ID from SSM environment variables
    const priceId = STRIPE_PRICES[plan][billingCycle];
    
    if (!priceId) {
      return res.status(400).json({ error: `Price not configured for ${plan} ${billingCycle}` });
    }
    
    console.log(`✅ Price ID lookup: ${plan} ${billingCycle} → ${priceId}`);
    
    res.json({ priceId });
    
  } catch (error) {
    console.error("❌ Error getting price ID:", error);
    res.status(500).json({ error: "Failed to get price ID" });
  }
});

// ✅ Create a checkout session with priceId (simple version)
router.post("/create-checkout-session", async (req, res) => {
  try {
    console.log("🎯 ===== STRIPE CHECKOUT SESSION START ======");
    console.log("📋 Request body:", JSON.stringify(req.body, null, 2));
    console.log("📋 Request headers:", JSON.stringify(req.headers, null, 2));
    console.log("📋 User from req.user:", req.user);
    console.log("📋 Auth token present:", !!req.headers.authorization);
    
    const { priceId } = req.body;
    
    if (!priceId) {
      console.log("❌ No price ID provided");
      return res.status(400).json({ error: "Price ID required" });
    }

    console.log("✅ Creating Stripe checkout session with price ID:", priceId);

    // Determine plan and billing cycle from price ID
    let plan = null;
    let billingCycle = null;
    
    // Reverse lookup from STRIPE_PRICES
    for (const [planName, prices] of Object.entries(STRIPE_PRICES)) {
      for (const [cycle, id] of Object.entries(prices)) {
        if (id === priceId) {
          plan = planName;
          billingCycle = cycle;
          break;
        }
      }
      if (plan) break;
    }

    console.log(`✅ Determined plan: ${plan}, billing cycle: ${billingCycle}`);

    // 🔍 COMPREHENSIVE LOGGING - Stripe Session Creation
    const sessionMetadata = {
      priceId: priceId,
      plan: plan,
      billingCycle: billingCycle,
      clerkUserId: req.user?.userId || null
    };
    
    console.log("📤 ===== SENDING TO STRIPE START ======");
    console.log("📤 Metadata being sent to Stripe:", JSON.stringify(sessionMetadata, null, 2));
    console.log("📤 Clerk User ID being sent:", sessionMetadata.clerkUserId);
    console.log("📤 Price ID being sent:", sessionMetadata.priceId);
    console.log("📤 Plan being sent:", sessionMetadata.plan);
    console.log("📤 Billing cycle being sent:", sessionMetadata.billingCycle);
    console.log("📤 ===== SENDING TO STRIPE END ======");

    // Create checkout session with trial
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 3, // 3-day free trial
      },
      metadata: sessionMetadata,
      success_url: `https://reelpostly.com/app?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://reelpostly.com/pricing`,
      allow_promotion_codes: true,
    });

    // 🔍 COMPREHENSIVE LOGGING - Stripe Response
    console.log("📨 ===== STRIPE RESPONSE START ======");
    console.log("📨 Stripe session created:", session.id);
    console.log("📨 Session URL:", session.url);
    console.log("📨 Customer ID:", session.customer);
    console.log("📨 Full session object:", JSON.stringify(session, null, 2));
    console.log("📨 ===== STRIPE RESPONSE END ======");

    console.log("🎯 ===== STRIPE CHECKOUT SESSION END ======");
    res.status(200).json({ 
      url: session.url,
      sessionId: session.id
    });

  } catch (err) {
    console.error("❌ Stripe error:", err.message);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

// ✅ Create a subscription checkout session with trial (legacy)
router.post("/create-subscription-session", async (req, res) => {
  try {
    console.log("🎯 Creating subscription checkout session...");
    const { plan, billingCycle } = req.body;
    const clerkUserId = req.user?.userId || 'test-user-id';

    // Validate plan and billing cycle
    if (!['starter', 'creator', 'pro'].includes(plan)) {
      return res.status(400).json({ error: "Invalid plan" });
    }
    if (!['monthly', 'yearly'].includes(billingCycle)) {
      return res.status(400).json({ error: "Invalid billing cycle" });
    }

    // Skip user lookup for direct checkout
    console.log("✅ Proceeding with direct Stripe checkout");

    const priceId = STRIPE_PRICES[plan][billingCycle];
    if (!priceId) {
      return res.status(400).json({ error: "Price not configured" });
    }

    // Create checkout session without customer (Stripe will create one)
    console.log("✅ Creating Stripe checkout session with price ID:", priceId);

    // Create checkout session with trial
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 3, // 3-day free trial
      },
      metadata: {
        plan: plan,
        billingCycle: billingCycle,
        clerkUserId: req.user?.userId || null // Include Clerk user ID if available
      },
      success_url: `https://reelpostly.com/app?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://reelpostly.com/pricing`,
      allow_promotion_codes: true,
    });

    console.log("✅ Subscription checkout session created:", session.url);
    res.status(200).json({ 
      url: session.url,
      sessionId: session.id
    });

  } catch (err) {
    console.error("❌ Stripe error:", err.message);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

// ✅ Get user subscription status (authenticated)
router.get("/subscription", requireAuth(), async (req, res) => {
  try {
    const clerkUserId = req.auth().userId;
    const user = await User.findOne({ clerkUserId });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    let subscription = null;
    if (user.stripeSubscriptionId) {
      try {
        subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
      } catch (error) {
        console.error("Error retrieving subscription:", error);
      }
    }

    const trialDaysRemaining = user.calculateTrialDaysRemaining();
    const planLimits = user.getPlanLimits();

    res.json({
      subscriptionStatus: user.subscriptionStatus,
      selectedPlan: user.selectedPlan,
      billingCycle: user.billingCycle,
      trialDaysRemaining,
      planLimits,
      stripeSubscription: subscription,
      canCreatePosts: user.canCreatePosts(),
      accountsConnected: user.accountsConnected,
      postsCreated: user.postsCreated,
      hasActiveSubscription: user.canCreatePosts()
    });

  } catch (error) {
    console.error("❌ Error getting subscription:", error);
    res.status(500).json({ error: "Failed to get subscription status" });
  }
});

// ✅ Check subscription status by session ID (no auth required)
router.get("/subscription-by-session/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    // Find user by session ID (from webhook)
    const user = await User.findOne({ 
      $or: [
        { stripeSubscriptionId: { $exists: true, $ne: null } },
        { 'subscriptionData.sessionId': sessionId }
      ]
    });

    if (!user) {
      return res.json({ hasActiveSubscription: false });
    }

    res.json({
      hasActiveSubscription: user.canCreatePosts(),
      subscriptionStatus: user.subscriptionStatus,
      selectedPlan: user.selectedPlan,
      billingCycle: user.billingCycle
    });

  } catch (error) {
    console.error("❌ Error checking subscription by session:", error);
    res.status(500).json({ error: "Failed to check subscription status" });
  }
});

// ✅ Get user subscription status by email (simple approach)
router.get("/subscription-by-email/:email", async (req, res) => {
  try {
    const { email } = req.params;
    
    // Simple email lookup
    const user = await User.findOne({ email: email });

    if (!user) {
      return res.json({ hasActiveSubscription: false });
    }

    res.json({
      hasActiveSubscription: user.canCreatePosts(),
      subscriptionStatus: user.subscriptionStatus,
      selectedPlan: user.selectedPlan,
      billingCycle: user.billingCycle,
      email: user.email
    });

  } catch (error) {
    console.error("❌ Error checking subscription by email:", error);
    res.status(500).json({ error: "Failed to check subscription status" });
  }
});

// ✅ Cancel subscription
router.post("/cancel-subscription", requireAuth(), async (req, res) => {
  try {
    const clerkUserId = req.auth().userId;
    const user = await User.findOne({ clerkUserId });

    if (!user || !user.stripeSubscriptionId) {
      return res.status(404).json({ error: "No active subscription found" });
    }

    // Cancel at period end
    const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: true
    });

    // Update user status
    user.subscriptionStatus = 'canceled';
    await user.save();

    res.json({
      success: true,
      message: "Subscription will be canceled at the end of the current period",
      cancelAt: subscription.cancel_at
    });

  } catch (error) {
    console.error("❌ Error canceling subscription:", error);
    res.status(500).json({ error: "Failed to cancel subscription" });
  }
});

// ✅ Reactivate subscription
router.post("/reactivate-subscription", requireAuth(), async (req, res) => {
  try {
    const clerkUserId = req.auth().userId;
    const user = await User.findOne({ clerkUserId });

    if (!user || !user.stripeSubscriptionId) {
      return res.status(404).json({ error: "No subscription found" });
    }

    // Reactivate subscription
    const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: false
    });

    // Update user status
    user.subscriptionStatus = subscription.status;
    await user.save();

    res.json({
      success: true,
      message: "Subscription reactivated successfully",
      subscriptionStatus: user.subscriptionStatus
    });

  } catch (error) {
    console.error("❌ Error reactivating subscription:", error);
    res.status(500).json({ error: "Failed to reactivate subscription" });
  }
});

// ✅ Update payment method
router.post("/update-payment-method", requireAuth(), async (req, res) => {
  try {
    const { paymentMethodId } = req.body;
    const clerkUserId = req.auth().userId;
    const user = await User.findOne({ clerkUserId });

    if (!user || !user.stripeCustomerId) {
      return res.status(404).json({ error: "No customer found" });
    }

    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: user.stripeCustomerId,
    });

    // Set as default payment method
    await stripe.customers.update(user.stripeCustomerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    res.json({
      success: true,
      message: "Payment method updated successfully"
    });

  } catch (error) {
    console.error("❌ Error updating payment method:", error);
    res.status(500).json({ error: "Failed to update payment method" });
  }
});

// ✅ Get billing portal URL
router.post("/billing-portal", requireAuth(), async (req, res) => {
  try {
    const clerkUserId = req.auth().userId;
    const user = await User.findOne({ clerkUserId });

    if (!user || !user.stripeCustomerId) {
      return res.status(404).json({ error: "No customer found" });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/app`,
    });

    res.json({
      url: session.url
    });

  } catch (error) {
    console.error("❌ Error creating billing portal session:", error);
    res.status(500).json({ error: "Failed to create billing portal session" });
  }
});

module.exports = router;