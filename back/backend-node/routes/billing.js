// routes/billing.js
const express = require("express");
const router = express.Router();
const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const User = require("../models/User");
const { requireAuth } = require("@clerk/express");

// Utility: normalize Clerk auth accessor (supports req.auth() and req.auth)
function getClerkAuth(req) {
  try {
    if (typeof req.auth === "function") return req.auth();
    return req.auth;
  } catch {
    return undefined;
  }
}

/* -------------------- Config validation -------------------- */
const REQUIRED = [
  "STRIPE_SECRET_KEY",
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
    STRIPE_CREATOR_MONTHLY_PRICE_ID: !!process.env.STRIPE_CREATOR_MONTHLY_PRICE_ID,
    STRIPE_CREATOR_YEARLY_PRICE_ID: !!process.env.STRIPE_CREATOR_YEARLY_PRICE_ID,
    STRIPE_SECRET_KEY: !!process.env.STRIPE_SECRET_KEY,
  });
});

/* -------------------- Create Checkout Session (single path) -------------------- */
/**
 * POST /api/billing/create-checkout-session
 * Requires: Clerk authentication (requireAuth middleware)
 * body:
 *  - plan: 'creator'                    (required unless priceId provided)
 *  - billingCycle: 'monthly'|'yearly'   (required unless priceId provided)
 *  - promoCode?: string
 *  - priceId?: string                   (optional override, otherwise resolved server-side)
 *  - email?: string                     (optional hint, used only to pre-sync Stripe customer)
 */
router.post("/create-checkout-session", requireAuth(), async (req, res) => {
  try {
    // Get clerkUserId from authenticated session (more secure than request body)
    const auth = getClerkAuth(req);
    const clerkUserId = auth?.userId || null;

    if (!clerkUserId) {
      return res.status(401).json({ error: "User authentication required" });
    }

    let { priceId, plan, billingCycle, promoCode, email } = req.body || {};

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
        return res.status(400).json({ 
          error: "This promotion code is invalid or no longer active. Please check the code and try again." 
        });
      }
      
      const promo = promos.data[0];
      const couponId = promo.coupon?.id;
      
      // Check if coupon is valid, not deleted, and not stopped
      if (couponId) {
        try {
          const coupon = await stripe.coupons.retrieve(couponId);
          
          // Check if coupon is valid (not stopped/deleted)
          if (!coupon.valid) {
            return res.status(400).json({ 
              error: "This coupon has been stopped and is no longer valid. Please contact support if you believe this is an error." 
            });
          }
          
          // Check if promotion code is active
          if (!promo.active) {
            return res.status(400).json({ 
              error: "This promotion code is no longer active. Please check the code and try again." 
            });
          }
        } catch (err) {
          // If coupon retrieval fails, it might be deleted
          if (err.code === 'resource_missing') {
            return res.status(400).json({ 
              error: "This coupon has been deleted and is no longer available. Please contact support if you believe this is an error." 
            });
          }
          // Re-throw other errors
          throw err;
        }
      }
      
      discounts = [{ promotion_code: promo.id }];
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
      success_url: `${process.env.FRONTEND_URL || 'https://realdoc.com'}/app?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || 'https://realdoc.com'}/pricing`,
    });

    console.log("✅ Checkout session created:", {
      sessionId: session.id,
      url: session.url,
      hasUrl: !!session.url,
      customer: stripeCustomerId,
      clerkUserId,
    });

    if (!session.url) {
      console.error("❌ Stripe session created but URL is missing!", {
        sessionId: session.id,
        session: JSON.stringify(session, null, 2),
      });
      return res.status(500).json({ 
        error: "Stripe checkout session created but URL is missing. Please contact support." 
      });
    }

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