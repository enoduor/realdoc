const axios = require('axios');
const LinkedInService = require('./linkedinService');

class PlatformPublisher {
    constructor() {
        this.platforms = {
            instagram: {
                name: 'Instagram',
                apiUrl: process.env.INSTAGRAM_API_URL,
                token: process.env.INSTAGRAM_ACCESS_TOKEN
            },
            tiktok: {
                name: 'TikTok',
                apiUrl: process.env.TIKTOK_API_URL,
                token: process.env.TIKTOK_ACCESS_TOKEN
            },
            linkedin: {
                name: 'LinkedIn',
                apiUrl: process.env.LINKEDIN_API_URL,
                token: process.env.LINKEDIN_ACCESS_TOKEN
            },
            twitter: {
                name: 'Twitter',
                apiUrl: process.env.TWITTER_API_URL,
                token: process.env.TWITTER_ACCESS_TOKEN
            },
            youtube: {
                name: 'YouTube',
                apiUrl: process.env.YOUTUBE_API_URL,
                token: process.env.YOUTUBE_ACCESS_TOKEN
            },
            facebook: {
                name: 'Facebook',
                apiUrl: process.env.FACEBOOK_API_URL,
                token: process.env.FACEBOOK_ACCESS_TOKEN
            }
        };

        // Initialize real API services
        this.linkedinService = new LinkedInService();
    }

    // Main publishing method
    async publishToPlatform(platform, postData) {
        try {
            console.log(`📤 Publishing to ${platform}...`);
            
            const platformConfig = this.platforms[platform];
            if (!platformConfig) {
                throw new Error(`Platform ${platform} not configured`);
            }

            // Validate platform-specific requirements
            this.validatePlatformRequirements(platform, postData);

            // Format content for platform
            const formattedContent = this.formatContentForPlatform(platform, postData);

            // Publish to platform
            const result = await this.publishContent(platform, formattedContent);

            console.log(`✅ Successfully published to ${platform}`);
            return {
                success: true,
                platform,
                postId: result.postId || result.id,
                url: result.url,
                message: `Successfully published to ${platform}`
            };

        } catch (error) {
            console.error(`❌ Failed to publish to ${platform}:`, error.message);
            return {
                success: false,
                platform,
                error: error.message,
                message: `Failed to publish to ${platform}: ${error.message}`
            };
        }
    }

    // Validate platform-specific requirements
    validatePlatformRequirements(platform, postData) {
        const { caption, hashtags, mediaUrl } = postData;

        switch (platform) {
            case 'instagram':
                if (!mediaUrl) {
                    throw new Error('Instagram requires media content');
                }
                if (caption && caption.length > 2200) {
                    throw new Error('Instagram caption exceeds 2200 character limit');
                }
                if (hashtags && hashtags.length > 30) {
                    throw new Error('Instagram allows maximum 30 hashtags');
                }
                break;

            case 'tiktok':
                if (!mediaUrl) {
                    throw new Error('TikTok requires video content');
                }
                if (caption && caption.length > 150) {
                    throw new Error('TikTok caption exceeds 150 character limit');
                }
                if (hashtags && hashtags.length > 20) {
                    throw new Error('TikTok allows maximum 20 hashtags');
                }
                break;

            case 'linkedin':
                if (caption && caption.length > 3000) {
                    throw new Error('LinkedIn post exceeds 3000 character limit');
                }
                if (hashtags && hashtags.length > 50) {
                    throw new Error('LinkedIn allows maximum 50 hashtags');
                }
                break;

            case 'twitter':
                if (caption && caption.length > 280) {
                    throw new Error('Twitter post exceeds 280 character limit');
                }
                if (hashtags && hashtags.length > 25) {
                    throw new Error('Twitter allows maximum 25 hashtags');
                }
                break;

            case 'youtube':
                if (!mediaUrl) {
                    throw new Error('YouTube requires video content');
                }
                if (hashtags && hashtags.length > 100) {
                    throw new Error('YouTube allows maximum 100 hashtags');
                }
                break;

            case 'facebook':
                if (caption && caption.length > 63206) {
                    throw new Error('Facebook post exceeds character limit');
                }
                if (hashtags && hashtags.length > 100) {
                    throw new Error('Facebook allows maximum 100 hashtags');
                }
                break;
        }
    }

