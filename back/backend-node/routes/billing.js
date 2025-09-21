const express = require("express");
const router = express.Router();
const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const { getPriceId: getConfigPriceId } = require("../config/pricing");

// Validate required Stripe environment variables on startup
const REQUIRED_STRIPE_ENVS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_STARTER_MONTHLY_PRICE_ID',
  'STRIPE_STARTER_YEARLY_PRICE_ID',
  'STRIPE_CREATOR_MONTHLY_PRICE_ID',
  'STRIPE_CREATOR_YEARLY_PRICE_ID'
];

const validateStripeConfig = () => {
  const missing = REQUIRED_STRIPE_ENVS.filter(env => !process.env[env]);
  if (missing.length > 0) {
    console.error("❌ Missing required Stripe environment variables:", missing);
    console.error("💡 Run: scripts/update-ssm-parameters.sh list");
    console.error("💡 Then: scripts/deploy-single-container.sh");
    return false;
  }
  console.log("✅ All Stripe environment variables configured");
  return true;
};

// Run validation on module load
validateStripeConfig();

router.get("/health", (req, res) => res.json({ ok: true, at: "/api/billing" }));

router.get("/_config", (req, res) => {
  const config = {
    STRIPE_STARTER_MONTHLY_PRICE_ID: process.env.STRIPE_STARTER_MONTHLY_PRICE_ID || "MISSING",
    STRIPE_STARTER_YEARLY_PRICE_ID: process.env.STRIPE_STARTER_YEARLY_PRICE_ID || "MISSING",
    STRIPE_CREATOR_MONTHLY_PRICE_ID: process.env.STRIPE_CREATOR_MONTHLY_PRICE_ID || "MISSING",
    STRIPE_CREATOR_YEARLY_PRICE_ID: process.env.STRIPE_CREATOR_YEARLY_PRICE_ID || "MISSING",
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ? "SET" : "MISSING"
  };
  
  // Log missing environment variables for debugging
  const missing = Object.entries(config).filter(([key, value]) => value === "MISSING").map(([key]) => key);
  if (missing.length > 0) {
    console.error("❌ Missing Stripe environment variables:", missing);
  }
  
  res.json(config);
});

/**
 * POST /api/billing/get-price-id
 * body: { plan: 'starter'|'creator', cycle: 'monthly'|'yearly' }
 * returns: { priceId }
 */
router.post("/get-price-id", (req, res) => {
  let { plan, cycle } = req.body || {};
  plan = String(plan || "").toLowerCase();
  cycle = String(cycle || "").toLowerCase();

  const VARS = {
    starter: { monthly: "STRIPE_STARTER_MONTHLY_PRICE_ID", yearly: "STRIPE_STARTER_YEARLY_PRICE_ID" },
    creator: { monthly: "STRIPE_CREATOR_MONTHLY_PRICE_ID", yearly: "STRIPE_CREATOR_YEARLY_PRICE_ID" },
  };

  const varName = VARS?.[plan]?.[cycle];
  console.log("[get-price-id] plan:", plan, "cycle:", cycle, "varName:", varName,
              "value:", varName ? process.env[varName] : "(n/a)");

  if (!varName) return res.status(400).json({ error: `Unsupported plan/cycle: ${plan}/${cycle}` });

  const priceId = process.env[varName];
  if (!priceId) {
    console.error(`❌ Missing Stripe price ID: ${varName} for ${plan}/${cycle}`);
    return res.status(400).json({ 
      error: `No price configured for ${plan}/${cycle}. Missing env: ${varName}`,
      plan,
      cycle,
      varName,
      suggestion: "Check SSM parameters and deployment configuration"
    });
  }

  console.log(`✅ Price ID found: ${plan}/${cycle} → ${priceId.slice(0, 20)}...`);
  return res.json({ priceId });
});

// POST /api/billing/create-checkout-session
router.post("/create-checkout-session", async (req, res) => {
  try {
    const { priceId, promoCode, clerkUserId, plan, billingCycle, customerId } = req.body;

    if (!priceId) return res.status(400).json({ error: "Price ID required" });

    // (Optional) validate & pre-apply a promotion code so the UI never says "invalid"
    let discounts = [];
    if (promoCode) {
      const promos = await stripe.promotionCodes.list({ code: promoCode, active: true, limit: 1, expand: ["data.coupon.applies_to"] });
      if (!promos.data[0]) return res.status(400).json({ error: "Invalid or inactive promotion code" });
      discounts = [{ promotion_code: promos.data[0].id }];
    }

    // If you already saved Stripe customer for the user, pass it to avoid dupes
    // Otherwise omit `customer` and use customer_email below
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],        // ✅ proper array
      allow_promotion_codes: true,                           // ✅ boolean
      discounts,                                             // optional pre-apply
      subscription_data: {
        trial_period_days: 3,                                // ✅ integer
        metadata: { clerkUserId, plan, billingCycle }        // carry plan/cycle
      },
      metadata: { clerkUserId, plan, billingCycle },         // defensive copy
      client_reference_id: clerkUserId || undefined,         // easy join later
      // If you have the authed user's email, send it to create/attach a Customer
      // (Do NOT block if missing)
      customer: customerId || undefined,
      success_url: `https://reelpostly.com/app?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://reelpostly.com/pricing`,
    });

    return res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error("❌ create-checkout-session error:", err);
    return res.status(500).json({ error: err.message || "Failed to create checkout session" });
  }
});

// GET /api/billing/checkout-session - for welcome message
router.get("/checkout-session", async (req, res) => {
  try {
    const { session_id } = req.query;
    
    if (!session_id) {
      return res.status(400).json({ error: "Session ID required" });
    }

    // Get session from Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id);
    
    // Get subscription details if available
    let subscriptionStatus = "unknown";
    let plan = session.metadata?.plan || "unknown";
    let billingCycle = session.metadata?.billingCycle || "monthly";

    if (session.subscription) {
      const subscription = await stripe.subscriptions.retrieve(session.subscription);
      subscriptionStatus = subscription.status;
    }

    res.json({
      sessionId: session.id,
      subscriptionStatus,
      plan,
      billingCycle,
      paymentStatus: session.payment_status
    });

  } catch (error) {
    console.error("❌ Error getting checkout session:", error.message);
    res.status(500).json({ error: "Failed to get checkout session" });
  }
});

module.exports = router;