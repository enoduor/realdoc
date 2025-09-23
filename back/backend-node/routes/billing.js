// routes/billing.js
const express = require("express");
const router = express.Router();
const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const User = require("../models/User");

/* -------------------- Config validation -------------------- */
const REQUIRED = [
  "STRIPE_SECRET_KEY",
  "STRIPE_STARTER_MONTHLY_PRICE_ID",
  "STRIPE_STARTER_YEARLY_PRICE_ID",
  "STRIPE_CREATOR_MONTHLY_PRICE_ID",
  "STRIPE_CREATOR_YEARLY_PRICE_ID",
];

(function validateStripeEnv() {
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error("❌ Missing Stripe env vars:", missing);
  } else {
    console.log("✅ Stripe env looks good.");
  }
})();

/* -------------------- Price resolver -------------------- */
const PRICE_ENV = {
  starter: {
    monthly: process.env.STRIPE_STARTER_MONTHLY_PRICE_ID,
    yearly: process.env.STRIPE_STARTER_YEARLY_PRICE_ID,
  },
  creator: {
    monthly: process.env.STRIPE_CREATOR_MONTHLY_PRICE_ID,
    yearly: process.env.STRIPE_CREATOR_YEARLY_PRICE_ID,
  },
};

function resolvePriceId({ plan, billingCycle }) {
  const p = String(plan || "").toLowerCase();
  const c = String(billingCycle || "").toLowerCase();
  const priceId = PRICE_ENV?.[p]?.[c];
  return { priceId, p, c };
}

/* -------------------- Helpers -------------------- */
const normEmail = (e) => (e || "").trim().toLowerCase() || null;

/**
 * Ensure there is a Stripe Customer for this user (by clerkUserId).
 * If `user` is missing, create a minimal user stub so we can persist the created customer id.
 * Always returns a Stripe customer id (string).
 */
async function ensureStripeCustomerForClerkUser(clerkUserId, hintedEmail) {
  // 1) Find or create a local user record so we can store the customer id.
  let user = await User.findOne({ clerkUserId }).catch(() => null);
  if (!user) {
    user = new User({
      clerkUserId,
      email: hintedEmail ? normEmail(hintedEmail) : undefined,
      subscriptionStatus: "none",
      selectedPlan: "none",
      billingCycle: "none",
    });
  }

  // 2) If we already have a Stripe customer, return it.
  if (user.stripeCustomerId) return user.stripeCustomerId;

  // 3) Create a new Stripe customer (attach clerkUserId in metadata; add email if known)
  const customer = await stripe.customers.create({
    email: user.email || undefined,
    metadata: { clerkUserId },
  });

  user.stripeCustomerId = customer.id;
  await user.save();
  console.log("✅ Created Stripe customer for Clerk user", {
    clerkUserId,
    mongoId: user._id.toString(),
    stripeCustomerId: customer.id,
  });

  return customer.id;
}

/* -------------------- Diagnostics -------------------- */
router.get("/health", (req, res) => res.json({ ok: true, route: "/api/billing" }));

router.get("/_config", (req, res) => {
  res.json({
    STRIPE_STARTER_MONTHLY_PRICE_ID: !!process.env.STRIPE_STARTER_MONTHLY_PRICE_ID,
    STRIPE_STARTER_YEARLY_PRICE_ID: !!process.env.STRIPE_STARTER_YEARLY_PRICE_ID,
    STRIPE_CREATOR_MONTHLY_PRICE_ID: !!process.env.STRIPE_CREATOR_MONTHLY_PRICE_ID,
    STRIPE_CREATOR_YEARLY_PRICE_ID: !!process.env.STRIPE_CREATOR_YEARLY_PRICE_ID,
    STRIPE_SECRET_KEY: !!process.env.STRIPE_SECRET_KEY,
  });
});

/* -------------------- Create Checkout Session (single path) -------------------- */
/**
 * POST /api/billing/create-checkout-session
 * body:
 *  - plan: 'starter'|'creator'          (required unless priceId provided)
 *  - billingCycle: 'monthly'|'yearly'   (required unless priceId provided)
 *  - clerkUserId: string                (required)
 *  - promoCode?: string
 *  - priceId?: string                   (optional override, otherwise resolved server-side)
 *  - email?: string                     (optional hint, used only to pre-sync Stripe customer)
 */
router.post("/create-checkout-session", async (req, res) => {
  try {
    let { priceId, plan, billingCycle, clerkUserId, promoCode, email } = req.body || {};

    if (!clerkUserId) {
      return res.status(400).json({ error: "clerkUserId is required" });
    }

    // Resolve priceId server-side if not provided
    if (!priceId) {
      const r = resolvePriceId({ plan, billingCycle });
      priceId = r.priceId;
      if (!priceId) {
        return res.status(400).json({ error: `No price configured for ${r.p}/${r.c}` });
      }
    }

    // Ensure a Stripe Customer exists for this Clerk user (ALWAYS pass `customer`)
    const stripeCustomerId = await ensureStripeCustomerForClerkUser(clerkUserId, email);

    // Optional: pre-validate a promotion code to avoid "invalid" UX in Stripe Checkout
    let discounts = [];
    if (promoCode) {
      const promos = await stripe.promotionCodes.list({
        code: promoCode,
        active: true,
        limit: 1,
        expand: ["data.coupon.applies_to"],
      });
      if (!promos?.data?.[0]) {
        return res.status(400).json({ error: "Invalid or inactive promotion code" });
      }
      discounts = [{ promotion_code: promos.data[0].id }];
    }

    // Optional: pre-sync the user's email onto the Stripe Customer
    try {
      if (email) {
        const desired = normEmail(email);
        const cust = await stripe.customers.retrieve(stripeCustomerId);
        if (!cust.email || normEmail(cust.email) !== desired) {
          await stripe.customers.update(stripeCustomerId, { email: desired });
          console.log("✅ Pre-synced customer email", { stripeCustomerId, email: desired });
        }
      }
    } catch (e) {
      console.warn("⚠️ Could not pre-sync Stripe customer email:", e.message);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      discounts,
      subscription_data: {
        trial_period_days: 3,
        metadata: { clerkUserId, plan, billingCycle },
      },
      metadata: { clerkUserId, plan, billingCycle }, // duplicate for safety in webhooks
      client_reference_id: clerkUserId,              // join key in webhooks
      customer: stripeCustomerId,                    // ✅ ALWAYS pass customer
      success_url: `https://reelpostly.com/app?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://reelpostly.com/pricing`,
    });

    return res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error("❌ create-checkout-session error:", err);
    return res
      .status(500)
      .json({ error: err.message || "Failed to create checkout session" });
  }
});

/* -------------------- Read back a session -------------------- */
/**
 * GET /api/billing/checkout-session?session_id=cs_...
 */
router.get("/checkout-session", async (req, res) => {
  try {
    const { session_id } = req.query;
    if (!session_id) return res.status(400).json({ error: "Session ID required" });

    const session = await stripe.checkout.sessions.retrieve(session_id);

    let subscriptionStatus = "unknown";
    let plan = session.metadata?.plan || "unknown";
    let billingCycle = session.metadata?.billingCycle || "monthly";

    if (session.subscription) {
      const sub = await stripe.subscriptions.retrieve(session.subscription);
      subscriptionStatus = sub.status;
    }

    res.json({
      sessionId: session.id,
      subscriptionStatus,
      plan,
      billingCycle,
      paymentStatus: session.payment_status,
    });
  } catch (e) {
    console.error("❌ checkout-session error:", e.message);
    res.status(500).json({ error: "Failed to get checkout session" });
  }
});

module.exports = router;