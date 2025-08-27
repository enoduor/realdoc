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

        // Publish to all platforms
        const publishResults = [];
        for (const platform of platforms) {
            try {
                console.log(`🚀 Publishing to ${platform}...`);
                const result = await platformPublisher.publishToPlatform(platform, { ...content, clerkUserId });
                
                publishResults.push({
                    success: true,
                    platform,
                    result
                });
                
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
