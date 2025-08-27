const TwitterToken = require('../models/TwitterToken');
const LinkedInToken = require('../models/LinkedInToken');
const InstagramToken = require('../models/InstagramToken');
const FacebookToken = require('../models/FacebookToken');
const TikTokToken = require('../models/TikTokToken');
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
        trialDaysRemaining: 0,
        canCreatePosts: false
      };
    }

    return {
      hasActiveSubscription: user.hasActiveSubscription(),
      subscriptionStatus: user.subscriptionStatus,
      selectedPlan: user.selectedPlan,
      billingCycle: user.billingCycle,
      trialDaysRemaining: user.calculateTrialDaysRemaining(),
      canCreatePosts: user.canCreatePosts(),
      accountsConnected: user.accountsConnected,
      postsCreated: user.postsCreated
    };
  } catch (error) {
    console.error('Error getting user subscription status:', error);
    return {
      hasActiveSubscription: false,
      subscriptionStatus: 'none',
      selectedPlan: 'starter',
      trialDaysRemaining: 0,
      canCreatePosts: false
    };
  }
};

/**
 * Get all platform tokens for a user by Clerk user ID
 * @param {string} clerkUserId - Clerk user ID
 * @returns {Object} Object with tokens for each platform
 */
const getUserPlatformTokens = async (clerkUserId) => {
  try {
    const [twitterToken, linkedinToken, instagramToken, facebookToken, tiktokToken] = await Promise.all([
      TwitterToken.findOne({ clerkUserId }),
      LinkedInToken.findOne({ clerkUserId }),
      InstagramToken.findOne({ clerkUserId, isActive: true }),
      FacebookToken.findOne({ clerkUserId, isActive: true }),
      TikTokToken.findOne({ clerkUserId })
    ]);

    // YouTube tokens are stored in Clerk's public_metadata, not in database
    // We'll handle YouTube tokens separately in the platform publisher
    const youtubeToken = null; // YouTube uses refreshToken from Clerk metadata

    return {
      twitter: twitterToken,
      linkedin: linkedinToken,
      instagram: instagramToken,
      facebook: facebookToken,
      tiktok: tiktokToken,
      youtube: youtubeToken // Always null, handled separately
    };
  } catch (error) {
    console.error('Error getting user platform tokens:', error);
    return {
      twitter: null,
      linkedin: null,
      instagram: null,
      facebook: null,
      tiktok: null,
      youtube: null
    };
  }
};

/**
 * Get platform connection status for a user
 * @param {string} clerkUserId - Clerk user ID
 * @returns {Object} Connection status for each platform
 */
const getPlatformConnectionStatus = async (clerkUserId) => {
  try {
    const tokens = await getUserPlatformTokens(clerkUserId);
    
    return {
      twitter: {
        connected: !!tokens.twitter,
        userId: tokens.twitter?.twitterUserId,
        handle: tokens.twitter?.handle
      },
      linkedin: {
        connected: !!tokens.linkedin,
        userId: tokens.linkedin?.linkedinUserId,
        name: tokens.linkedin ? `${tokens.linkedin.firstName} ${tokens.linkedin.lastName}`.trim() : null
      },
      instagram: {
        connected: !!tokens.instagram,
        userId: tokens.instagram?.igUserId,
        name: tokens.instagram?.name
      },
      facebook: {
        connected: !!tokens.facebook,
        userId: tokens.facebook?.facebookUserId,
        name: tokens.facebook?.name
      },
      tiktok: {
        connected: !!tokens.tiktok,
        userId: tokens.tiktok?.tiktokUserOpenId,
        username: tokens.tiktok?.username
      }
    };
  } catch (error) {
    console.error('Error getting platform connection status:', error);
    return {
      twitter: { connected: false },
      linkedin: { connected: false },
      instagram: { connected: false },
      facebook: { connected: false },
      tiktok: { connected: false }
    };
  }
};

/**
 * Create or update a platform token with Clerk user ID
 * @param {string} platform - Platform name (twitter, linkedin, instagram, facebook, tiktok)
 * @param {string} clerkUserId - Clerk user ID
 * @param {Object} tokenData - Token data to save
 * @returns {Object} Created/updated token
 */
const createOrUpdatePlatformToken = async (platform, clerkUserId, tokenData) => {
  try {
    let TokenModel;
    
    switch (platform.toLowerCase()) {
      case 'twitter':
        TokenModel = TwitterToken;
        break;
      case 'linkedin':
        TokenModel = LinkedInToken;
        break;
      case 'instagram':
        TokenModel = InstagramToken;
        break;
      case 'facebook':
        TokenModel = FacebookToken;
        break;
      case 'tiktok':
        TokenModel = TikTokToken;
        break;
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }

    // Add clerkUserId to token data
    const dataWithClerkId = {
      ...tokenData,
      clerkUserId
    };

    // Try to find existing token and update, or create new one
    const existingToken = await TokenModel.findOne({ clerkUserId });
    
    if (existingToken) {
      Object.assign(existingToken, dataWithClerkId);
      await existingToken.save();
      return existingToken;
    } else {
      const newToken = new TokenModel(dataWithClerkId);
      await newToken.save();
      return newToken;
    }
  } catch (error) {
    console.error(`Error creating/updating ${platform} token:`, error);
    throw error;
  }
};

/**
 * Delete a platform token for a user
 * @param {string} platform - Platform name
 * @param {string} clerkUserId - Clerk user ID
 * @returns {boolean} Success status
 */
const deletePlatformToken = async (platform, clerkUserId) => {
  try {
    let TokenModel;
    
    switch (platform.toLowerCase()) {
      case 'twitter':
        TokenModel = TwitterToken;
        break;
      case 'linkedin':
        TokenModel = LinkedInToken;
        break;
      case 'instagram':
        TokenModel = InstagramToken;
        break;
      case 'facebook':
        TokenModel = FacebookToken;
        break;
      case 'tiktok':
        TokenModel = TikTokToken;
        break;
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }

    const result = await TokenModel.deleteOne({ clerkUserId });
    return result.deletedCount > 0;
  } catch (error) {
    console.error(`Error deleting ${platform} token:`, error);
    throw error;
  }
};

module.exports = {
  getUserSubscriptionStatus,
  getUserPlatformTokens,
  getPlatformConnectionStatus,
  createOrUpdatePlatformToken,
  deletePlatformToken
};
