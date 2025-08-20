const platformPublisher = require('../services/platformPublisher');
const { findToken, getTwitterHandle } = require('../services/twitterService');

// Publish post immediately to platforms
exports.publishNow = async (req, res) => {
    try {
        const { platforms, content } = req.body;
        const userId = req.auth?.userId;

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
                const result = await platformPublisher.publishToPlatform(platform, { ...content, userId });
                
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
        const userId = req.auth?.userId;
        
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
                } else if (platform === 'twitter') {
                    // Test Twitter connection - look for any valid Twitter token
                    try {
                        // First try to find by userId (if user is authenticated)
                        let tokenDoc = null;
                        if (userId) {
                            tokenDoc = await findToken({ userId });
                        }
                        
                        // If no token found by userId, try to find by email
                        if (!tokenDoc) {
                            // Get user email from Clerk or other source
                            const userEmail = req.auth?.sessionClaims?.email || 'erick@oduor.net'; // fallback for testing
                            if (userEmail) {
                                tokenDoc = await findToken({ email: userEmail });
                                if (tokenDoc) {
                                    console.log('[Platform Status] Found Twitter token by email:', userEmail);
                                }
                            }
                        }
                        
                        // If still no token found
                        if (!tokenDoc) {
                            console.log('[Platform Status] No Twitter token found for user:', userId);
                            status[platform] = {
                                connected: false,
                                canPost: false,
                                message: 'No Twitter account connected. Please connect your Twitter account first via OAuth.'
                            };
                            continue; // Skip to next platform
                        }
                        
                        if (tokenDoc) {
                            // Don't make API calls to validate - just check if we have the required fields
                            const hasValidTokens = tokenDoc.oauthToken && tokenDoc.oauthTokenSecret;
                            
                            if (hasValidTokens) {
                                status[platform] = {
                                    connected: true,
                                    canPost: true,
                                    user: {
                                        twitterUserId: tokenDoc.twitterUserId,
                                        handle: tokenDoc.handle || 'Unknown',
                                        name: tokenDoc.name || 'Unknown'
                                    }
                                };
                            } else {
                                status[platform] = {
                                    connected: false,
                                    canPost: false,
                                    error: 'Invalid token format',
                                    message: 'Please reconnect your Twitter account'
                                };
                            }
                        } else {
                            status[platform] = {
                                connected: false,
                                canPost: false,
                                message: 'No Twitter account connected. Please connect your Twitter account first via OAuth.'
                            };
                        }
                    } catch (twitterError) {
                        console.error('Twitter status check failed:', twitterError);
                        status[platform] = {
                            connected: false,
                            canPost: false,
                            error: twitterError.message
                        };
                    }
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
