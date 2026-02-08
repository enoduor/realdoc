const express = require("express");
const router = express.Router();
const User = require("../models/User");

/**
 * Simple API to expose subscription status for a given Clerk user.
 * This does NOT change any existing Stripe logic.
 *
 * Usage from frontend dashboard:
 *   GET /api/dashboard/subscription-status?clerkUserId=USER_ID
 */
router.get("/subscription-status", async (req, res) => {
  try {
    const { clerkUserId } = req.query;

    if (!clerkUserId) {
      return res.status(400).json({
        success: false,
        message: "clerkUserId is required",
      });
    }

    // Inline subscription status lookup so we don't depend on unused tokenUtils helper
    const user = await User.findOne({ clerkUserId });

    const status = user
      ? {
          hasActiveSubscription: user.hasActiveSubscription(),
          subscriptionStatus: user.subscriptionStatus,
          selectedPlan: user.selectedPlan,
          billingCycle: user.billingCycle,
          trialDaysRemaining: user.calculateTrialDaysRemaining(),
        }
      : {
          hasActiveSubscription: false,
          subscriptionStatus: "none",
          selectedPlan: "none",
          billingCycle: "none",
          trialDaysRemaining: 0,
        };

    return res.status(200).json({
      success: true,
      ...status,
    });
  } catch (err) {
    console.error("❌ Error getting subscription status:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to get subscription status",
    });
  }
});

/**
 * List all subscribers (for admin/dashboard views).
 * Returns users who have any non-"none" subscriptionStatus.
 */
router.get("/subscribers", async (_req, res) => {
  try {
    const User = require("../models/User");

    const subscribers = await User.find({
      subscriptionStatus: { $ne: "none" },
    })
      .select("clerkUserId email subscriptionStatus selectedPlan billingCycle createdAt updatedAt")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: subscribers.length,
      subscribers,
    });
  } catch (err) {
    console.error("❌ Error listing subscribers:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to list subscribers",
    });
  }
});

module.exports = router;

