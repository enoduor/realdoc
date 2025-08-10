const express = require('express');
const router = express.Router();
const { clerkAuthMiddleware } = require('../middleware/clerkAuth');
const {
    publishNow,
    getPlatformStatus
} = require('../controllers/publisherController');

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

// Test publish endpoint - no auth required (for development testing)
router.post('/test-publish', async (req, res) => {
    try {
        const { platforms, content } = req.body;
        
        // Validate required fields
        if (!platforms || platforms.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one platform is required'
            });
        }

        if (!content || (!content.caption && !content.mediaUrl)) {
            return res.status(400).json({
                success: false,
                message: 'Content with caption or media is required'
            });
        }

        // Use the same controller logic but without user context
        const publisher = require('../services/platformPublisher');
        
        // Publish to all platforms
        const publishResults = [];
        for (const platform of platforms) {
            try {
                console.log(`🚀 Publishing to ${platform}...`);
                const result = await publisher.publishToPlatform(platform, content);
                publishResults.push(result);
                console.log(`✅ Published to ${platform}:`, result);
            } catch (error) {
                console.error(`❌ Failed to publish to ${platform}:`, error.message);
                publishResults.push({
                    success: false,
                    platform,
                    error: error.message
                });
            }
        }

        // Check if any platforms succeeded
        const successCount = publishResults.filter(r => r.success).length;
        const totalCount = platforms.length;

        res.json({
            success: successCount > 0,
            message: `Published to ${successCount}/${totalCount} platforms`,
            post: {
                id: Date.now(),
                platforms: publishResults,
                timestamp: new Date().toISOString(),
                results: publishResults
            }
        });

    } catch (error) {
        console.error('Error publishing post:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to publish post',
            error: error.message
        });
    }
});

// Apply Clerk authentication to protected routes
router.use(clerkAuthMiddleware);

// Publish post immediately
router.post('/publish', publishNow);

// Get platform connection status
router.get('/platforms/status', getPlatformStatus);

module.exports = router;
