const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
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

// Apply authentication middleware to all routes
router.use(authenticateToken);

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

module.exports = router;
