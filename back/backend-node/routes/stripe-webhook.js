const express = require("express");
const router = express.Router();
const Stripe = require("stripe");
const User = require("../models/User");

// Initialize Stripe
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

if (!process.env.STRIPE_SECRET_KEY) {
  console.error("❌ STRIPE_SECRET_KEY not set");
}

// Stripe webhook endpoint
// IMPORTANT: This route must use express.raw() middleware to verify the signature
// The route should be mounted BEFORE express.json() middleware in index.js
router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("❌ STRIPE_WEBHOOK_SECRET not set");
    return res.status(500).json({ error: "Webhook secret not configured" });
  }

  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  try {
    // Handle the event
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        
        // Only process subscription checkouts
        if (session.mode === "subscription") {
          const clerkUserId = session.metadata?.clerk_user_id || null;
          const email =
            session.customer_details?.email ||
            session.metadata?.user_email ||
            null;
          
          const stripeCustomerId =
            typeof session.customer === "string"
              ? session.customer
              : session.customer?.id || null;

          // Retrieve subscription details
          let subscription = null;
          if (session.subscription) {
            subscription =
              typeof session.subscription === "string"
                ? await stripe.subscriptions.retrieve(session.subscription)
                : session.subscription;
          }

          const stripeSubscriptionId = subscription?.id || null;
          const subscriptionStatus = subscription?.status || "active";
          const planItem = subscription?.items?.data?.[0];
          const interval = planItem?.plan?.interval || "month";
          const billingCycle = interval === "year" ? "yearly" : "monthly";

          if (stripeCustomerId) {
            const query = clerkUserId
              ? { clerkUserId }
              : { stripeCustomerId };

            await User.findOneAndUpdate(
              query,
              {
                clerkUserId: clerkUserId || undefined,
                email: email || undefined,
                firstName: session.metadata?.first_name || undefined,
                lastName: session.metadata?.last_name || undefined,
                stripeCustomerId,
                stripeSubscriptionId,
                subscriptionStatus,
                billingCycle,
                lastActiveDate: new Date(),
              },
              {
                upsert: true,
                new: true,
                setDefaultsOnInsert: true,
              }
            );

            console.log(`✅ Updated user subscription: ${clerkUserId || stripeCustomerId}`);
          }
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const stripeCustomerId = subscription.customer;
        const stripeSubscriptionId = subscription.id;
        const subscriptionStatus = subscription.status;
        const planItem = subscription.items?.data?.[0];
        const interval = planItem?.plan?.interval || "month";
        const billingCycle = interval === "year" ? "yearly" : "monthly";

        // Retrieve customer to get email
        let customer = null;
        if (stripeCustomerId) {
          try {
            customer = await stripe.customers.retrieve(stripeCustomerId);
          } catch (err) {
            console.error("❌ Error retrieving customer:", err);
          }
        }

        // Try to find user by stripeCustomerId or clerkUserId from customer metadata
        const clerkUserId = customer?.metadata?.clerk_user_id || null;
        const email = customer?.email || null;

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
              billingCycle,
              trialStartDate: subscription.trial_start
                ? new Date(subscription.trial_start * 1000)
                : undefined,
              trialEndDate: subscription.trial_end
                ? new Date(subscription.trial_end * 1000)
                : undefined,
              lastActiveDate: new Date(),
            },
            {
              upsert: true,
              new: true,
              setDefaultsOnInsert: true,
            }
          );

          console.log(`✅ Updated subscription: ${stripeSubscriptionId} (${subscriptionStatus})`);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const stripeCustomerId = subscription.customer;
        const stripeSubscriptionId = subscription.id;

        // Update user to reflect canceled subscription
        await User.findOneAndUpdate(
          { stripeCustomerId },
          {
            subscriptionStatus: "canceled",
            stripeSubscriptionId: stripeSubscriptionId || undefined,
            lastActiveDate: new Date(),
          },
          { new: true }
        );

        console.log(`✅ Subscription canceled: ${stripeSubscriptionId}`);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        const stripeCustomerId = invoice.customer;
        const subscriptionId = invoice.subscription;

        // Update subscription status to active when invoice payment succeeds
        if (stripeCustomerId && subscriptionId) {
          try {
            // Retrieve subscription to get current status
            const subscription = typeof subscriptionId === "string"
              ? await stripe.subscriptions.retrieve(subscriptionId)
              : subscriptionId;

            await User.findOneAndUpdate(
              { stripeCustomerId },
              {
                subscriptionStatus: subscription.status || "active",
                stripeSubscriptionId: subscription.id || subscriptionId,
                lastActiveDate: new Date(),
              },
              { new: true }
            );

            console.log(`✅ Invoice payment succeeded for customer: ${stripeCustomerId}`);
          } catch (err) {
            console.error("❌ Error processing invoice.payment_succeeded:", err);
          }
        }
        break;
      }

      default:
        console.log(`ℹ️  Unhandled event type: ${event.type}`);
    }

    // Return a 200 response to acknowledge receipt of the event
    res.status(200).json({ received: true });
  } catch (err) {
    console.error("❌ Error processing webhook:", err);
    // Still return 200 to prevent Stripe from retrying
    res.status(200).json({ received: true, error: err.message });
  }
});

module.exports = router;
