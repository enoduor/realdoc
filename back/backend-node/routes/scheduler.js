const express = require('express');
const router = express.Router();
const { clerkAuthMiddleware } = require('../middleware/clerkAuth');
const {
    schedulePost,
    publishNow,
    getUserPosts,
    getPost,
    updatePost,
    deletePost,
    retryPost,
    getPlatformStatus
} = require('../controllers/schedulerController');
const LinkedInService = require('../services/linkedinService');

// Apply Clerk authentication to all routes
router.use(clerkAuthMiddleware);

// Schedule a post
router.post('/schedule', schedulePost);

// Publish post immediately
router.post('/publish', publishNow);

// Get user's posts with pagination and filtering
router.get('/posts', getUserPosts);

// Get specific post
router.get('/posts/:postId', getPost);

// Update scheduled post
router.put('/posts/:postId', updatePost);

// Delete scheduled post
router.delete('/posts/:postId', deletePost);

// Retry failed post
router.post('/posts/:postId/retry', retryPost);

// Get platform connection status
router.get('/platforms/status', getPlatformStatus);

// Test LinkedIn API connection
router.get('/test-linkedin', async (req, res) => {
    try {
        const linkedinService = new LinkedInService();
        
        // Check if LinkedIn is configured
        if (!linkedinService.accessToken) {
            return res.status(400).json({
                success: false,
                message: 'LinkedIn API not configured. Please add LINKEDIN_ACCESS_TOKEN to your environment variables.'
            });
        }

        // Test the connection
        const result = await linkedinService.testConnection();
        
        if (result.connected) {
            res.json({
                success: true,
                message: 'LinkedIn API is properly configured and connected!',
                user: result.user
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'LinkedIn API connection failed',
                error: result.error
            });
        }

    } catch (error) {
        console.error('LinkedIn test error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to test LinkedIn API',
            error: error.message
        });
    }
});

module.exports = router;
