const platformPublisher = require('../services/platformPublisher');

// Publish post immediately to platforms
exports.publishNow = async (req, res) => {
    try {
        const { platforms, content } = req.body;
        const userId = req.user.userId;

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
                const result = await platformPublisher.publishToPlatform(platform, content);
                
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
            results: publishResults
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
        const userId = req.user.userId;
        
        // Simple platform status check
        const platforms = ['linkedin', 'twitter', 'instagram'];
        const status = {};
        
        for (const platform of platforms) {
            try {
                if (platform === 'linkedin') {
                    // Test LinkedIn connection
                    const linkedinService = require('../services/linkedinService');
                    const testResult = await linkedinService.testConnection();
                    status[platform] = {
                        connected: testResult.connected,
                        canPost: testResult.canPost,
                        user: testResult.user
                    };
                } else {
                    // Other platforms not implemented yet
                    status[platform] = {
                        connected: false,
                        canPost: false,
                        message: 'Not implemented yet'
                    };
                }
            } catch (error) {
                status[platform] = {
                    connected: false,
                    canPost: false,
                    error: error.message
                };
            }
        }

        res.json({
            success: true,
            platforms: status
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
