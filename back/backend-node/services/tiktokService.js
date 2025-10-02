/* back/backend-node/services/tiktokService.js */
const axios = require('axios');
const qs = require('qs');
const dayjs = require('dayjs');
const TikTokToken = require('../models/TikTokToken');
const FormData = require('form-data');
const path = require('path');
const { abs } = require('../config/url');

// Use production API to match tiktokAuth.js
const TIKTOK_API_BASE = process.env.TIKTOK_API_URL || 'https://open.tiktokapis.com/v2';
const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;

const PYTHON_API_BASE_URL = process.env.PYTHON_API_BASE_URL || 'http://localhost:5001';
const MediaManagerService = require('./mediaManagerService');

class TikTokService {
  constructor(config = {}) {
    // Configuration can be added here if needed
    this.mediaManager = MediaManagerService.getInstance();
  }

  isExpiringSoon(expiresAt) {
    // refresh 5 minutes before expiry
    return dayjs(expiresAt).diff(dayjs(), 'second') < 300;
  }

  async exchangeCodeForToken(code) {
    const url = `${TIKTOK_API_BASE}/oauth/token/`;
    const payload = {
      client_key: CLIENT_KEY,
      client_secret: CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: abs('api/auth/tiktok/callback'),
    };

    console.log('🔄 [TikTok Token Exchange] Request:', {
      url,
      client_key: CLIENT_KEY ? 'SET' : 'MISSING',
      client_secret: CLIENT_SECRET ? 'SET' : 'MISSING',
      code: code ? 'SET' : 'MISSING',
      redirect_uri: abs('api/auth/tiktok/callback')
    });

    try {
      // Try with form-encoded data (TikTok might expect this format)
      const formData = new URLSearchParams(payload).toString();
      console.log('🔍 [TikTok Token Exchange] Form data:', formData);
      
      const { data } = await axios.post(url, formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      console.log('✅ [TikTok Token Exchange] Success:', {
        access_token: data.access_token ? 'SET' : 'MISSING',
        refresh_token: data.refresh_token ? 'SET' : 'MISSING',
        expires_in: data.expires_in,
        token_type: data.token_type,
        scope: data.scope
      });

      // 🔍 DEBUG: Log the full response to see what TikTok is actually returning
      console.log('🔍 [TikTok Token Exchange] Full response:', JSON.stringify(data, null, 2));

      // data: { access_token, refresh_token, expires_in, token_type, scope }
      const expiresAt = dayjs().add(data.expires_in, 'second').toDate();
      return { ...data, expiresAt };
    } catch (error) {
      console.error('❌ [TikTok Token Exchange] Failed:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      throw error;
    }
  }

  async refreshAccessToken(doc) {
    const url = `${TIKTOK_API_BASE}/oauth/token/`;
    const payload = {
      client_key: CLIENT_KEY,
      client_secret: CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: doc.refreshToken,
    };

    const { data } = await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json' },
    });

    // TikTok rotates refresh_token!
    const expiresAt = dayjs().add(data.expires_in, 'second').toDate();

    doc.accessToken = data.access_token;
    if (data.refresh_token) doc.refreshToken = data.refresh_token;
    if (data.scope) doc.scope = data.scope;
    if (data.token_type) doc.tokenType = data.token_type;
    doc.expiresAt = expiresAt;

    await doc.save();
    return doc.accessToken;
  }

  async getValidAccessTokenByClerk(clerkUserId) {
    const doc = await TikTokToken.findOne({ clerkUserId });
    if (!doc) throw new Error('TikTok not connected for this user');
    if (this.isExpiringSoon(doc.expiresAt)) {
      try {
        return await this.refreshAccessToken(doc);
      } catch (e) {
        // bubble up so caller can re-auth if needed
        throw new Error(`TikTok token refresh failed: ${e.message}`);
      }
    }
    return doc.accessToken;
  }

  /**
   * Get TikTok profile information (matches tiktokAuth.js profile fetching)
   */
  async getTikTokProfile(identifier) {
    const { clerkUserId } = identifier;
    const doc = await TikTokToken.findOne({ clerkUserId });
    if (!doc) throw new Error('TikTok not connected for this user');
    
    return {
      tiktokUserOpenId: doc.tiktokUserOpenId,
      username: doc.username,
      firstName: doc.firstName,
      lastName: doc.lastName,
      displayName: doc.firstName && doc.lastName ? `${doc.firstName} ${doc.lastName}` : doc.firstName || doc.lastName
    };
  }

