const User = require('../models/User');

/**
 * Get user's subscription status by Clerk user ID
 * @param {string} clerkUserId - Clerk user ID
 * @returns {Object} User subscription status
 */
const getUserSubscriptionStatus = async (clerkUserId) => {
  try {
    const user = await User.findOne({ clerkUserId });
    
    if (!user) {
      return {
        hasActiveSubscription: false,
        subscriptionStatus: 'none',
        selectedPlan: 'starter',
        trialDaysRemaining: 0
      };
    }

    return {
      hasActiveSubscription: user.hasActiveSubscription(),
      subscriptionStatus: user.subscriptionStatus,
      selectedPlan: user.selectedPlan,
      billingCycle: user.billingCycle,
      trialDaysRemaining: user.calculateTrialDaysRemaining()
    };
  } catch (error) {
    console.error('Error getting user subscription status:', error);
    return {
      hasActiveSubscription: false,
      subscriptionStatus: 'none',
      selectedPlan: 'starter',
      trialDaysRemaining: 0
    };
  }
};

module.exports = {
  getUserSubscriptionStatus
};
