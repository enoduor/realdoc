const User = require('../models/User');

// Middleware to check daily post limits
const checkDailyUsage = async (req, res, next) => {
  try {
    const clerkUserId = (typeof req.auth === 'function' ? req.auth().userId : req.auth?.userId);
    
    if (!clerkUserId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    // Check if request is from Sora Videos Dashboard flow - bypass daily limits
    const isSoraFlow = req.body?.soraFlow || req.headers['x-sora-flow'];
    if (isSoraFlow) {
      // Skip daily usage check for Sora Videos Dashboard flow
      req.bypassDailyLimit = true;
      next();
      return;
    }

    // Get user from database
    const user = await User.findOne({ clerkUserId });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user has active subscription
    if (!user.hasActiveSubscription()) {
      return res.status(403).json({
        success: false,
        message: 'Active subscription required to publish posts'
      });
    }

    // Check daily usage limits
    const usageStatus = user.canPublishToday();
    
    if (!usageStatus.canPublish) {
      const resetTime = usageStatus.resetAt;
      const hoursUntilReset = Math.ceil((resetTime - new Date()) / (1000 * 60 * 60));
      
      return res.status(429).json({
        success: false,
        message: `Daily post limit reached. Used ${usageStatus.used}/${usageStatus.limit} posts.`,
        error: 'DAILY_LIMIT_EXCEEDED',
        usage: usageStatus,
        resetIn: `${hoursUntilReset} hours`
      });
    }

    // Attach usage info to request for controller use
    req.usageStatus = usageStatus;
    req.user = user;
    
    next();
  } catch (error) {
    console.error('Error checking daily usage:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking usage limits',
      error: error.message
    });
  }
};

// Middleware to increment usage after successful publish
const incrementUsage = async (req, res, next) => {
  // Store original res.json to intercept successful responses
  const originalJson = res.json;
  
  res.json = function(data) {
    // Only increment if publish was successful and not from Sora flow
    if (data && data.success !== false && req.user && !req.bypassDailyLimit) {
      // Increment usage asynchronously (don't block response)
      req.user.incrementDailyUsage()
        .then(() => {
          console.log(`✅ Daily usage incremented for user ${req.user.clerkUserId}`);
        })
        .catch(error => {
          console.error('Error incrementing daily usage:', error);
        });
    }
    
    // Call original res.json
    return originalJson.call(this, data);
  };
  
  next();
};

// Get usage status for a user (API endpoint helper)
const getUserUsageStatus = async (clerkUserId) => {
  try {
    const user = await User.findOne({ clerkUserId });
    if (!user) {
      throw new Error('User not found');
    }

    const usageStatus = user.canPublishToday();
    
    return {
      success: true,
      plan: user.selectedPlan,
      hasActiveSubscription: user.hasActiveSubscription(),
      usage: usageStatus
    };
  } catch (error) {
    throw error;
  }
};

module.exports = {
  checkDailyUsage,
  incrementUsage,
  getUserUsageStatus
};
