// routes/stripe.js
const express = require("express");
const router = express.Router();
const Stripe = require("stripe");
const User = require("../models/User");
const { requireAuth } = require("@clerk/express");

// --- Stripe init & sanity log ---
const stripeKey = process.env.STRIPE_SECRET_KEY || "";
console.log("✅ Stripe key loaded:", stripeKey ? stripeKey.slice(0, 10) + "..." : "MISSING");
const stripe = Stripe(stripeKey);

// --- Price map (from SSM env) ---
const STRIPE_PRICES = {
  starter: {
    monthly: process.env.STRIPE_STARTER_MONTHLY_PRICE_ID,
    yearly: process.env.STRIPE_STARTER_YEARLY_PRICE_ID,
  },
  creator: {
    monthly: process.env.STRIPE_CREATOR_MONTHLY_PRICE_ID,
    yearly: process.env.STRIPE_CREATOR_YEARLY_PRICE_ID,
  },
  pro: {
    monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
    yearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID,
  },
};

// Utility: normalize Clerk auth accessor (supports req.auth() and req.auth)
function getClerkAuth(req) {
  try {
    if (typeof req.auth === "function") return req.auth();
    return req.auth;
  } catch {
    return undefined;
  }
}

/* =========================
 *  PRICE ID LOOKUP
 * ========================= */
router.post("/get-price-id", async (req, res) => {
  try {
    const { plan, billingCycle } = req.body || {};
    if (!plan || !billingCycle) {
      return res.status(400).json({ error: "Plan and billing cycle required" });
    }
    if (!["starter", "creator", "pro"].includes(plan)) {
      return res.status(400).json({ error: "Invalid plan" });
    }
    if (!["monthly", "yearly"].includes(billingCycle)) {
      return res.status(400).json({ error: "Invalid billing cycle" });
    }

    const priceId = STRIPE_PRICES?.[plan]?.[billingCycle];
    if (!priceId) {
      return res.status(400).json({ error: `Price not configured for ${plan} ${billingCycle}` });
    }

    console.log(`✅ Price ID lookup: ${plan} ${billingCycle} → ${priceId}`);
    return res.json({ priceId });
  } catch (err) {
    console.error("❌ Error getting price ID:", err);
    return res.status(500).json({ error: "Failed to get price ID" });
  }
});

/* =========================
 *  CHECKOUT (DIRECT BY priceId)
 * ========================= */
router.post("/create-checkout-session", async (req, res) => {
  try {
    const { priceId, email } = req.body || {};
    const auth = getClerkAuth(req);
    const clerkUserId = auth?.userId || null;

    if (!priceId) return res.status(400).json({ error: "Price ID required" });
    if (!clerkUserId) return res.status(401).json({ error: "User authentication required" });

    // reverse-lookup plan/cycle for metadata (nice-to-have)
    let plan = null;
    let billingCycle = null;
    for (const [p, cycles] of Object.entries(STRIPE_PRICES)) {
      for (const [cycle, id] of Object.entries(cycles)) {
        if (id === priceId) {
          plan = p;
          billingCycle = cycle;
          break;
        }
      }
      if (plan) break;
    }

    // ✅ FIX: Ensure a Stripe Customer exists for this Clerk user (prevents duplicate subscriptions)
    let stripeCustomerId;
    const user = await User.findOne({ clerkUserId });
    if (user && user.stripeCustomerId) {
      stripeCustomerId = user.stripeCustomerId;
      console.log("✅ Found existing Stripe customer:", stripeCustomerId);
    } else {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: email || undefined,
        metadata: { clerkUserId },
      });
      stripeCustomerId = customer.id;
      
      // Save to database
      if (user) {
        user.stripeCustomerId = stripeCustomerId;
        await user.save();
      } else {
        await User.create({
          clerkUserId,
          email: email || undefined,
          stripeCustomerId,
          subscriptionStatus: "none",
          selectedPlan: "none",
          billingCycle: "none",
        });
      }
      console.log("✅ Created new Stripe customer:", stripeCustomerId);
    }

    const sessionConfig = {
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      customer: stripeCustomerId,  // ✅ ALWAYS pass customer to prevent duplicates
      client_reference_id: clerkUserId,  // ✅ Join key for webhooks
      metadata: { clerkUserId, plan, billingCycle, priceId },
      mode: "subscription",
      subscription_data: { 
        trial_period_days: 3,
        metadata: { clerkUserId, plan, billingCycle }
      },
      success_url: `https://realdoc.com/app?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://realdoc.com/pricing`,
      allow_promotion_codes: true,
    };

    const session = await stripe.checkout.sessions.create(sessionConfig);

    console.log("✅ checkout session created:", {
      id: session.id,
      url: session.url,
      customer: stripeCustomerId,
      clerkUserId,
      plan,
      billingCycle,
    });

    return res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error("❌ Stripe error (create-checkout-session):", err);
    return res.status(500).json({ error: "Failed to create checkout session" });
  }
});

