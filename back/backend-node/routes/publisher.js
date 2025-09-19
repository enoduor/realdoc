const express = require('express');
const multer = require('multer');
const router = express.Router();
const { requireAuth } = require('@clerk/express');
const { requireSubscription } = require('../middleware/subscriptionAuth');
const { checkDailyUsage, incrementUsage } = require('../middleware/usageAuth');
const {
    publishNow,
    getPlatformStatus
} = require('../controllers/publisherController');
const PlatformPublisher = require('../services/platformPublisher');
const platformPublisher = new PlatformPublisher();
const { uploadVideo, publishVideo } = require('../services/tiktokService');

// Configure multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

// Helper: unify success semantics and ensure media posts include a URL
function buildPublishResponse(platform, content, result) {
  const expectsMedia = Boolean(content && content.mediaUrl);
  const hasUrl = Boolean(result && result.url);
  const backendReportedSuccess = result && (result.success !== false);

  // If media was requested, require a URL in the result for success
  const ok = backendReportedSuccess && (!expectsMedia || hasUrl);

  // Return clean response without duplicate nesting
  return { 
    success: ok, 
    platform, 
    ...result  // Spread the service result directly
  };
}

// Test endpoint for LinkedIn status - no auth required (for direct OAuth flow)
router.get('/test-linkedin', async (req, res) => {
    try {
        const LinkedInToken = require('../models/LinkedInToken');
        const LinkedInService = require('../services/linkedinService');
        const linkedinService = new LinkedInService();
        
        // Look for any valid LinkedIn token
        let tokenDoc = await LinkedInToken.findOne({ 
            linkedinUserId: { $exists: true, $ne: null } 
        });
        
        if (tokenDoc) {
            // Test if the token is valid
            try {
                const identifier = { linkedinUserId: tokenDoc.linkedinUserId };
                const profile = await linkedinService.getLinkedInProfile(identifier);
                
                res.json({
                    success: true,
                    linkedin: {
                        connected: true,
                        canPost: true,
                        user: {
                            linkedinUserId: tokenDoc.linkedinUserId,
                            firstName: tokenDoc.firstName,
                            lastName: tokenDoc.lastName,
                            fullName: profile.fullName
                        }
                    }
                });
            } catch (tokenError) {
                console.warn('LinkedIn token validation failed:', tokenError.message);
                res.json({
                    success: false,
                    linkedin: {
                        connected: false,
                        canPost: false,
                        error: 'Token validation failed',
                        message: 'Please reconnect your LinkedIn account'
                    }
                });
            }
        } else {
            res.json({
                success: false,
                linkedin: {
                    connected: false,
                    canPost: false,
                    message: 'No LinkedIn account connected. Please connect your LinkedIn account first via OAuth.'
                }
            });
        }
    } catch (error) {
        console.error('LinkedIn test error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Twitter-specific publish endpoint - requires Clerk authentication and active subscription
router.post('/twitter/publish', requireAuth(), requireSubscription, async (req, res) => {
  try {
    const { content } = req.body;
    const userId = req.auth().userId;
    
    if (!content) {
      return res.status(400).json({ success: false, message: 'Content required' });
    }
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User authentication required' });
    }

    // Find the specific user's Twitter token
    const TwitterToken = require('../models/TwitterToken');
    const twitterToken = await TwitterToken.findOne({ clerkUserId: userId });
    
    if (!twitterToken) {
      return res.status(400).json({ 
        success: false, 
        message: 'No Twitter account connected for this user. Please connect your Twitter account first via OAuth.' 
      });
    }

    console.log(`🚀 Publishing to Twitter for user: ${userId} with twitterUserId: ${twitterToken.twitterUserId}...`);
    
    try {
      const result = await platformPublisher.publishToPlatform('twitter', { ...content, clerkUserId: userId });
      console.log('🔍 [Twitter Route] Raw result:', JSON.stringify(result, null, 2));
      const payload = buildPublishResponse('twitter', content, result);
      console.log('🔍 [Twitter Route] Final payload:', JSON.stringify(payload, null, 2));
      return res.json(payload);
    } catch (error) {
      console.error(`❌ Failed to publish to Twitter:`, error.message);
      return res.status(500).json({ 
        success: false, 
        platform: 'twitter',
        error: error.message 
      });
    }

  } catch (error) {
    console.error('Error publishing to Twitter:', error);
    return res.status(500).json({ success: false, message: 'Failed to publish to Twitter', error: error.message });
  }
});

// YouTube-specific publish endpoint - requires Clerk authentication and active subscription
router.post('/youtube/publish', requireAuth(), requireSubscription, async (req, res) => {
  console.log('🎯 YouTube route handler reached!');
  try {
    const { content } = req.body;
    const userId = req.auth().userId;
    console.log('🔍 User ID from Clerk:', userId);
    
    if (!content) {
      return res.status(400).json({ success: false, message: 'Content required' });
    }
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User authentication required' });
    }

    // Find the specific user's YouTube token
    const YouTubeToken = require('../models/YouTubeToken');
    const youtubeToken = await YouTubeToken.findOne({ clerkUserId: userId, isActive: true });
    
    if (!youtubeToken) {
      return res.status(400).json({ 
        success: false, 
        message: 'No YouTube account connected for this user. Please connect your YouTube account first via OAuth.' 
      });
    }

    console.log(`🚀 Publishing to YouTube for user: ${userId} with channelId: ${youtubeToken.channelId}...`);
    
    try {
      const result = await platformPublisher.publishToPlatform('youtube', { ...content, clerkUserId: userId });
      console.log('🔍 [YouTube Route] Raw result:', JSON.stringify(result, null, 2));
      const payload = buildPublishResponse('youtube', content, result);
      console.log('🔍 [YouTube Route] Final payload:', JSON.stringify(payload, null, 2));
      return res.json(payload);
    } catch (error) {
      console.error(`❌ Failed to publish to YouTube:`, error.message);
      return res.status(500).json({ 
        success: false, 
        platform: 'youtube',
        error: error.message 
      });
    }

  } catch (error) {
    console.error('Error publishing to YouTube:', error);
    return res.status(500).json({ success: false, message: 'Failed to publish to YouTube', error: error.message });
  }
});

// LinkedIn-specific publish endpoint - requires user authentication and active subscription
router.post('/linkedin/publish', requireAuth(), requireSubscription, async (req, res) => {
  try {
    const { content } = req.body;
    const userId = req.auth().userId;
    
    if (!content) {
      return res.status(400).json({ success: false, message: 'Content required' });
    }
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User authentication required' });
    }

    // Find the specific user's LinkedIn token
    const LinkedInToken = require('../models/LinkedInToken');
    const linkedinToken = await LinkedInToken.findOne({ clerkUserId: userId });
    
    if (!linkedinToken) {
      return res.status(400).json({ 
        success: false, 
        message: 'No LinkedIn account connected for this user. Please connect your LinkedIn account first via OAuth.' 
      });
    }

    console.log(`🚀 Publishing to LinkedIn for user: ${userId} with linkedinUserId: ${linkedinToken.linkedinUserId}...`);
    
    try {
      const result = await platformPublisher.publishToPlatform('linkedin', { 
        ...content, 
        clerkUserId: userId,
        linkedinUserId: linkedinToken.linkedinUserId 
      });
      const payload = buildPublishResponse('linkedin', content, result);
      return res.json(payload);
    } catch (error) {
      console.error(`❌ Failed to publish to LinkedIn:`, error.message);
      return res.status(500).json({ 
        success: false, 
        platform: 'linkedin',
        error: error.message 
      });
    }

  } catch (error) {
    console.error('Error publishing to LinkedIn:', error);
    return res.status(500).json({ success: false, message: 'Failed to publish to LinkedIn', error: error.message });
  }
});

// Facebook-specific publish endpoint - requires Clerk authentication and active subscription
router.post('/facebook/publish', requireAuth(), requireSubscription, async (req, res) => {
  try {
    const { content } = req.body;
    const userId = req.auth().userId;
    
    if (!content) {
      return res.status(400).json({ success: false, message: 'Content required' });
    }
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User authentication required' });
    }

    // Find the specific user's Facebook token
    const FacebookToken = require('../models/FacebookToken');
    const facebookToken = await FacebookToken.findOne({ clerkUserId: userId, isActive: true });
    
    if (!facebookToken) {
      return res.status(400).json({ 
        success: false, 
        message: 'No Facebook account connected for this user. Please connect your Facebook account first via OAuth.' 
      });
    }

    console.log(`🚀 Publishing to Facebook for user: ${userId} with facebookUserId: ${facebookToken.facebookUserId}...`);
    
    try {
      const result = await platformPublisher.publishToPlatform('facebook', { 
        ...content, 
        clerkUserId: userId
      });
      console.log('🔍 [Facebook Route] Raw result:', JSON.stringify(result, null, 2));
      const payload = buildPublishResponse('facebook', content, result);
      console.log('🔍 [Facebook Route] Final payload:', JSON.stringify(payload, null, 2));
      return res.json(payload);
    } catch (error) {
      console.error(`❌ Failed to publish to Facebook:`, error.message);
      return res.status(500).json({ 
        success: false, 
        platform: 'facebook',
        error: error.message 
      });
    }

  } catch (error) {
    console.error('Error publishing to Facebook:', error);
    return res.status(500).json({ success: false, message: 'Failed to publish to Facebook', error: error.message });
  }
});

