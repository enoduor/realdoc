/* back/backend-node/services/tiktokService.js */
const axios = require('axios');
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

      console.log('🔍 [TikTok Token Exchange] Full response:', JSON.stringify(data, null, 2));

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
    // TikTok expects x-www-form-urlencoded for refresh too
    const formData = new URLSearchParams({
      client_key: CLIENT_KEY,
      client_secret: CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: doc.refreshToken,
    }).toString();

    const { data } = await axios.post(url, formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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
      displayName:
        doc.firstName && doc.lastName
          ? `${doc.firstName} ${doc.lastName}`
          : doc.firstName || doc.lastName
    };
  }

  /**
   * Initialize + upload video to TikTok using the correct API flow.
   */
  async uploadVideo({ clerkUserId, fileBuffer, mimeType = 'video/mp4' }) {
    const accessToken = await this.getValidAccessTokenByClerk(clerkUserId);
    const url = `${TIKTOK_API_BASE}/post/publish/video/init/`;

    // Enforce video-only for now (image uses different endpoints)
    const isVideo = mimeType.startsWith('video/');
    if (!isVideo) {
      throw new Error(`Unsupported media type for TikTok video flow: ${mimeType}`);
    }

    // Handle URL string by downloading to buffer (avoid PULL_FROM_URL)
    if (typeof fileBuffer === 'string') {
      console.log('[TikTok] Downloading media file to buffer for multipart upload...');
      try {
        fileBuffer = await this.downloadToBuffer(fileBuffer);
        console.log('[TikTok] Downloaded file to buffer, size:', fileBuffer.length, 'bytes');
      } catch (error) {
        console.error('[TikTok] Failed to download media file:', error.message);
        throw new Error('Failed to download media for TikTok');
      }
    } else if (!Buffer.isBuffer(fileBuffer)) {
      throw new Error('uploadVideo requires a Buffer or URL string input.');
    }

    // Step 1: Initialize upload with TikTok API
    console.log('[TikTok] Step 1: Initializing upload...');
    const videoSize = fileBuffer.length;
    const initPayload = {
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: videoSize,
        chunk_size: videoSize,
        total_chunk_count: 1
      }
    };
    
    console.log('[TikTok] Init payload:', initPayload);
    
    const { data: initData } = await axios.post(
      url,
      initPayload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('[TikTok] Init response:', initData);
    const uploadId = initData?.data?.upload_id;

    if (!uploadId) {
      throw new Error(`TikTok init response missing upload ID: ${JSON.stringify(initData)}`);
    }

    console.log('[TikTok] Got upload_id:', uploadId);

    // Step 2: Upload bytes using FormData
    console.log('[TikTok] Uploading file bytes to TikTok servers...');
    console.log('[TikTok] Upload details:', {
      uploadId,
      fileSize: fileBuffer.length,
      mimeType,
      filename: `video.${mimeType.split('/')[1]}`
    });

    const form = new FormData();
    form.append('upload_id', uploadId);
    form.append('video', fileBuffer, {
      filename: `video.${mimeType.split('/')[1]}`,
      contentType: mimeType
    });

    const uploadResponse = await axios.post(
      `${TIKTOK_API_BASE}/post/publish/video/upload/`,
      form,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...form.getHeaders()
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 180000
      }
    );

    console.log('[TikTok] Upload response:', uploadResponse.data);

    return {
      upload_id: uploadId,
      mediaType: 'video'
    };
  }

  /**
   * Publish a previously uploaded video with a title/caption
   */
  async publishVideo({ clerkUserId, uploadId, title }) {
    const accessToken = await this.getValidAccessTokenByClerk(clerkUserId);
    const url = `${TIKTOK_API_BASE}/post/publish/video/`;

    // Step 3: Publish with caption
    console.log('[TikTok] Step 3: Publishing video with caption...');
    const payload = {
      post_info: {
        caption: title
      },
      upload_id: uploadId
    };

    console.log('[TikTok] Publish payload:', payload);

    const { data } = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 60000
    });

    console.log('[TikTok] Publish response:', data);

    // Safer handling: prefer share_url if present; then status
    const status = data?.data?.status;
    const shareUrl = data?.data?.share_url;

    if (shareUrl) {
      return {
        success: true,
        platform: 'tiktok',
        postId: uploadId,
        url: shareUrl,
        message: `Successfully published to TikTok: ${shareUrl}`
      };
    }

    if (status === 'PROCESSING') {
      return {
        success: false,
        platform: 'tiktok',
        postId: uploadId,
        message: 'TikTok video is still processing. User will be notified when ready.'
      };
    }

    const errorMessage = data?.data?.error_message || data?.error?.message || status || 'Unknown error';
    return {
      success: false,
      platform: 'tiktok',
      postId: uploadId,
      message: `TikTok publish pending/unknown: ${errorMessage}`
    };
  }

  /**
   * Posts content to TikTok (combines upload + publish steps).
   */
  async postToTikTok(identifier, message, mediaUrl, mediaType = 'video') {
    const captionText = Array.isArray(message) ? message[0] || '' : message || '';
    const { clerkUserId } = identifier;

    if (!clerkUserId) throw new Error('TikTok requires authenticated clerkUserId');
    if (!mediaUrl) throw new Error('TikTok requires media content: mediaUrl (HTTPS URL)');
    if (!captionText) throw new Error('TikTok post text is empty');

    const tokenDoc = await TikTokToken.findOne({ clerkUserId, provider: 'tiktok' });
    if (!tokenDoc) throw new Error('TikTok not connected. Please connect your TikTok account first.');

    // Robust scope check (string or array)
    const scopeStr = Array.isArray(tokenDoc.scope) ? tokenDoc.scope.join(' ') : (tokenDoc.scope || '');
    const hasVideoScopes = /\bvideo\.upload\b/.test(scopeStr) && /\bvideo\.publish\b/.test(scopeStr);
    if (!hasVideoScopes) {
      throw new Error('TikTok posting unavailable. Missing required scopes.');
    }

    const profile = await this.getTikTokProfile(identifier);
    console.log('[TikTok] Posting as:', profile.displayName || profile.username || 'TikTok User');

    try {
      // Enforce video flow only
      const mimeType = 'video/mp4';

      // 1) Initialize + upload, get upload_id
      const { upload_id } = await this.uploadVideo({
        clerkUserId,
        fileBuffer: mediaUrl, // S3 URL - TikTok service will download it
        mimeType
      });

      // 2) Publish the video with caption
      const result = await this.publishVideo({
        clerkUserId,
        uploadId: upload_id,
        title: captionText
      });

      return result;
    } catch (error) {
      if (error.response?.status === 401) {
        console.error('❌ TikTok 401 Error - Token/Scope Issue:', error.response?.data);
        throw new Error('TikTok posting unavailable. Authentication failed.');
      }
      if (error.response?.status === 403) {
        console.error('❌ TikTok 403 Error - Permission Issue:', error.response?.data);
        throw new Error('TikTok posting unavailable. Permission denied.');
      }
      if (error.message?.toLowerCase().includes('scope') || error.message?.toLowerCase().includes('permission')) {
        throw new Error('TikTok posting unavailable. Scope or permission issue.');
      }
      console.error('❌ TikTok API Error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Download media from external URL to buffer (hardened)
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
      const contentType = 'video/mp4';

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