/* =========================
 *  LEGACY CHECKOUT (BY plan/cycle)
 * ========================= */
router.post("/create-subscription-session", async (req, res) => {
  try {
    const { plan, billingCycle, email } = req.body || {};
    const auth = getClerkAuth(req);
    const clerkUserId = auth?.userId || null;

    if (!["starter", "creator", "pro"].includes(plan)) {
      return res.status(400).json({ error: "Invalid plan" });
    }
    if (!["monthly", "yearly"].includes(billingCycle)) {
      return res.status(400).json({ error: "Invalid billing cycle" });
    }
    if (!clerkUserId) return res.status(401).json({ error: "User authentication required" });

    const priceId = STRIPE_PRICES?.[plan]?.[billingCycle];
    if (!priceId) return res.status(400).json({ error: "Price not configured" });

    // ✅ FIX: Ensure a Stripe Customer exists for this Clerk user (prevents duplicate subscriptions)
    let stripeCustomerId;
    const user = await User.findOne({ clerkUserId });
    if (user && user.stripeCustomerId) {
      stripeCustomerId = user.stripeCustomerId;
    } else {
      const customer = await stripe.customers.create({
        email: email || undefined,
        metadata: { clerkUserId },
      });
      stripeCustomerId = customer.id;
      
      if (user) {
        user.stripeCustomerId = stripeCustomerId;
        await user.save();
      } else {
        await User.create({
          clerkUserId,
          email: email || undefined,
          stripeCustomerId,
          subscriptionStatus: "none",
          selectedPlan: "none",
          billingCycle: "none",
        });
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      customer: stripeCustomerId,  // ✅ ALWAYS pass customer
      client_reference_id: clerkUserId,  // ✅ Join key for webhooks
      subscription_data: { 
        trial_period_days: 3,
        metadata: { plan, billingCycle, clerkUserId }
      },
      metadata: { plan, billingCycle, clerkUserId },
      success_url: `https://realdoc.com/app?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://realdoc.com/pricing`,
      allow_promotion_codes: true,
    });

    console.log("✅ subscription checkout (legacy) created:", session.id);
    return res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error("❌ Stripe error (create-subscription-session):", err);
    return res.status(500).json({ error: "Failed to create checkout session" });
  }
});

/* =========================
 *  CURRENT SUBSCRIPTION SNAPSHOT (AUTH)
 * ========================= */
router.get("/subscription", requireAuth(), async (req, res) => {
  try {
    const auth = getClerkAuth(req);
    const clerkUserId = auth?.userId;
    const user = await User.findOne({ clerkUserId });
    if (!user) return res.status(404).json({ error: "User not found" });

    let subscription = null;
    if (user.stripeSubscriptionId) {
      try {
        subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
      } catch (e) {
        console.warn("⚠️ Stripe subscription retrieve failed:", e?.message);
      }
    }

    const trialDaysRemaining =
      typeof user.calculateTrialDaysRemaining === "function"
        ? user.calculateTrialDaysRemaining()
        : 0;

    const planLimits =
      typeof user.getPlanLimits === "function" ? user.getPlanLimits() : null;

    res.json({
      subscriptionStatus: user.subscriptionStatus,
      selectedPlan: user.selectedPlan,
      billingCycle: user.billingCycle,
      trialDaysRemaining,
      planLimits,
      stripeSubscription: subscription,
      hasActiveSubscription:
        typeof user.canCreatePosts === "function"
          ? user.canCreatePosts()
          : ["active", "trialing", "past_due"].includes(user.subscriptionStatus),
      accountsConnected: user.accountsConnected,
      postsCreated: user.postsCreated,
    });
  } catch (err) {
    console.error("❌ Error getting subscription:", err);
    return res.status(500).json({ error: "Failed to get subscription status" });
  }
});

/* =========================
 *  LOOKUP HELPERS
 * ========================= */
