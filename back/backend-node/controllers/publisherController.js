const PlatformPublisher = require('../services/platformPublisher');
const platformPublisher = new PlatformPublisher();
const { findToken, getTwitterHandle } = require('../services/twitterService');
const { getPlatformConnectionStatus, getUserSubscriptionStatus } = require('../utils/tokenUtils');

// Publish post immediately to platforms
exports.publishNow = async (req, res) => {
    try {
        const { platforms, content } = req.body;
        const clerkUserId = (typeof req.auth === 'function' ? req.auth().userId : req.auth?.userId);

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

        // Publish to all platforms in parallel
        console.log(`🚀 Publishing to ${platforms.length} platforms in parallel: ${platforms.join(', ')}`);
        
        const publishPromises = platforms.map(async (platform) => {
            try {
                console.log(`🚀 Starting publish to ${platform}...`);
                const result = await platformPublisher.publishToPlatform(platform, { ...content, clerkUserId });
                
                console.log(`✅ Published to ${platform}:`, result);
                return {
                    success: true,
                    platform,
                    result
                };
            } catch (error) {
                console.error(`❌ Failed to publish to ${platform}:`, error.message);
                return {
                    success: false,
                    platform,
                    error: error.message
                };
            }
        });

        // Wait for all platforms to complete
        const publishResults = await Promise.allSettled(publishPromises);
        
        // Extract results from Promise.allSettled format
        const finalResults = publishResults.map((promiseResult, index) => {
            if (promiseResult.status === 'fulfilled') {
                return promiseResult.value;
            } else {
                return {
                    success: false,
                    platform: platforms[index],
                    error: promiseResult.reason?.message || 'Unknown error'
                };
            }
        });

        // Check if any platforms succeeded
        const successCount = finalResults.filter(r => r.success).length;
        const totalCount = platforms.length;

        res.json({
            success: successCount > 0,
            message: `Published to ${successCount}/${totalCount} platforms`,
            post: {
                id: Date.now(),
                platforms: finalResults,
                timestamp: new Date().toISOString(),
                results: finalResults
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
};

// Get platform status (for checking if platforms are connected)
exports.getPlatformStatus = async (req, res) => {
    try {
        const clerkUserId = (typeof req.auth === 'function' ? req.auth().userId : req.auth?.userId);
        
        if (!clerkUserId) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated'
            });
        }

        // Get platform connection status using standardized utility
        const platformStatus = await getPlatformConnectionStatus(clerkUserId);
        
        // Get user subscription status
        const subscriptionStatus = await getUserSubscriptionStatus(clerkUserId);

        res.json({
            success: true,
            platforms: platformStatus,
            subscription: subscriptionStatus
        });

    } catch (error) {
        console.error('Error getting platform status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get platform status',
            error: error.message
        });
    }
};
