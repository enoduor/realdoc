// webhooks/stripeWebhook.js
const express = require("express");
const router = express.Router();
const Stripe = require("stripe");
const User = require("../models/User");



// Initialize Stripe when needed, not at module load time
let stripe, endpointSecret;

function getStripe() {
  if (!stripe) {
    stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  }
  return { stripe, endpointSecret };
}

function logObj(label, obj) {
  try {
    console.log(label, JSON.stringify(obj, null, 2));
  } catch (e) {
    console.log(label, obj);
  }
}

/**
 * IMPORTANT MOUNT ORDER (in index.js):
 *   app.use("/webhook", require("./webhooks/stripeWebhook")); // BEFORE express.json()
 *   app.use(express.json());
 *   app.use("/api/billing", require("./routes/billing"));
 */
router.post("/", express.raw({ type: "application/json" }), (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  const { stripe, endpointSecret } = getStripe();

  console.log("🔍 [Stripe Webhook] Received webhook request");
  console.log("🔍 [Stripe Webhook] Headers:", {
    'stripe-signature': sig ? 'SET' : 'MISSING',
    'content-type': req.headers['content-type'],
    'user-agent': req.headers['user-agent']
  });
  console.log("🔍 [Stripe Webhook] Environment check:", {
    'STRIPE_WEBHOOK_SECRET': endpointSecret ? 'SET' : 'MISSING',
    'STRIPE_SECRET_KEY': process.env.STRIPE_SECRET_KEY ? 'SET' : 'MISSING'
  });

  try {
    if (!sig || !endpointSecret) {
      console.error("❌ Missing stripe-signature or STRIPE_WEBHOOK_SECRET");
      console.error("❌ Debug info:", {
        hasSignature: !!sig,
        hasEndpointSecret: !!endpointSecret,
        signatureValue: sig,
        endpointSecretValue: endpointSecret ? 'SET' : 'MISSING'
      });
      return res.status(400).send("Webhook signature missing");
    }
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error("❌ Webhook signature error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Ack immediately so Stripe doesn't retry/time out
  res.status(200).json({ received: true });

  console.log("🔍 [Stripe Webhook] Event type:", event.type);
  console.log("🔍 [Stripe Webhook] Event ID:", event.id);

  // Process asynchronously
  (async () => {
    console.log("📬 Event:", event.type, "id:", event.id);

    if (event.type?.startsWith("customer.subscription")) {
      logObj("🧾 Raw subscription event payload:", {
        id: event.data?.object?.id,
        customer: event.data?.object?.customer,
        status: event.data?.object?.status,
        metadata: event.data?.object?.metadata,
        itemsCount: event.data?.object?.items?.data?.length
      });
    }
    if (event.type === "checkout.session.completed") {
      logObj("🧾 Raw checkout.session payload:", {
        id: event.data?.object?.id,
        mode: event.data?.object?.mode,
        customer: event.data?.object?.customer,
        customer_email: event.data?.object?.customer_details?.email,
        client_reference_id: event.data?.object?.client_reference_id,
        metadata: event.data?.object?.metadata,
        subscription: event.data?.object?.subscription
      });
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        
        // Check if this is a Sora API credit purchase
        if (session.metadata?.productType === 'sora-api-credits') {
          await handleSoraApiCredits(session);
        } else if (session.metadata?.productType === 'sora-video-credits') {
          await handleSoraVideoCredits(session);
        } else {
          // Regular subscription checkout
          await upsertUserFromSession(session);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object;
        await upsertUserFromSubscription(sub);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        await markSubscriptionCanceled(sub);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        await onInvoicePaid(invoice);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        await onInvoiceFailed(invoice);
        break;
      }

      case "customer.updated": {
        const cust = event.data.object;
        await onCustomerUpdated(cust);
        break;
      }

      default:
        // ignore others
        break;
    }
  })().catch((e) => console.error("❌ Post-ack handler error:", e));
});

/* ------------------------ Helpers ------------------------ */

function normEmail(e) {
  return (e || "").trim().toLowerCase() || null;
}

// Handle Sora API credit purchases
async function handleSoraApiCredits(session) {
  try {
    const AWS = require('aws-sdk');
    const dynamodb = new AWS.DynamoDB.DocumentClient({ region: 'us-west-2' });
    const TABLE_NAME = 'reelpostly-tenants';
    
    const clerkUserId = session.client_reference_id;
    const creditsToAdd = parseInt(session.metadata?.credits || 0);
    
    if (!clerkUserId || !creditsToAdd) {
      console.error('❌ [Sora Webhook] Missing userId or credits in metadata');
      return;
    }
    
    console.log(`💳 [Sora Webhook] Processing credit purchase for user ${clerkUserId}, credits: ${creditsToAdd}`);
    
    // Find user's API keys
    const result = await dynamodb.scan({
      TableName: TABLE_NAME,
      FilterExpression: 'tenantId = :userId',
      ExpressionAttributeValues: {
        ':userId': clerkUserId
      }
    }).promise();
    
    if (result.Items.length === 0) {
      console.error(`❌ [Sora Webhook] No API keys found for user ${clerkUserId}`);
      return;
    }
    
    // Add credits to the most recent key
    const mostRecentKey = result.Items.sort((a, b) => b.createdAt - a.createdAt)[0];
    
    await dynamodb.update({
      TableName: TABLE_NAME,
      Key: { apiKeyId: mostRecentKey.apiKeyId },
      UpdateExpression: 'SET credits = credits + :credits',
      ExpressionAttributeValues: {
        ':credits': creditsToAdd
      }
    }).promise();
    
    console.log(`✅ [Sora Webhook] Added ${creditsToAdd} credits to API key ${mostRecentKey.apiKeyId}`);
  } catch (error) {
    console.error('❌ [Sora Webhook] Error adding credits:', error);
  }
}

// Handle Sora video credit purchases
async function handleSoraVideoCredits(session) {
  try {
    const clerkUserId = session.metadata?.clerkUserId || session.client_reference_id;
    const priceId = session.metadata?.priceId;

    if (!clerkUserId) {
      console.error('❌ [Sora Video Webhook] Missing clerkUserId in session metadata');
      return;
    }

    console.log(`🎬 [Sora Video Webhook] Processing Sora video credits purchase for user: ${clerkUserId}, priceId: ${priceId}`);

    // Determine credits based on price ID
    let creditsToAdd = 0;
    if (priceId === 'price_1SIyQSLPiEjYBNcQyq9gryxu') {
      creditsToAdd = 8; // $20 = 8 credits
    }

    if (creditsToAdd === 0) {
      console.error('❌ [Sora Video Webhook] Unknown price ID:', priceId);
      return;
    }

    // Find or create user
    let user = await User.findOne({ clerkUserId });
    if (!user) {
      user = await User.create({
        clerkUserId,
        email: session.customer_email || '',
        subscriptionStatus: "none",
        selectedPlan: "none",
        billingCycle: "none",
        soraVideoCredits: creditsToAdd,
      });
      console.log(`✅ [Sora Video Webhook] Created new user with ${creditsToAdd} Sora video credits`);
    } else {
      // Add credits to existing user
      const currentCredits = user.soraVideoCredits || 0;
      user.soraVideoCredits = currentCredits + creditsToAdd;
      await user.save();
      console.log(`✅ [Sora Video Webhook] Added ${creditsToAdd} Sora video credits to user. New total: ${user.soraVideoCredits}`);
    }

  } catch (error) {
    console.error('❌ [Sora Video Webhook] Error processing Sora video credits purchase:', error);
  }
}

async function findUser({ stripeCustomerId, clerkUserId, email }) {
  let user = null;

  if (stripeCustomerId) {
    user = await User.findOne({ stripeCustomerId });
    if (user) console.log("🔎 Matched user by stripeCustomerId:", stripeCustomerId, "→", user._id.toString());
    if (user) return user;
  }

  if (clerkUserId) {
    user = await User.findOne({ clerkUserId });
    if (user) console.log("🔎 Matched user by clerkUserId:", clerkUserId, "→", user._id.toString());
    if (user) return user;
  }

  if (email) {
    user = await User.findOne({ email });
    if (user) console.log("🔎 Matched user by email:", email, "→", user._id.toString());
    if (user) return user;
  }

  return null;
}

function applySubscriptionFields(user, sub, meta = {}) {
  logObj("🧩 Applying subscription fields", {
    subId: sub?.id,
    cust: sub?.customer,
    status: sub?.status,
    trial_start: sub?.trial_start,
    trial_end: sub?.trial_end,
    subMeta: sub?.metadata,
    meta
  });
  // IDs
  if (sub?.id) user.stripeSubscriptionId = sub.id;
  if (sub?.customer) user.stripeCustomerId = sub.customer;

  // Status + trial dates
  if (sub?.status) user.subscriptionStatus = sub.status; // trialing/active/past_due/...
  if (sub?.trial_start) user.trialStartDate = new Date(sub.trial_start * 1000);
  if (sub?.trial_end) user.trialEndDate = new Date(sub.trial_end * 1000);

  // Plan metadata
  const plan = meta.plan ?? sub?.metadata?.plan;
  const billingCycle = meta.billingCycle ?? sub?.metadata?.billingCycle;
  if (plan) user.selectedPlan = plan;
  if (billingCycle) user.billingCycle = billingCycle;
}

async function upsertUserFromSession(session) {
  console.log("✅ checkout.session.completed:", {
    id: session.id,
    mode: session.mode,
    customer: session.customer,
    email: session.customer_details?.email,
    client_reference_id: session.client_reference_id,
    metadata: session.metadata,
    subscription: session.subscription,
  });
  
  console.log("🔍 [Session Processing] Starting user upsert from session...");

  // Metadata from session
  const meta = {
    clerkUserId: session.client_reference_id || session.metadata?.clerkUserId || null,
    plan: session.metadata?.plan || null,
    billingCycle: session.metadata?.billingCycle || null,
  };

  // Retrieve subscription for authoritative status/metadata
  let sub = null;
  if (session.subscription) {
    try {
      sub = await stripe.subscriptions.retrieve(session.subscription, {
        expand: ["items.data.price.product"]
      });
      if (sub) {
        logObj("📦 Retrieved subscription (from session)", {
          id: sub.id,
          customer: sub.customer,
          status: sub.status,
          meta: sub.metadata,
          items: sub.items?.data?.map(it => ({
            price: it.price?.id,
            product: typeof it.price?.product === "object" ? it.price.product?.name : it.price?.product
          }))
        });
      }
    } catch (e) {
      console.error("⚠️ Could not retrieve subscription:", e.message);
    }
  }

  // Patch Stripe Customer email from Checkout if present (repairs fallback emails)
  try {
    if (session.customer && session.customer_details?.email) {
      const trueEmail = normEmail(session.customer_details.email);
      const cust = await stripe.customers.retrieve(session.customer);
      if (trueEmail && cust && cust.email !== trueEmail) {
        await stripe.customers.update(session.customer, { email: trueEmail });
        console.log("🩹 Patched Stripe customer email:", { customer: session.customer, trueEmail });
      }
    }
  } catch (e) {
    console.error("⚠️ Could not patch customer email:", e.message);
  }

  // Find user (prefer stripeCustomerId, then clerkUserId, then email)
  const email = normEmail(session.customer_details?.email || null);
  let user = await findUser({
    stripeCustomerId: session.customer,
    clerkUserId: meta.clerkUserId,
    email,
  });

  // Snap identity on existing user if any identifiers are missing
  if (user) {
    if (meta.clerkUserId && !user.clerkUserId) user.clerkUserId = meta.clerkUserId;
    if (session.customer && !user.stripeCustomerId) user.stripeCustomerId = session.customer;
    if (email && !user.email) user.email = email;
  }

  // Create if missing (always capture brand-new payers)
  if (!user) {
    user = new User({
      clerkUserId: meta.clerkUserId || undefined,
      email: email || undefined,
      stripeCustomerId: session.customer || undefined,
      subscriptionStatus: "none",
      selectedPlan: "none",
      billingCycle: "none",
    });
  }

  // Apply fields from subscription (preferred) or session fallback
  if (sub) {
    applySubscriptionFields(user, sub, meta);
  } else {
    if (meta.plan) user.selectedPlan = meta.plan;
    if (meta.billingCycle) user.billingCycle = meta.billingCycle;
    // Fallback; subsequent events will correct this
    if (session.status === "complete") user.subscriptionStatus = "active";
  }

  try {
    await user.save();
    console.log("💾 User save OK");
  } catch (e) {
    console.error("❌ User save failed:", e);
    throw e;
  }
  console.log("👤 User synced (from session):", {
    id: user._id.toString(),
    email: user.email,
    clerkUserId: user.clerkUserId,
    stripeCustomerId: user.stripeCustomerId,
    stripeSubscriptionId: user.stripeSubscriptionId,
    status: user.subscriptionStatus,
    plan: user.selectedPlan,
    billingCycle: user.billingCycle,
  });
}

async function upsertUserFromSubscription(sub) {
  console.log("✅ subscription.*:", {
    id: sub.id,
    customer: sub.customer,
    status: sub.status,
    metadata: sub.metadata,
  });

  try {
    if (!sub.items?.data?.[0]?.price?.product || typeof sub.items.data[0].price.product !== "object") {
      sub = await stripe.subscriptions.retrieve(sub.id, { expand: ["items.data.price.product"] });
    }
  } catch (e) {
    console.error("⚠️ Could not re-retrieve subscription with expand:", e.message);
  }

  // Fallback plan/cycle from price/product when metadata missing
  if (!sub.metadata || Object.keys(sub.metadata).length === 0) {
    const firstItem = sub.items?.data?.[0];
    const priceId = firstItem?.price?.id;
    const productName = typeof firstItem?.price?.product === "object" ? firstItem.price.product?.name : null;
    if (!sub.metadata) sub.metadata = {};
    if (!sub.metadata.plan && productName) {
      const nameLc = String(productName).toLowerCase();
      if (nameLc.includes("starter")) sub.metadata.plan = "starter";
      else if (nameLc.includes("creator")) sub.metadata.plan = "creator";
      else if (nameLc.includes("pro")) sub.metadata.plan = "pro";
      else if (nameLc.includes("enterprise")) sub.metadata.plan = "enterprise";
    }
    const interval = firstItem?.price?.recurring?.interval; // "day" | "week" | "month" | "year"
    if (!sub.metadata.billingCycle && interval) {
      sub.metadata.billingCycle = interval === "year" ? "yearly" : interval === "month" ? "monthly" : interval;
    }
    logObj("🧭 Derived metadata from price/product", { priceId, productName, derived: sub.metadata });
  }

  // Optional: fetch customer email for storage (not for matching)
  let norm = null;
  try {
    if (sub.customer) {
      const cust = await stripe.customers.retrieve(sub.customer);
      norm = normEmail(cust.email || null);
    }
  } catch (e) {
    console.error("⚠️ Could not retrieve customer:", e.message);
  }

  const clerkUserId = sub.metadata?.clerkUserId || null;

  // Find user by stripeCustomerId → clerkUserId → email
  let user = await findUser({
    stripeCustomerId: sub.customer,
    clerkUserId,
    email: norm,
  });

  if (!user) {
    // Always create for brand-new payers (even if they weren't logged in)
    user = new User({
      clerkUserId: clerkUserId || undefined,
      stripeCustomerId: sub.customer || undefined,
      email: norm || undefined,
      subscriptionStatus: "none",
      selectedPlan: "none",
      billingCycle: "none",
    });
  } else {
    // Snap identity fields if missing
    if (clerkUserId && !user.clerkUserId) user.clerkUserId = clerkUserId;
    if (sub.customer && !user.stripeCustomerId) user.stripeCustomerId = sub.customer;
    if (norm && !user.email) user.email = norm;
  }

  applySubscriptionFields(user, sub);
  try {
    await user.save();
    console.log("💾 User save OK");
  } catch (e) {
    console.error("❌ User save failed:", e);
    throw e;
  }
  console.log("👤 User synced (from subscription):", {
    id: user._id.toString(),
    email: user.email,
    clerkUserId: user.clerkUserId,
    stripeCustomerId: user.stripeCustomerId,
    stripeSubscriptionId: user.stripeSubscriptionId,
    status: user.subscriptionStatus,
    plan: user.selectedPlan,
    billingCycle: user.billingCycle,
  });
}

async function markSubscriptionCanceled(sub) {
  const user = await User.findOne({ stripeSubscriptionId: sub.id });
  if (!user) return;
  user.subscriptionStatus = "canceled";
  await user.save();
  console.log("💾 User save OK");
  console.log("👤 User marked canceled:", { id: user._id.toString(), email: user.email });
}

async function onInvoicePaid(invoice) {
  if (!invoice.subscription) return;
  const user = await User.findOne({ stripeSubscriptionId: invoice.subscription });
  if (!user) return;
  
  const wasTrialing = user.subscriptionStatus === "trialing";
  
  user.subscriptionStatus = "active";
  
  // If transitioning from trial to active, reset daily counters for fresh start
  if (wasTrialing) {
    user.dailyPostsUsed = 0;
    user.dailyLimitResetAt = null;
    console.log("✅ Trial ended naturally, resetting daily counters");
  }
  
  await user.save();
  console.log("💾 User save OK");
  console.log("👤 User marked active (invoice paid):", { 
    id: user._id.toString(), 
    email: user.email,
    wasTrialing,
    countersReset: wasTrialing
  });
}

async function onInvoiceFailed(invoice) {
  if (!invoice.subscription) return;
  const user = await User.findOne({ stripeSubscriptionId: invoice.subscription });
  if (!user) return;
  user.subscriptionStatus = "past_due";
  await user.save();
  console.log("💾 User save OK");
  console.log("👤 User marked past_due (invoice failed):", { id: user._id.toString(), email: user.email });
}

async function onCustomerUpdated(cust) {
  try {
    const stripeCustomerId = cust.id;
    const email = normEmail(cust.email || null);
    const clerkUserId = cust.metadata?.clerkUserId || null;

    // Prefer match by customer id
    let user = await User.findOne({ stripeCustomerId });

    // Fallback: try clerk id from metadata if present
    if (!user && clerkUserId) {
      user = await User.findOne({ clerkUserId });
    }

    if (!user) {
      // Do not create on customer.updated; wait for checkout/sub events
      console.log("ℹ️ customer.updated with no matching user; skipping create", { stripeCustomerId, clerkUserId, email });
      return;
    }

    // Patch identifiers if missing
    if (!user.stripeCustomerId) user.stripeCustomerId = stripeCustomerId;
    if (clerkUserId && !user.clerkUserId) user.clerkUserId = clerkUserId;

    // Sync email if changed (email is NOT a join key, but useful to keep up to date)
    if (email && email !== user.email) {
      user.email = email;
    }

    await user.save();
    console.log("💾 User save OK");
    console.log("👤 User synced (from customer.updated):", {
      id: user._id.toString(),
      email: user.email,
      clerkUserId: user.clerkUserId,
      stripeCustomerId: user.stripeCustomerId,
    });
  } catch (e) {
    console.error("❌ onCustomerUpdated error:", e);
    throw e;
  }
}

// Quick probe for ALB path routing (should NOT be used by Stripe)
router.get("/_ping", (req, res) => res.json({ ok: true, route: "/webhook/_ping" }));

module.exports = router;