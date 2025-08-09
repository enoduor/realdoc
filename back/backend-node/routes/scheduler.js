const express = require('express');
const router = express.Router();
const { clerkAuthMiddleware } = require('../middleware/clerkAuth');
const {
    publishNow,
    schedulePost,
    getPlatformStatus
} = require('../controllers/schedulerController');

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

// Apply Clerk authentication to protected routes
router.use(clerkAuthMiddleware);

// Publish post immediately
router.post('/publish', publishNow);

// Get platform connection status
router.get('/platforms/status', getPlatformStatus);

module.exports = router;
