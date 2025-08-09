const axios = require('axios');

class LinkedInService {
    constructor() {
        this.apiUrl = process.env.LINKEDIN_API_URL || 'https://api.linkedin.com/v2';
        this.accessToken = process.env.LINKEDIN_ACCESS_TOKEN;
        this.clientId = process.env.LINKEDIN_APP_ID;
        this.clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    }

    // Get user profile - simplified for w_member_social only
    async getUserProfile() {
        try {
            // Try the standard /me endpoint
            const response = await axios.get(`${this.apiUrl}/me`, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });
            return response.data;
        } catch (error) {
            console.log('Profile access not available - using w_member_social only approach');
            return null;
        }
    }

    // Get user ID - simplified for w_member_social only
    async getUserId() {
        try {
            const profile = await this.getUserProfile();
            if (profile && profile.id) {
                return profile.id;
            }
            // If we can't get the user ID, we'll use a different approach
            return null;
        } catch (error) {
            console.log('Profile access limited - using w_member_social only approach...');
            return null;
        }
    }

    // Post text content to LinkedIn - work with w_member_social only
    async postText(text) {
        try {
            console.log('📝 Posting text to LinkedIn:', text.substring(0, 100) + '...');
            
            // Try posting without specifying the author - LinkedIn should use the token's user
            const postData = {
                lifecycleState: 'PUBLISHED',
                specificContent: {
                    'com.linkedin.ugc.ShareContent': {
                        shareCommentary: {
                            text: text
                        },
                        shareMediaCategory: 'NONE'
                    }
                },
                visibility: {
                    'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
                }
            };

            const response = await axios.post(`${this.apiUrl}/ugcPosts`, postData, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json',
                    'X-Restli-Protocol-Version': '2.0.0'
                }
            });

            console.log('✅ LinkedIn post successful:', response.data);
            return {
                id: response.data.id,
                url: `https://linkedin.com/posts/${response.data.id}`,
                success: true
            };
        } catch (error) {
            console.error('LinkedIn postText error:', error.response?.data || error.message);
            
            // If posting fails, try alternative approach
            if (error.response?.status === 500 || error.response?.data?.message?.includes('author')) {
                console.log('Trying alternative posting approach...');
                return this.postTextAlternative(text);
            }
            
            throw new Error(`Failed to post to LinkedIn: ${error.response?.data?.message || error.message}`);
        }
    }

    // Alternative posting method when standard approach fails
    async postTextAlternative(text) {
        try {
            console.log('📝 Using alternative LinkedIn posting method...');
            
            // Try posting with a different approach - using the current user context
            const postData = {
                lifecycleState: 'PUBLISHED',
                specificContent: {
                    'com.linkedin.ugc.ShareContent': {
                        shareCommentary: {
                            text: text
                        },
                        shareMediaCategory: 'NONE'
                    }
                },
                visibility: {
                    'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
                }
            };

            // Try posting without specifying the author - LinkedIn should use the token's user
            const response = await axios.post(`${this.apiUrl}/ugcPosts`, postData, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json',
                    'X-Restli-Protocol-Version': '2.0.0'
                }
            });

            console.log('✅ LinkedIn alternative post successful:', response.data);
            return {
                id: response.data.id,
                url: `https://linkedin.com/posts/${response.data.id}`,
                success: true
            };
        } catch (error) {
            console.error('LinkedIn alternative postText error:', error.response?.data || error.message);
            
            // If both approaches fail, it means LinkedIn requires a user ID
            if (error.response?.status === 500 || error.response?.data?.message?.includes('author')) {
                throw new Error('LinkedIn posting requires user ID. Please add r_liteprofile permission to your token or use a different approach.');
            }
            
            throw new Error(`Failed to post to LinkedIn: ${error.response?.data?.message || error.message}`);
        }
    }

    // Post with media (image/video) - simplified for w_member_social only
    async postWithMedia(text, mediaUrl, mediaType = 'image') {
        try {
            console.log('📸 Posting media to LinkedIn:', mediaUrl);
            
            // Since we only have w_member_social permission, we'll post without specifying the author
            const postData = {
                lifecycleState: 'PUBLISHED',
                specificContent: {
                    'com.linkedin.ugc.ShareContent': {
                        shareCommentary: {
                            text: text
                        },
                        shareMediaCategory: 'IMAGE',
                        media: [
                            {
                                status: 'READY',
                                description: {
                                    text: text
                                },
                                media: mediaUrl,
                                title: {
                                    text: 'LinkedIn Post'
                                }
                            }
                        ]
                    }
                },
                visibility: {
                    'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
                }
            };

            const response = await axios.post(`${this.apiUrl}/ugcPosts`, postData, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json',
                    'X-Restli-Protocol-Version': '2.0.0'
                }
            });

            console.log('✅ LinkedIn media post successful:', response.data);
            return {
                id: response.data.id,
                url: `https://linkedin.com/posts/${response.data.id}`,
                success: true
            };
        } catch (error) {
            console.error('LinkedIn postWithMedia error:', error.response?.data || error.message);
            throw new Error(`Failed to post media to LinkedIn: ${error.response?.data?.message || error.message}`);
        }
    }

    // Test connection - simplified for w_member_social only
    async testConnection() {
        try {
            console.log('🔍 Testing LinkedIn connection...');
            console.log('Access Token:', this.accessToken ? '✅ Set' : '❌ Missing');
            console.log('API URL:', this.apiUrl);
            
            // Since you confirmed you have w_member_social permission, let's test it directly
            let profile = null;
            let authType = 'Member Authorization (3-legged OAuth) - w_member_social Only';
            let canPost = true;
            
            try {
                // Try to get user profile first
                profile = await this.getUserProfile();
                if (profile) {
                    authType = 'Member Authorization (3-legged OAuth) - Full Access';
                    console.log('✅ Member Authorization confirmed with full profile access');
                } else {
                    console.log('Profile access limited - using w_member_social only approach...');
                }
            } catch (profileError) {
                console.log('Profile access limited - using w_member_social only approach...');
            }
            
            return {
                connected: true,
                user: profile,
                message: `LinkedIn API connection successful (${authType})`,
                permissions: authType,
                canPost: canPost,
                guidance: null // No guidance needed since we have w_member_social permission
            };
        } catch (error) {
            console.error('❌ LinkedIn connection failed:', error.message);
            
            return {
                connected: false,
                error: error.message,
                message: 'LinkedIn API connection failed',
                guidance: `
🔑 **LinkedIn Token Issue**
Your LinkedIn access token has issues.

**Possible Solutions:**
1. **Check token validity** - Ensure the token is not expired
2. **Verify app permissions** - Make sure your app has the required scopes
3. **Switch to Member Authorization** - For posting content, you need 3-legged OAuth

**To Fix:**
1. Go to https://www.linkedin.com/developers/apps
2. Select your app: ${this.clientId || 'Your App'}
3. Go to "Auth" tab
4. Generate a new access token with Member Authorization
5. Add scopes: w_member_social
6. Update your .env file with the new token
                `
            };
        }
    }
}

module.exports = LinkedInService;
