/* eslint-disable no-console */
const fetch = require('node-fetch');
const axios = require('axios');
const LinkedInToken = require('../models/LinkedInToken');
const FormData = require('form-data');
const path = require('path');

const PYTHON_API_BASE_URL = process.env.PYTHON_API_BASE_URL || 'http://localhost:5001';
const MediaManagerService = require('./mediaManagerService');

class LinkedInService {
  constructor(config = {}) {
    // Configuration can be added here if needed
    this.mediaManager = MediaManagerService.getInstance();
  }

  /**
   * Find a LinkedIn token doc by { linkedinUserId }, { clerkUserId }, or { userId }
   */
  async findToken(identifier = {}) {
    if (identifier.linkedinUserId) {
      return LinkedInToken.findOne({ linkedinUserId: identifier.linkedinUserId });
    }
    if (identifier.clerkUserId) {
      return LinkedInToken.findOne({ clerkUserId: identifier.clerkUserId, linkedinUserId: { $exists: true } });
    }
    if (identifier.userId) {
      return LinkedInToken.findOne({ userId: identifier.userId, linkedinUserId: { $exists: true } });
    }
    return null;
  }

  /**
   * Returns a valid access token, checking if expired
   */
  async getValidLinkedInToken(identifier) {
    const doc = await this.findToken(identifier);
    if (!doc) throw new Error('LinkedIn not connected for this user');

    const now = Date.now();
    const expiresAtMs = new Date(doc.expiresAt).getTime();
    const isExpired = expiresAtMs && (expiresAtMs - now) < 0;

    if (isExpired) {
      throw new Error('LinkedIn token has expired. Please reconnect your LinkedIn account.');
    }

    return doc.accessToken;
  }

  /**
   * Get LinkedIn user profile
   */
  async getLinkedInProfile(identifier) {
    const doc = await this.findToken(identifier);
    if (!doc) throw new Error('LinkedIn not connected for this user');

    return {
      linkedinUserId: doc.linkedinUserId,
      firstName: doc.firstName,
      lastName: doc.lastName,
      fullName: `${doc.firstName} ${doc.lastName}`.trim()
    };
  }