router.get("/subscription-by-session/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const user = await User.findOne({
      $or: [
        { stripeSubscriptionId: { $exists: true, $ne: null } },
        { "subscriptionData.sessionId": sessionId },
      ],
    });
    if (!user) return res.json({ hasActiveSubscription: false });

    return res.json({
      hasActiveSubscription:
        typeof user.canCreatePosts === "function"
          ? user.canCreatePosts()
          : ["active", "trialing", "past_due"].includes(user.subscriptionStatus),
      subscriptionStatus: user.subscriptionStatus,
      selectedPlan: user.selectedPlan,
      billingCycle: user.billingCycle,
    });
  } catch (err) {
    console.error("❌ Error subscription-by-session:", err);
    return res.status(500).json({ error: "Failed to check subscription status" });
  }
});

router.get("/subscription-by-email/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const user = await User.findOne({ email });
    if (!user) return res.json({ hasActiveSubscription: false });

    return res.json({
      hasActiveSubscription:
        typeof user.canCreatePosts === "function"
          ? user.canCreatePosts()
          : ["active", "trialing", "past_due"].includes(user.subscriptionStatus),
      subscriptionStatus: user.subscriptionStatus,
      selectedPlan: user.selectedPlan,
      billingCycle: user.billingCycle,
      email: user.email,
    });
  } catch (err) {
    console.error("❌ Error subscription-by-email:", err);
    return res.status(500).json({ error: "Failed to check subscription status" });
  }
});

/* =========================
 *  CANCEL / REACTIVATE (AUTH)
 * ========================= */
router.post("/cancel-subscription", requireAuth(), async (req, res) => {
  try {
    const auth = getClerkAuth(req);
    const clerkUserId = auth?.userId;
    const user = await User.findOne({ clerkUserId });
    if (!user || !user.stripeSubscriptionId) {
      return res.status(404).json({ error: "No active subscription found" });
    }

    const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    user.subscriptionStatus = "canceled";
    await user.save();

    return res.json({
      success: true,
      message: "Subscription will be canceled at the end of the current period",
      cancelAt: subscription.cancel_at,
    });
  } catch (err) {
    console.error("❌ Error cancel-subscription:", err);
    return res.status(500).json({ error: "Failed to cancel subscription" });
  }
});

router.post("/reactivate-subscription", requireAuth(), async (req, res) => {
  try {
    const auth = getClerkAuth(req);
    const clerkUserId = auth?.userId;
    const user = await User.findOne({ clerkUserId });
    if (!user || !user.stripeSubscriptionId) {
      return res.status(404).json({ error: "No subscription found" });
    }

    const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    user.subscriptionStatus = subscription.status;
    await user.save();

    return res.json({
      success: true,
      message: "Subscription reactivated successfully",
      subscriptionStatus: user.subscriptionStatus,
    });
  } catch (err) {
    console.error("❌ Error reactivate-subscription:", err);
    return res.status(500).json({ error: "Failed to reactivate subscription" });
  }
});

/* =========================
 *  ACTIVATE SUBSCRIPTION (END TRIAL EARLY)
 * ========================= */
router.post("/activate-subscription", requireAuth(), async (req, res) => {
  try {
    const auth = typeof req.auth === "function" ? req.auth() : req.auth;
    const clerkUserId = auth?.userId;
    if (!clerkUserId) return res.status(401).json({ error: "Not authenticated" });

    const user = await User.findOne({ clerkUserId });
    if (!user) return res.status(404).json({ error: "User not found" });
    if (!user.stripeSubscriptionId) {
      return res.status(400).json({ error: "No subscription found" });
    }

    // Only allow if currently trialing
    if (user.subscriptionStatus !== 'trialing') {
      return res.status(400).json({ error: "Subscription is not in trial period" });
    }

    console.log("🔥 Activating subscription early for user:", clerkUserId);

    // End trial immediately by setting trial_end to now
    const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
      trial_end: 'now', // End trial immediately and charge the customer
    });

    console.log("✅ Trial ended, subscription activated:", subscription.id);

    // Update user status and reset daily counters for fresh start
    user.subscriptionStatus = subscription.status;
    user.dailyPostsUsed = 0; // Reset to 0 for fresh start on paid plan
    user.dailyLimitResetAt = null; // Will be set on next check
    await user.save();

    console.log("✅ Daily counters reset for activated subscription");

    return res.json({
      success: true,
      message: "Subscription activated successfully! Your card will be charged now. Daily post limit has been reset.",
      subscriptionStatus: user.subscriptionStatus,
    });
  } catch (err) {
    console.error("❌ Error activate-subscription:", err);
    return res.status(500).json({ 
      error: err.message || "Failed to activate subscription" 
    });
  }
});

/* =========================
 *  CREDITS CHECKOUT (ONE-TIME PAYMENTS)
 *  — Creates a Stripe Checkout Session for adding API credits
 *  — Does NOT interfere with subscription flows
 * ========================= */

