/* back/backend-node/services/tiktokService.js */
const axios = require('axios');
const qs = require('qs');
const dayjs = require('dayjs');
const TikTokToken = require('../models/TikTokToken');
const FormData = require('form-data');
const path = require('path');
const { abs } = require('../config/url');

// For sandbox testing, use the sandbox API URL
const TIKTOK_API_BASE = process.env.TIKTOK_API_URL || 'https://open-sandbox.tiktokapis.com/v2';
const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;
// Construct redirect URI dynamically like other platforms
const REDIRECT_URI = abs('api/auth/tiktok/callback');

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
      redirect_uri: REDIRECT_URI,
    };

    const { data } = await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json' },
    });

    // data: { access_token, refresh_token, expires_in, token_type, scope }
    const expiresAt = dayjs().add(data.expires_in, 'second').toDate();
    return { ...data, expiresAt };
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
    const doc = await TikTokToken.findOne({ clerkUserId, provider: 'tiktok' });
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
   * Upload a media file buffer to TikTok (supports both images and videos).
   * Now uses LinkedIn-style approach: download external media, rehost to S3, then upload to TikTok
   */
  async uploadVideo({ clerkUserId, fileBuffer, mimeType = 'video/mp4' }) {
    const accessToken = await this.getValidAccessTokenByClerk(clerkUserId);
    const url = `${TIKTOK_API_BASE}/video/upload/`;

    // Detect if this is an image or video based on MIME type
    const isImage = mimeType.startsWith('image/');
    const isVideo = mimeType.startsWith('video/');
    
    if (!isImage && !isVideo) {
      throw new Error(`Unsupported media type: ${mimeType}. TikTok supports images and videos.`);
    }

    let input;
    let s3Url = null;
    
    // Handle URL string by using centralized media manager
    if (typeof fileBuffer === 'string') {
      console.log('[TikTok] Getting consistent media URL via centralized manager...');
      try {
        // Get consistent S3 URL (or create if doesn't exist)
        const s3Url = await this.mediaManager.getConsistentMediaUrl(fileBuffer, mimeType.startsWith('image/') ? 'image' : 'video');
        
        // Use S3 URL for TikTok upload (TikTok API accepts URL references)
        input = s3Url;
        console.log('[TikTok] Using consistent S3 URL via centralized manager:', s3Url);
      } catch (error) {
        console.error('[TikTok] Failed to prepare media via centralized manager:', error.message);
        throw new Error('Failed to prepare media for TikTok');
      }
    } else if (Buffer.isBuffer(fileBuffer)) {
      input = fileBuffer;
    } else {
      throw new Error('uploadVideo requires a Buffer or URL string input.');
    }

    // Create form data for upload
    const formData = new FormData();
    formData.append('video', input, {
      filename: `tiktok_${Date.now()}.${isImage ? 'jpg' : 'mp4'}`,
      contentType: mimeType,
    });

    const { data } = await axios.post(url, formData, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...formData.getHeaders(),
      },
    });

    // Expected: { data: { video_id: "..." } }
    const mediaId = data?.data?.video_id;
    if (!mediaId) {
      throw new Error(`TikTok upload response missing media ID: ${JSON.stringify(data)}`);
    }

    return { 
      video_id: mediaId,
      mediaType: isImage ? 'image' : 'video'
    };
  }

  /**
   * Publish a previously uploaded video by video_id with a title/caption
   */
  async publishVideo({ clerkUserId, videoId, title }) {
    const accessToken = await this.getValidAccessTokenByClerk(clerkUserId);
    const url = `${TIKTOK_API_BASE}/video/publish/`;

    const payload = {
      video_id: videoId,
      title: title?.slice(0, 150) || '', // TikTok caption limit safeguard
    };

    const { data } = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    // Expected: publish status + share_url or id
    const shareUrl = data?.share_url || `https://www.tiktok.com/@user/video/${videoId}`;
    
    // Return structured object like other platforms
    return {
      success: true,
      postId: videoId,
      url: shareUrl,
      message: 'Successfully published to TikTok'
    };
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

    // Determine MIME type based on mediaType
    let mimeType = 'video/mp4'; // default
    if (mediaType === 'image') {
      mimeType = 'image/jpeg'; // TikTok will handle different image formats
    } else if (mediaType === 'video') {
      mimeType = 'video/mp4';
    }

    // 1) Upload media (image or video) - TikTok service will download from URL
    const { video_id } = await this.uploadVideo({
      clerkUserId: clerkUserId,
      fileBuffer: mediaUrl, // S3 URL - TikTok service will download it
      mimeType: mimeType,
    });

    // 2) Publish media
    const result = await this.publishVideo({
      clerkUserId: clerkUserId,
      videoId: video_id,
      title: captionText,
    });

    return result;
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