// Instagram-specific publish endpoint - requires Clerk authentication and active subscription
router.post('/instagram/publish', requireAuth(), requireSubscription, async (req, res) => {
  try {
    const { content } = req.body;
    const userId = req.auth().userId;
    
    if (!content) {
      return res.status(400).json({ success: false, message: 'Content required' });
    }
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User authentication required' });
    }

    // Find the specific user's Instagram token
    const InstagramToken = require('../models/InstagramToken');
    const instagramToken = await InstagramToken.findOne({ clerkUserId: userId, isActive: true });
    
    if (!instagramToken) {
      return res.status(400).json({ 
        success: false, 
        message: 'No Instagram account connected for this user. Please connect your Instagram account first via OAuth.' 
      });
    }

    console.log(`🚀 Publishing to Instagram for user: ${userId} with igUserId: ${instagramToken.igUserId}...`);
    
    try {
      const result = await platformPublisher.publishToPlatform('instagram', { 
        ...content, 
        clerkUserId: userId
      });
      const payload = buildPublishResponse('instagram', content, result);
      return res.json(payload);
    } catch (error) {
      console.error(`❌ Failed to publish to Instagram:`, error.message);
      return res.status(500).json({ 
        success: false, 
        platform: 'instagram',
        error: error.message 
      });
    }

  } catch (error) {
    console.error('Error publishing to Instagram:', error);
    return res.status(500).json({ success: false, message: 'Failed to publish to Instagram', error: error.message });
  }
});

