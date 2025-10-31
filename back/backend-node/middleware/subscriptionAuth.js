const User = require('../models/User');

// Middleware to check if user has active subscription
const requireSubscription = async (req, res, next) => {
  try {
    const clerkUserId = (typeof req.auth === 'function' ? req.auth().userId : req.auth?.userId);
    const user = await User.findOne({ clerkUserId });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if request is from Sora Videos Dashboard flow - bypass subscription requirement
    const isSoraFlow = req.body?.soraFlow || req.headers['x-sora-flow'];
    if (isSoraFlow) {
      // Skip subscription check for Sora Videos Dashboard flow
      req.userData = user;
      next();
      return;
    }

    // Check if user has active subscription
    if (!user.hasActiveSubscription()) {
      return res.status(403).json({ 
        error: "Subscription required",
        subscriptionStatus: user.subscriptionStatus,
        trialDaysRemaining: user.calculateTrialDaysRemaining()
      });
    }

    // Add user to request for use in route handlers
    req.userData = user;
    next();
  } catch (error) {
    console.error("❌ Subscription middleware error:", error);
    res.status(500).json({ error: "Subscription check failed" });
  }
};

// Middleware to check if user can create posts
const requirePostingAccess = async (req, res, next) => {
  try {
    const clerkUserId = (typeof req.auth === 'function' ? req.auth().userId : req.auth?.userId);
    const user = await User.findOne({ clerkUserId });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if user can create posts
    if (!user.canCreatePosts()) {
      return res.status(403).json({ 
        error: "Cannot create posts",
        subscriptionStatus: user.subscriptionStatus,
        trialDaysRemaining: user.calculateTrialDaysRemaining()
      });
    }

    // Add user to request for use in route handlers
    req.userData = user;
    next();
  } catch (error) {
    console.error("❌ Posting access middleware error:", error);
    res.status(500).json({ error: "Access check failed" });
  }
};

// Middleware to check feature access
const requireFeatureAccess = (feature) => {
  return async (req, res, next) => {
    try {
      const clerkUserId = (typeof req.auth === 'function' ? req.auth().userId : req.auth?.userId);
      const user = await User.findOne({ clerkUserId });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Check if user has active subscription
      if (!user.hasActiveSubscription()) {
        return res.status(403).json({ 
          error: "Subscription required for this feature",
          subscriptionStatus: user.subscriptionStatus,
          trialDaysRemaining: user.calculateTrialDaysRemaining()
        });
      }

      // Check if user can access specific feature
      if (!user.canAccessFeature(feature)) {
        return res.status(403).json({ 
          error: `Feature '${feature}' not available in your plan`,
          selectedPlan: user.selectedPlan,
          availableFeatures: user.getPlanLimits().features
        });
      }

      // Add user to request for use in route handlers
      req.userData = user;
      next();
    } catch (error) {
      console.error("❌ Feature access middleware error:", error);
      res.status(500).json({ error: "Feature access check failed" });
    }
  };
};

// Middleware to check account limits
const checkAccountLimits = async (req, res, next) => {
  try {
    const clerkUserId = (typeof req.auth === 'function' ? req.auth().userId : req.auth?.userId);
    const user = await User.findOne({ clerkUserId });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if user can connect more accounts
    if (!user.canConnectMoreAccounts()) {
      const limits = user.getPlanLimits();
      return res.status(403).json({ 
        error: "Account limit reached",
        currentAccounts: user.accountsConnected,
        maxAccounts: limits.maxAccounts,
        selectedPlan: user.selectedPlan
      });
    }

    // Add user to request for use in route handlers
    req.userData = user;
    next();
  } catch (error) {
    console.error("❌ Account limits middleware error:", error);
    res.status(500).json({ error: "Account limits check failed" });
  }
};

// Middleware to check file size limits
const checkFileSizeLimits = async (req, res, next) => {
  try {
    const clerkUserId = (typeof req.auth === 'function' ? req.auth().userId : req.auth?.userId);
    const user = await User.findOne({ clerkUserId });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get file size from request (assuming it's in MB)
    const fileSizeMB = req.body.fileSize || req.query.fileSize || 0;

    // Check if file size is within limits
    if (!user.isFileSizeAllowed(fileSizeMB)) {
      const limits = user.getPlanLimits();
      return res.status(403).json({ 
        error: "File size exceeds plan limit",
        fileSize: fileSizeMB,
        maxFileSize: limits.maxFileSize,
        selectedPlan: user.selectedPlan
      });
    }

    // Add user to request for use in route handlers
    req.userData = user;
    next();
  } catch (error) {
    console.error("❌ File size limits middleware error:", error);
    res.status(500).json({ error: "File size limits check failed" });
  }
};

// Middleware to get subscription info (no restrictions)
const getSubscriptionInfo = async (req, res, next) => {
  try {
    const clerkUserId = req.auth?.userId;
    const user = await User.findOne({ clerkUserId });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Add user to request for use in route handlers
    req.userData = user;
    next();
  } catch (error) {
    console.error("❌ Subscription info middleware error:", error);
    res.status(500).json({ error: "Subscription info check failed" });
  }
};

module.exports = {
  requireSubscription,
  requirePostingAccess,
  requireFeatureAccess,
  checkAccountLimits,
  checkFileSizeLimits,
  getSubscriptionInfo
};