// Lightweight email validator (avoid passing empty/invalid to Stripe)
function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  const e = email.trim();
  if (!e) return false;
  // Simple RFC5322-ish check; Stripe only needs a reasonable format
  return /.+@.+\..+/.test(e);
}

router.post("/credits/checkout", requireAuth(), async (req, res) => {
  try {
    const { amount, successUrl, cancelUrl, email } = req.body || {};

    // Auth context via Clerk
    const auth = getClerkAuth(req);
    const clerkUserId = auth?.userId || null;
    if (!clerkUserId) return res.status(401).json({ success: false, error: "User authentication required" });

    // Validate amount (USD dollars -> cents)
    const dollars = Number(amount);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      return res.status(400).json({ success: false, error: "Invalid amount" });
    }
    const unitAmount = Math.round(dollars * 100);

    // Require redirect URLs; frontend should send back to its dashboard
    const okSuccess = typeof successUrl === 'string' && successUrl.startsWith('http');
    const okCancel = typeof cancelUrl === 'string' && cancelUrl.startsWith('http');
    if (!okSuccess || !okCancel) {
      return res.status(400).json({ success: false, error: "Missing successUrl/cancelUrl" });
    }

    // Ensure a Stripe Customer exists for this user (reuse subscription logic)
    let stripeCustomerId;
    const user = await User.findOne({ clerkUserId });
    if (user && user.stripeCustomerId) {
      stripeCustomerId = user.stripeCustomerId;
    } else {
      const customer = await stripe.customers.create({
        // Only include email if valid; else let Stripe collect on Checkout
        ...(isValidEmail(email) ? { email } : {}),
        metadata: { clerkUserId },
      });
      stripeCustomerId = customer.id;
      if (user) {
        user.stripeCustomerId = stripeCustomerId;
        await user.save();
      } else {
        await User.create({
          clerkUserId,
          email: isValidEmail(email) ? email : undefined,
          stripeCustomerId,
          subscriptionStatus: "none",
          selectedPlan: "none",
          billingCycle: "none",
        });
      }
    }

    // Create a one-time payment Checkout Session to purchase credits
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer: stripeCustomerId,
      client_reference_id: clerkUserId,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "RealDoc API Credits",
              description: "One-time purchase of API usage credits",
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      // Allow promo codes if desired
      allow_promotion_codes: true,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        clerkUserId,
        purpose: "api_credits",
        amount_usd: dollars.toString(),
      },
    });

    return res.status(200).json({ success: true, url: session.url, sessionId: session.id });
  } catch (err) {
    console.error("❌ Stripe error (credits/checkout):", err);
    // Surface Stripe message where possible for quicker debugging
    const message = err?.message || err?.raw?.message || "Failed to create credits checkout";
    return res.status(500).json({ success: false, error: message });
  }
});

/* =========================
 *  BILLING PORTAL (AUTH) — SINGLE, CONSOLIDATED
 * ========================= */
// routes/stripe.js  — replace ONLY the portal-session handler
router.post("/portal-session", requireAuth(), async (req, res) => {
  try {
    // Support both @clerk/express styles
    const auth = typeof req.auth === "function" ? req.auth() : req.auth;
    const clerkUserId = auth?.userId;
    if (!clerkUserId) return res.status(401).json({ error: "Not authenticated" });

    const user = await User.findOne({ clerkUserId });
    if (!user) return res.status(404).json({ error: "User not found in database" });
    if (!user.stripeCustomerId) {
      return res.status(409).json({
        error: "Stripe customer not found. Complete checkout first.",
      });
    }

    const returnUrl =
      (process.env.APP_URL && `${process.env.APP_URL}/app`) ||
      `${process.env.FRONTEND_URL || "https://realdoc.com"}/app`;

    const params = {
      customer: user.stripeCustomerId,
      return_url: returnUrl,
    };

    // Optional: pin to a specific portal configuration if provided
    if (process.env.STRIPE_BILLING_PORTAL_CONFIGURATION) {
      params.configuration = process.env.STRIPE_BILLING_PORTAL_CONFIGURATION; // bpc_...
    }

    const session = await stripe.billingPortal.sessions.create(params);
    return res.json({ url: session.url });
  } catch (err) {
    // Surface the exact Stripe message to help you debug in UI
    console.error("❌ portal-session error:", err);
    const msg =
      err?.message ||
      err?.raw?.message ||
      "Failed to create billing portal session";
    return res.status(500).json({ error: msg });
  }
});

module.exports = router;