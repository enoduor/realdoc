// webhooks/stripeWebhook.js
const express = require("express");
const router = express.Router();
const Stripe = require("stripe");
const User = require("../models/User");
require("dotenv").config(); // ✅ Load environment variables

// Stripe setup
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

router.post("/", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    // Check if this is a test event (no signature verification)
    if (sig === 'test_signature') {
      console.log('🧪 Processing test webhook event');
      console.log('🧪 Raw body:', req.body.toString());
      // Parse the raw body for test events
      event = JSON.parse(req.body.toString());
      console.log('🧪 Parsed event type:', event.type);
      console.log('🧪 Parsed event structure:', JSON.stringify(event, null, 2));
    } else if (!sig) {
      console.error("❌ No Stripe signature found");
      return res.status(400).send(`Webhook Error: No signature found`);
    } else {
      // Real Stripe webhook with signature verification
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    }
  } catch (err) {
    console.error("❌ Webhook signature error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`📬 Processing webhook event: ${event.type}`);

  // ✅ Handle events
  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object);
        break;

      case "customer.subscription.created":
        await handleSubscriptionCreated(event.data.object);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object);
        break;

      case "customer.subscription.trial_will_end":
        await handleTrialWillEnd(event.data.object);
        break;

      case "invoice.payment_succeeded":
        await handlePaymentSucceeded(event.data.object);
        break;

      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object);
        break;

      default:
        console.log(`📬 Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("❌ Webhook processing error:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

// Handle checkout session completion
async function handleCheckoutSessionCompleted(session) {
  console.log("✅ Checkout completed:", session.id);
  
  if (session.mode === 'subscription') {
    const clerkUserId = session.subscription_data?.metadata?.clerkUserId;
    const plan = session.subscription_data.metadata?.plan;
    const billingCycle = session.subscription_data.metadata?.billingCycle;
    
    if (clerkUserId) {
      // User was authenticated during payment
      const user = await User.findOne({ clerkUserId });
      if (user) {
        user.selectedPlan = plan;
        user.billingCycle = billingCycle;
        user.subscriptionStatus = 'active'; // User has paid, so status should be active
        await user.save();
        console.log(`✅ Updated authenticated user ${clerkUserId} with plan: ${plan} and status: active`);
      }
    } else {
      // User was not authenticated - create temporary record
      console.log("📝 Creating temporary user record for non-authenticated payment");
      const tempUser = new User({
        stripeCustomerId: session.customer,
        selectedPlan: plan,
        billingCycle: billingCycle,
        subscriptionStatus: 'active', // User has paid, so status should be active
        trialStartDate: new Date(),
        trialEndDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
        email: session.customer_details?.email || 'temp@example.com'
      });
      
      await tempUser.save();
      console.log(`✅ Created temporary user for customer ${session.customer} with plan: ${plan}`);
    }
  }
}

// Handle subscription creation
async function handleSubscriptionCreated(subscription) {
  console.log("✅ Subscription created:", subscription.id);
  
  const clerkUserId = subscription.metadata?.clerkUserId;
  
  if (clerkUserId) {
    // Authenticated user
    const user = await User.findOne({ clerkUserId });
    if (user) {
      user.stripeSubscriptionId = subscription.id;
      user.subscriptionStatus = subscription.status;
      user.trialStartDate = new Date(subscription.trial_start * 1000);
      user.trialEndDate = new Date(subscription.trial_end * 1000);
      user.selectedPlan = subscription.metadata?.plan || 'starter';
      user.billingCycle = subscription.metadata?.billingCycle || 'monthly';
      
      await user.save();
      console.log(`✅ Updated user ${clerkUserId} subscription status: ${user.subscriptionStatus}`);
    }
  } else {
    // Non-authenticated user - find by Stripe customer ID
    const user = await User.findOne({ stripeCustomerId: subscription.customer });
    if (user) {
      user.stripeSubscriptionId = subscription.id;
      user.subscriptionStatus = subscription.status;
      user.trialStartDate = new Date(subscription.trial_start * 1000);
      user.trialEndDate = new Date(subscription.trial_end * 1000);
      user.selectedPlan = subscription.metadata?.plan || 'starter';
      user.billingCycle = subscription.metadata?.billingCycle || 'monthly';
      
      await user.save();
      console.log(`✅ Updated temporary user ${user._id} subscription status: ${user.subscriptionStatus}`);
    }
  }
}

// Handle subscription updates
async function handleSubscriptionUpdated(subscription) {
  console.log("✅ Subscription updated:", subscription.id);
  
  const user = await User.findOne({ stripeSubscriptionId: subscription.id });
  if (user) {
    user.subscriptionStatus = subscription.status;
    
    // Update trial dates if they exist
    if (subscription.trial_start) {
      user.trialStartDate = new Date(subscription.trial_start * 1000);
    }
    if (subscription.trial_end) {
      user.trialEndDate = new Date(subscription.trial_end * 1000);
    }
    
    await user.save();
    console.log(`✅ Updated user ${user.clerkUserId} subscription status: ${user.subscriptionStatus}`);
  }
}

// Handle subscription deletion
async function handleSubscriptionDeleted(subscription) {
  console.log("✅ Subscription deleted:", subscription.id);
  
  const user = await User.findOne({ stripeSubscriptionId: subscription.id });
  if (user) {
    user.subscriptionStatus = 'canceled';
    await user.save();
    console.log(`✅ Marked user ${user.clerkUserId} subscription as canceled`);
  }
}

// Handle trial ending (3 days before)
async function handleTrialWillEnd(subscription) {
  console.log("⚠️ Trial will end soon:", subscription.id);
  
  const user = await User.findOne({ stripeSubscriptionId: subscription.id });
  if (user) {
    // Send notification to user about trial ending
    console.log(`⚠️ Trial ending soon for user ${user.clerkUserId}`);
    // TODO: Send email notification
  }
}

// Handle successful payment
async function handlePaymentSucceeded(invoice) {
  console.log("✅ Payment succeeded:", invoice.id);
  
  if (invoice.subscription) {
    const user = await User.findOne({ stripeSubscriptionId: invoice.subscription });
    if (user) {
      user.subscriptionStatus = 'active';
      await user.save();
      console.log(`✅ Updated user ${user.clerkUserId} to active subscription`);
    }
  }
}

// Handle failed payment
async function handlePaymentFailed(invoice) {
  console.log("❌ Payment failed:", invoice.id);
  
  if (invoice.subscription) {
    const user = await User.findOne({ stripeSubscriptionId: invoice.subscription });
    if (user) {
      user.subscriptionStatus = 'past_due';
      await user.save();
      console.log(`❌ Updated user ${user.clerkUserId} to past_due status`);
    }
  }
}

module.exports = router;