  /**
   * Initialize video upload to TikTok using the correct API flow.
   * This follows the official TikTok Content Posting API documentation.
   */
  async uploadVideo({ clerkUserId, fileBuffer, mimeType = 'video/mp4' }) {
    const accessToken = await this.getValidAccessTokenByClerk(clerkUserId);
    const url = `${TIKTOK_API_BASE}/post/publish/inbox/video/init/`;

    // Detect if this is an image or video based on MIME type
    const isImage = mimeType.startsWith('image/');
    const isVideo = mimeType.startsWith('video/');
    
    if (!isImage && !isVideo) {
      throw new Error(`Unsupported media type: ${mimeType}. TikTok supports images and videos.`);
    }

    let sourceInfo;
    
    // Handle URL string by using centralized media manager
    if (typeof fileBuffer === 'string') {
      console.log('[TikTok] Getting consistent media URL via centralized manager...');
      try {
        // Get consistent S3 URL (or create if doesn't exist)
        const s3Url = await this.mediaManager.getConsistentMediaUrl(fileBuffer, mimeType.startsWith('image/') ? 'image' : 'video');
        console.log('[TikTok] Using consistent S3 URL via centralized manager:', s3Url);
        
        // Use PULL_FROM_URL for TikTok upload
        sourceInfo = {
          source: "PULL_FROM_URL",
          video_url: s3Url
        };
      } catch (error) {
        console.error('[TikTok] Failed to prepare media via centralized manager:', error.message);
        throw new Error('Failed to prepare media for TikTok');
      }
    } else if (Buffer.isBuffer(fileBuffer)) {
      // For buffer uploads, we need to use FILE_UPLOAD
      const videoSize = fileBuffer.length;
      sourceInfo = {
        source: "FILE_UPLOAD",
        video_size: videoSize,
        chunk_size: videoSize,
        total_chunk_count: 1
      };
    } else {
      throw new Error('uploadVideo requires a Buffer or URL string input.');
    }

    // Initialize upload with TikTok API
    const { data } = await axios.post(url, {
      source_info: sourceInfo
    }, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    // Expected: { data: { publish_id: "...", upload_url: "..." } }
    const publishId = data?.data?.publish_id;
    const uploadUrl = data?.data?.upload_url;
    
    if (!publishId) {
      throw new Error(`TikTok upload response missing publish ID: ${JSON.stringify(data)}`);
    }

    // If we have a buffer and upload URL, upload the file
    if (Buffer.isBuffer(fileBuffer) && uploadUrl) {
      console.log('[TikTok] Uploading file to TikTok servers...');
      await axios.put(uploadUrl, fileBuffer, {
        headers: {
          'Content-Type': mimeType,
          'Content-Range': `bytes 0-${fileBuffer.length - 1}/${fileBuffer.length}`
        }
      });
    }

    return { 
      publish_id: publishId,
      mediaType: isImage ? 'image' : 'video'
    };
  }

  /**
   * Publish a previously uploaded video by video_id with a title/caption
   * This will request video.publish scope when needed during the publish process
   */
  async publishVideo({ clerkUserId, publishId, title }) {
    const accessToken = await this.getValidAccessTokenByClerk(clerkUserId);
    const url = `${TIKTOK_API_BASE}/post/publish/status/fetch/`;

    const payload = {
      publish_id: publishId
    };

    const { data } = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    // Check the status from TikTok API response
    const status = data?.data?.status;
    const shareUrl = data?.data?.share_url;
    
    if (status === 'PROCESSING') {
      // Still processing, return a pending status
      return {
        success: false,
        platform: 'tiktok',
        postId: publishId,
        message: 'TikTok video is still processing. User will be notified when ready.'
      };
    } else if (status === 'PUBLISHED' && shareUrl) {
      // Successfully published
      return {
        success: true,
        platform: 'tiktok',
        postId: publishId,
        url: shareUrl,
        message: `Successfully published to TikTok: ${shareUrl}`
      };
    } else if (status === 'FAILED') {
      // Upload failed
      const errorMessage = data?.data?.error_message || 'Unknown error';
      return {
        success: false,
        platform: 'tiktok',
        postId: publishId,
        message: `Failed to publish to TikTok: ${errorMessage}`
      };
    } else {
      // Unknown status
      return {
        success: false,
        platform: 'tiktok',
        postId: publishId,
        message: `TikTok upload status unknown: ${status}`
      };
    }
  }

  /**
   * Posts content to TikTok (combines upload + publish steps).
   * Same pattern as other platforms: postTo[Platform]
   * @param {Object} identifier  { clerkUserId } - same pattern as other platforms
   * @param {string|Array} message  Caption/text for the post (can be string or array)
   * @param {string} mediaUrl  URL to media file
   * @param {string} mediaType  'video' or 'image'
   */
  async postToTikTok(identifier, message, mediaUrl, mediaType = 'video') {
    // Handle both string and array inputs for captions
    const captionText = Array.isArray(message) ? message[0] || '' : message || '';
    const { clerkUserId } = identifier;
    
    if (!clerkUserId) {
      throw new Error('TikTok requires authenticated clerkUserId');
    }

    if (!mediaUrl) {
      throw new Error('TikTok requires media content: mediaUrl (HTTPS URL)');
    }

    if (!captionText) {
      throw new Error('TikTok post text is empty');
    }

    // Check if we have the required scopes for video posting
    const tokenDoc = await TikTokToken.findOne({ clerkUserId, provider: 'tiktok' });
    if (!tokenDoc) {
      throw new Error('TikTok not connected. Please connect your TikTok account first.');
    }

    // Check if token has video posting scopes
    const hasVideoScopes = tokenDoc.scope && (
      tokenDoc.scope.includes('video.upload') && 
      tokenDoc.scope.includes('video.publish')
    );

    if (!hasVideoScopes) {
      throw new Error('TikTok posting unavailable. Missing required scopes.');
    }

    // Get profile information (matches tiktokAuth.js pattern)
    const profile = await this.getTikTokProfile(identifier);
    console.log('[TikTok] Posting as:', profile.displayName || profile.username || 'TikTok User');

    // Check if we have the required scopes for posting
    try {
      // Determine MIME type based on mediaType
      let mimeType = 'video/mp4'; // default
      if (mediaType === 'image') {
        mimeType = 'image/jpeg'; // TikTok will handle different image formats
      } else if (mediaType === 'video') {
        mimeType = 'video/mp4';
      }

      // 1) Initialize upload and get publish_id
      const { publish_id } = await this.uploadVideo({
        clerkUserId: clerkUserId,
        fileBuffer: mediaUrl, // S3 URL - TikTok service will download it
        mimeType: mimeType,
      });

      // 2) Check status of the upload
      const result = await this.publishVideo({
        clerkUserId: clerkUserId,
        publishId: publish_id,
        title: captionText,
      });

      return result;
    } catch (error) {
      // Handle specific TikTok API errors
      if (error.response?.status === 401) {
        console.error('❌ TikTok 401 Error - Token/Scope Issue:', error.response?.data);
        throw new Error('TikTok posting unavailable. Authentication failed.');
      }
      if (error.response?.status === 403) {
        console.error('❌ TikTok 403 Error - Permission Issue:', error.response?.data);
        throw new Error('TikTok posting unavailable. Permission denied.');
      }
      if (error.message.includes('scope') || error.message.includes('permission')) {
        throw new Error('TikTok posting unavailable. Scope or permission issue.');
      }
      console.error('❌ TikTok API Error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Download media from external URL to buffer
   */
  async downloadToBuffer(url) {
    console.log('[TikTok] Downloading media from external URL:', url);
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000,
        maxContentLength: 50 * 1024 * 1024,
        maxBodyLength: 50 * 1024 * 1024,
        headers: { 'User-Agent': 'Repostly/1.0' }
      });
      const buffer = Buffer.from(response.data);
      console.log('[TikTok] Media downloaded successfully, size:', buffer.length, 'bytes');
      return buffer;
    } catch (error) {
      console.error('[TikTok] Failed to download media:', error.message);
      throw new Error('Failed to download media from external URL');
    }
  }

  /**
   * Rehost media to S3 for reliable TikTok access
   */
  async rehostToS3(buffer, originalUrl) {
    console.log('[TikTok] Rehosting media to S3 for reliable TikTok access...');
    try {
      const form = new FormData();
      const filename = path.basename(originalUrl.split('?')[0]) || 'media';
      const contentType = 'video/mp4'; // Will be overridden by detectMedia
      
      form.append('file', buffer, { filename, contentType });
      form.append('platform', 'tiktok');

      const resp = await axios.post(`${PYTHON_API_BASE_URL}/api/v1/upload`, form, {
        headers: form.getHeaders(),
        timeout: 60000,
      });
      
      if (!resp.data?.url) throw new Error('S3 rehost failed: no URL returned');
      
      console.log('[TikTok] Media rehosted to S3:', resp.data.url);
      return resp.data.url;
    } catch (error) {
      console.error('[TikTok] Failed to rehost media to S3:', error.message);
      throw new Error('Failed to rehost media to S3');
    }
  }
}

module.exports = TikTokService;