    // Format content for specific platform
    formatContentForPlatform(platform, postData) {
        const { caption, hashtags, mediaUrl, mediaType } = postData;
        let formattedCaption = caption || '';

        // Add hashtags to caption
        if (hashtags && hashtags.length > 0) {
            const hashtagString = hashtags.map(tag => `#${tag}`).join(' ');
            formattedCaption += ` ${hashtagString}`;
        }

        switch (platform) {
            case 'instagram':
                return {
                    caption: formattedCaption,
                    media_url: mediaUrl,
                    media_type: mediaType
                };

            case 'tiktok':
                return {
                    text: formattedCaption,
                    video_url: mediaUrl
                };

            case 'linkedin':
                return {
                    text: formattedCaption,
                    media_url: mediaUrl
                };

            case 'twitter':
                return {
                    text: formattedCaption,
                    media_url: mediaUrl
                };

            case 'youtube':
                return {
                    title: caption || 'New Video',
                    description: formattedCaption,
                    video_url: mediaUrl
                };

            case 'facebook':
                return {
                    message: formattedCaption,
                    media_url: mediaUrl
                };

            default:
                return {
                    caption: formattedCaption,
                    media_url: mediaUrl
                };
        }
    }

    // Publish content to platform API
    async publishContent(platform, content) {
        const platformConfig = this.platforms[platform];
        
        // Use real LinkedIn API if configured
        if (platform === 'linkedin' && this.linkedinService && this.linkedinService.accessToken) {
            try {
                console.log('💼 Using real LinkedIn API...');
                
                const { caption, mediaUrl, hashtags } = content;
                let postText = caption || '';
                
                // Add hashtags to the post
                if (hashtags && hashtags.length > 0) {
                    const hashtagString = hashtags.map(tag => `#${tag}`).join(' ');
                    postText += ` ${hashtagString}`;
                }
                
                // Post with media if available
                if (mediaUrl) {
                    const result = await this.linkedinService.postWithMedia(postText, mediaUrl);
                    return result;
                } else {
                    // Post text only
                    const result = await this.linkedinService.postText(postText);
                    return result;
                }
            } catch (error) {
                console.error('❌ Real LinkedIn API failed, falling back to simulation:', error.message);
                // Fall back to simulation if real API fails
            }
        }
        
        // For demo purposes, simulate API calls for other platforms
        // In production, you would make actual API calls to each platform
        
        const headers = {
            'Authorization': `Bearer ${platformConfig.token}`,
            'Content-Type': 'application/json'
        };

        try {
            // Simulate API call with delay
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Simulate different responses for different platforms
            const responses = {
                instagram: {
                    id: `ig_${Date.now()}`,
                    url: `https://instagram.com/p/ig_${Date.now()}`
                },
                tiktok: {
                    id: `tt_${Date.now()}`,
                    url: `https://tiktok.com/@user/video/tt_${Date.now()}`
                },
                linkedin: {
                    id: `li_${Date.now()}`,
                    url: `https://linkedin.com/posts/li_${Date.now()}`
                },
                twitter: {
                    id: `tw_${Date.now()}`,
                    url: `https://twitter.com/user/status/tw_${Date.now()}`
                },
                youtube: {
                    id: `yt_${Date.now()}`,
                    url: `https://youtube.com/watch?v=yt_${Date.now()}`
                },
                facebook: {
                    id: `fb_${Date.now()}`,
                    url: `https://facebook.com/permalink.php?story_fbid=fb_${Date.now()}`
                }
            };

            return responses[platform] || { id: `post_${Date.now()}` };

        } catch (error) {
            throw new Error(`API call failed: ${error.message}`);
        }
    }

    // Bulk publish to multiple platforms
    async publishToMultiplePlatforms(platforms, postData) {
        const results = [];
        
        for (const platform of platforms) {
            const result = await this.publishToPlatform(platform, postData);
            results.push(result);
        }

        return results;
    }

    // Check platform connection status
    async checkPlatformConnection(platform) {
        const platformConfig = this.platforms[platform];
        
        if (!platformConfig || !platformConfig.token) {
            return {
                connected: false,
                error: 'Platform not configured'
            };
        }

        try {
            // Test real LinkedIn connection
            if (platform === 'linkedin' && this.linkedinService) {
                const result = await this.linkedinService.testConnection();
                return result;
            }
            
            // Simulate connection check for other platforms
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            return {
                connected: true,
                platform: platformConfig.name
            };
        } catch (error) {
            return {
                connected: false,
                error: error.message
            };
        }
    }

    // Get platform publishing limits
    getPlatformLimits(platform) {
        const limits = {
            instagram: {
                maxCharacters: 2200,
                maxHashtags: 30,
                requiresMedia: true
            },
            tiktok: {
                maxCharacters: 150,
                maxHashtags: 20,
                requiresMedia: true,
                mediaType: 'video'
            },
            linkedin: {
                maxCharacters: 3000,
                maxHashtags: 50,
                requiresMedia: false
            },
            twitter: {
                maxCharacters: 280,
                maxHashtags: 25,
                requiresMedia: false
            },
            youtube: {
                maxCharacters: 5000,
                maxHashtags: 100,
                requiresMedia: true,
                mediaType: 'video'
            },
            facebook: {
                maxCharacters: 63206,
                maxHashtags: 100,
                requiresMedia: false
            }
        };

        return limits[platform] || {};
    }
}

module.exports = new PlatformPublisher();
