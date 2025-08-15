const express = require('express');
const router = express.Router();
const { clerkAuthMiddleware } = require('../middleware/clerkAuth');
const {
    publishNow,
    getPlatformStatus
} = require('../controllers/publisherController');
const platformPublisher = require('../services/platformPublisher');

// Test endpoint - no auth required (for development testing)
router.get('/test-linkedin', async (req, res) => {
    try {
        const LinkedInService = require('../services/linkedinService');
        const linkedinService = new LinkedInService();
        const testResult = await linkedinService.testConnection();
        
        res.json({
            success: true,
            linkedin: testResult
        });
    } catch (error) {
        console.error('LinkedIn test error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Twitter-specific publish endpoint - uses twitterUserId authentication (no Clerk)
router.post('/twitter/publish', async (req, res) => {
  try {
    const { content, twitterUserId } = req.body;
    
    if (!content) {
      return res.status(400).json({ success: false, message: 'Content required' });
    }
    if (!twitterUserId) {
      return res.status(400).json({ success: false, message: 'twitterUserId required for Twitter publishing' });
    }

    console.log(`🚀 Publishing to Twitter with separated flow (twitterUserId: ${twitterUserId})...`);
    
    try {
      const result = await platformPublisher.publishToPlatform('twitter', { ...content, twitterUserId });
      return res.json({
        success: true,
        platform: 'twitter',
        result
      });
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

// LinkedIn-specific publish endpoint - uses LinkedIn token (no Clerk)
router.post('/linkedin/publish', async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ success: false, message: 'Content required' });
    }

    console.log(`🚀 Publishing to LinkedIn with separated flow...`);
    
    try {
      const result = await platformPublisher.publishToPlatform('linkedin', content);
      return res.json({
        success: true,
        platform: 'linkedin',
        result
      });
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

// General publish endpoint - requires Clerk authentication
router.post('/publish', clerkAuthMiddleware, publishNow);

// Get platform connection status - requires Clerk authentication
router.get('/platforms/status', clerkAuthMiddleware, getPlatformStatus);

module.exports = router;