// Test TikTok route - no auth required
router.post('/tiktok/test', async (req, res) => {
  res.json({ success: true, message: 'TikTok test route working' });
});

// TikTok-specific publish endpoint - requires Clerk authentication and active subscription
router.post('/tiktok/publish', requireAuth(), requireSubscription, async (req, res) => {
  try {
    const { content } = req.body;
    const userId = req.auth().userId;
    
    if (!content) {
      return res.status(400).json({ success: false, message: 'Content required' });
    }
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User authentication required' });
    }

    console.log(`🚀 Publishing to TikTok for user: ${userId}...`);
    
    try {
      const result = await platformPublisher.publishToPlatform('tiktok', { ...content, clerkUserId: userId });
      const payload = buildPublishResponse('tiktok', content, result);
      return res.json(payload);
    } catch (error) {
      console.error(`❌ Failed to publish to TikTok:`, error.message);
      return res.status(500).json({ 
        success: false, 
        platform: 'tiktok',
        error: error.message 
      });
    }

  } catch (error) {
    console.error('Error publishing to TikTok:', error);
    return res.status(500).json({ success: false, message: 'Failed to publish to TikTok', error: error.message });
  }
});

// General publish endpoint - requires Clerk authentication and daily usage check
router.post('/publish', requireAuth(), requireSubscription, checkDailyUsage, incrementUsage, publishNow);



// Get platform connection status - requires Clerk authentication
router.get('/platforms/status', requireAuth(), getPlatformStatus);

// Get user's daily usage status - requires Clerk authentication
router.get('/usage/status', requireAuth(), async (req, res) => {
  try {
    const clerkUserId = (typeof req.auth === 'function' ? req.auth().userId : req.auth?.userId);
    
    if (!clerkUserId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    const { getUserUsageStatus } = require('../middleware/usageAuth');
    const usageStatus = await getUserUsageStatus(clerkUserId);
    
    res.json(usageStatus);
  } catch (error) {
    console.error('Error getting usage status:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting usage status',
      error: error.message
    });
  }
});

module.exports = router;