  /**
   * Download media from external URL to buffer
   */
  async downloadToBuffer(url) {
    console.log('[LinkedIn] Downloading media from external URL:', url);
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000,
        maxContentLength: 50 * 1024 * 1024,
        maxBodyLength: 50 * 1024 * 1024,
        headers: { 'User-Agent': 'CreatorSync/1.0' }
      });
      const buffer = Buffer.from(response.data);
      console.log('[LinkedIn] Media downloaded successfully, size:', buffer.length, 'bytes');
      return buffer;
    } catch (error) {
      console.error('[LinkedIn] Failed to download media:', error.message);
      throw new Error('Failed to download media from external URL');
    }
  }

  /**
   * Rehost media to S3 for reliable LinkedIn access
   */
  async rehostToS3(buffer, originalUrl) {
    console.log('[LinkedIn] Rehosting media to S3 for reliable LinkedIn access...');
    try {
      const form = new FormData();
      const filename = path.basename(originalUrl.split('?')[0]) || 'media';
      const contentType = 'video/mp4'; // Will be overridden by detectMedia
      
      form.append('file', buffer, { filename, contentType });
      form.append('platform', 'linkedin');

      const resp = await axios.post(`${PYTHON_API_BASE_URL}/api/v1/upload`, form, {
        headers: form.getHeaders(),
        timeout: 60000,
      });
      
      if (!resp.data?.url) throw new Error('S3 rehost failed: no URL returned');
      
      console.log('[LinkedIn] Media rehosted to S3:', resp.data.url);
      return resp.data.url;
    } catch (error) {
      console.error('[LinkedIn] Failed to rehost media to S3:', error.message);
      throw new Error('Failed to rehost media to S3');
    }
  }

  /**
   * Post to LinkedIn using user-specific token
   * Now uses LinkedIn-style approach: download external media, rehost to S3, then upload to LinkedIn
   * ✅ UPDATED: Now actually implements the LinkedIn-style approach (was using old direct method)
   */
  async postToLinkedIn(identifier, message, mediaUrl = null, hashtags = []) {
    // ✅ CREDENTIAL CHECK AT THE START (consistent with other platforms)
    const accessToken = await this.getValidLinkedInToken(identifier);
    const profile = await this.getLinkedInProfile(identifier);

    // Format hashtags
    const hashtagString = hashtags.length > 0 ? '\n\n' + hashtags.map(tag => `#${tag.replace(/^#/, '')}`).join(' ') : '';
    
    // Add timestamp to prevent duplicate posts
    const timestamp = new Date().toISOString();
    const timestampString = `\n\n🕐 Posted at ${new Date().toLocaleString()}`;
    
    // Combine message, hashtags, and timestamp
    const fullMessage = `${message}${hashtagString}${timestampString}`;

    // Detect media type from URL or file extension
    const getMediaType = (url) => {
      if (!url) return null;
      const lowerUrl = url.toLowerCase();
      
      // Video formats - comprehensive list
      const videoExtensions = [
        '.mp4', '.mov', '.avi', '.webm', '.mkv', '.flv', '.wmv', '.m4v', 
        '.3gp', '.ogv', '.ts', '.mts', '.m2ts', '.vob', '.asf', '.rm', 
        '.rmvb', '.divx', '.xvid', '.h264', '.h265', '.hevc', '.vp8', '.vp9'
      ];
      
      // Image formats
      const imageExtensions = [
        '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.svg', 
        '.ico', '.raw', '.cr2', '.nef', '.arw', '.dng'
      ];
      
      // Check for video extensions
      if (videoExtensions.some(ext => lowerUrl.includes(ext))) {
        return 'VIDEO';
      }
      
      // Check for image extensions
      if (imageExtensions.some(ext => lowerUrl.includes(ext))) {
        return 'IMAGE';
      }
      
      // Default to VIDEO for unknown types (most social media URLs are videos)
      return 'VIDEO';
    };

    const mediaType = getMediaType(mediaUrl);

    // LinkedIn API endpoint
    const url = 'https://api.linkedin.com/v2/ugcPosts';
    
    // Base payload - always includes text content
    const payload = {
      author: `urn:li:person:${profile.linkedinUserId}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: fullMessage
          },
          shareMediaCategory: mediaUrl ? mediaType : 'NONE'
        }
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
      }
    };

    // Only add media if mediaUrl is provided
    if (mediaUrl) {
      try {
        // LinkedIn requires asset registration first
        console.log(`[LinkedIn] Uploading ${mediaType} asset: ${mediaUrl}`);
        
        // Step 1: Register the asset
        const assetResponse = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0',
            'LinkedIn-Version': '202503'
          },
          body: JSON.stringify({
            registerUploadRequest: {
              recipes: [mediaType === 'VIDEO' ? 'urn:li:digitalmediaRecipe:feedshare-video' : 'urn:li:digitalmediaRecipe:feedshare-image'],
              owner: `urn:li:person:${profile.linkedinUserId}`,
              serviceRelationships: [{
                relationshipType: 'OWNER',
                identifier: 'urn:li:userGeneratedContent'
              }]
            }
          })
        });

        if (!assetResponse.ok) {
          throw new Error(`Asset registration failed: ${assetResponse.status}`);
        }

        const assetData = await assetResponse.json();
        const uploadUrl = assetData.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
        const asset = assetData.value.asset;

        // Step 2: Get consistent media URL via centralized manager
        console.log('[LinkedIn] Getting consistent media URL via centralized manager...');
        const s3Url = await this.mediaManager.getConsistentMediaUrl(mediaUrl, 'video');
        console.log('[LinkedIn] Using consistent S3 URL via centralized manager:', s3Url);
        
        // Step 3: Upload the rehosted media to LinkedIn using S3 URL (like Instagram)
        console.log('[LinkedIn] Using rehosted S3 URL for LinkedIn upload:', s3Url);
        const mediaResponse = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/octet-stream'
          },
          body: await fetch(s3Url).then(res => res.arrayBuffer())
        });

        if (!mediaResponse.ok) {
          throw new Error(`Media upload failed: ${mediaResponse.status}`);
        }

        console.log(`[LinkedIn] ${mediaType} uploaded successfully, asset: ${asset}`);

        // Step 3: Add media to post payload
        payload.specificContent['com.linkedin.ugc.ShareContent'].media = [{
          status: 'READY',
          description: {
            text: 'Media content'
          },
          media: asset,
          title: {
            text: 'LinkedIn Post'
          }
        }];

      } catch (error) {
        console.error(`[LinkedIn] Media upload failed: ${error.message}, falling back to text-only post`);
        payload.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory = 'NONE';
      }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version': '202503'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('LinkedIn API Error:', response.status, errorData);
      throw new Error(`LinkedIn API error: ${response.status} ${errorData}`);
    }

    const result = await response.json();
    const postId = result.id;
    const linkedinUrl = `https://www.linkedin.com/feed/update/${postId}`;
    
    return {
      success: true,
      postId: postId,
      url: linkedinUrl,
      message: 'Successfully posted to LinkedIn'
    };
  }
}

module.exports = LinkedInService;