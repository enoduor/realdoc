const express = require('express');
const router = express.Router();
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');
const {
    publishNow,
    getPlatformStatus
} = require('../controllers/publisherController');
const platformPublisher = require('../services/platformPublisher');

// Test endpoint for LinkedIn status - no auth required (for direct OAuth flow)
router.get('/test-linkedin', async (req, res) => {
    try {
        const LinkedInToken = require('../models/LinkedInToken');
        const { findLinkedInToken, getLinkedInProfile } = require('../services/linkedinUserService');
        
        // Look for any valid LinkedIn token
        let tokenDoc = await LinkedInToken.findOne({ 
            linkedinUserId: { $exists: true, $ne: null } 
        });
        
        if (tokenDoc) {
            // Test if the token is valid
            try {
                const identifier = { linkedinUserId: tokenDoc.linkedinUserId };
                const profile = await getLinkedInProfile(identifier);
                
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

// Twitter-specific publish endpoint - requires Clerk authentication
router.post('/twitter/publish', ClerkExpressRequireAuth(), async (req, res) => {
  try {
    const { content } = req.body;
    const userId = req.auth.userId;
    
    if (!content) {
      return res.status(400).json({ success: false, message: 'Content required' });
    }
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User authentication required' });
    }

    console.log(`🚀 Publishing to Twitter for user: ${userId}...`);
    
    try {
      const result = await platformPublisher.publishToPlatform('twitter', { ...content, userId });
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

// YouTube-specific publish endpoint - requires Clerk authentication
router.post('/youtube/publish', ClerkExpressRequireAuth(), async (req, res) => {
  try {
    const { content } = req.body;
    const userId = req.auth.userId;
    
    if (!content) {
      return res.status(400).json({ success: false, message: 'Content required' });
    }
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User authentication required' });
    }

    console.log(`🚀 Publishing to YouTube for user: ${userId}...`);
    
    try {
      const result = await platformPublisher.publishToPlatform('youtube', { ...content, userId });
      return res.json({
        success: true,
        platform: 'youtube',
        result
      });
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

// LinkedIn-specific publish endpoint - requires user authentication
router.post('/linkedin/publish', ClerkExpressRequireAuth(), async (req, res) => {
  try {
    const { content } = req.body;
    const userId = req.auth.userId;
    
    if (!content) {
      return res.status(400).json({ success: false, message: 'Content required' });
    }
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User authentication required' });
    }

    // Find the specific user's LinkedIn token
    const LinkedInToken = require('../models/LinkedInToken');
    const linkedinToken = await LinkedInToken.findOne({ userId: userId });
    
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
        userId: userId,
        linkedinUserId: linkedinToken.linkedinUserId 
      });
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
router.post('/publish', ClerkExpressRequireAuth(), publishNow);

// Get platform connection status - requires Clerk authentication
router.get('/platforms/status', ClerkExpressRequireAuth(), getPlatformStatus);

module.exports = router;
