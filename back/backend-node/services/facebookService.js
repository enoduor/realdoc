/* eslint-disable no-console */
const axios = require('axios');
const FormData = require('form-data');
const path = require('path');
const FacebookToken = require('../models/FacebookToken');

const {
  FACEBOOK_APP_ID,
  FACEBOOK_APP_SECRET,
  ENABLE_LOGS = 'true'
} = process.env;

const FACEBOOK_API_URL = process.env.FACEBOOK_API_URL || 'https://graph.facebook.com/v18.0';
const PYTHON_API_BASE_URL = process.env.PYTHON_API_BASE_URL || 'http://localhost:5001';
const MediaManagerService = require('./mediaManagerService');

const LOG_ENABLED = String(ENABLE_LOGS).toLowerCase() !== 'false';
const log = (...args) => { if (LOG_ENABLED) console.log(...args); };
const warn = (...args) => { if (LOG_ENABLED) console.warn(...args); };
const error = (...args) => console.error(...args);

class FacebookService {
  constructor(config = {}) {
    // No AWS SDK needed - uses Python backend for S3 uploads (like Instagram)
    this.mediaManager = MediaManagerService.getInstance();
  }

  /**
   * Download media from external URL to buffer
   */
  async downloadToBuffer(url) {
    log('[Facebook] Downloading media from external URL:', url);
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000,
        maxContentLength: 50 * 1024 * 1024,
        maxBodyLength: 50 * 1024 * 1024,
        headers: { 'User-Agent': 'Repostly/1.0' }
      });
      const buffer = Buffer.from(response.data);
      log('[Facebook] Media downloaded successfully, size:', buffer.length, 'bytes');
      return buffer;
    } catch (e) {
      error('[Facebook] Failed to download media:', e.message);
      throw new Error('Failed to download media from external URL');
    }
  }

  /**
   * Rehost media to S3 for reliable Facebook access
   */
  async rehostToS3(buffer, originalNameOrUrl = 'media') {
    log('[Facebook] Rehosting media to S3 for reliable Facebook access...');
    try {
      const form = new FormData();
      const filename = path.basename(String(originalNameOrUrl).split('?')[0]) || 'media';
      // Default to mp4; FB will fetch by URL anyway; our S3 object should have correct Content-Type
      const contentType = this._mimeFromFilename(filename) || 'application/octet-stream';

      form.append('file', buffer, { filename, contentType });
      form.append('platform', 'facebook');

      const resp = await axios.post(`${PYTHON_API_BASE_URL}/api/v1/upload`, form, {
        headers: form.getHeaders(),
        timeout: 60000,
      });
      if (!resp.data?.url) throw new Error('S3 rehost failed: no URL returned');

      log('[Facebook] Media rehosted to S3:', resp.data.url);
      return resp.data.url;
    } catch (e) {
      error('[Facebook] Failed to rehost media to S3:', e.message);
      throw new Error('Failed to rehost media to S3');
    }
  }

  /**
   * Find a token doc by identifiers; always prefer latest active token
   */
  async findToken(identifier = {}) {
    if (identifier.facebookUserId) {
      return FacebookToken.findOne({
        facebookUserId: identifier.facebookUserId,
        isActive: true
      }).sort({ updatedAt: -1 });
    }
    if (identifier.clerkUserId) {
      return FacebookToken.findOne({
        clerkUserId: identifier.clerkUserId,
        isActive: true
      }).sort({ updatedAt: -1 });
    }
    if (identifier.userId) {
      return FacebookToken.findOne({
        userId: identifier.userId,
        isActive: true
      }).sort({ updatedAt: -1 });
    }
    if (identifier.email) {
      return FacebookToken.findOne({
        email: identifier.email,
        isActive: true
      }).sort({ updatedAt: -1 });
    }
    return null;
  }

  /**
   * Get Facebook user info and cache handle (Page token expected)
   */
  async getFacebookHandle(identifier) {
    const doc = await this.findToken(identifier);
    if (!doc) throw new Error('Facebook not connected for this user');

    const handleCacheAge = doc.handleUpdatedAt ? Date.now() - new Date(doc.handleUpdatedAt).getTime() : Infinity;
    const CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

    if (doc.handle && handleCacheAge < CACHE_MAX_AGE) {
      log('[Facebook] Using cached handle (age:', Math.round(handleCacheAge / 60000), 'min):', doc.handle);
      return doc.handle;
    }

    log('[Facebook] Handle cache stale/missing, making API call to get user info...');
    try {
      // Prefer page token if available; otherwise user token (still for /me but just to read)
      const tokenForInfo = doc.pageAccessToken || doc.accessToken;
      const response = await axios.get(`${FACEBOOK_API_URL}/me`, {
        params: {
          access_token: tokenForInfo,
          fields: 'id,name,username'
        },
        timeout: 15000
      });

      log('[FB] /me success - data:', response.data);
      const handle = response.data?.username || response.data?.name || `fb_${response.data?.id}`;
      if (handle) {
        doc.handle = handle;
        doc.name = response.data?.name || doc.name;
        doc.handleUpdatedAt = new Date();
        await doc.save();
        log('[Facebook] Cached handle:', handle);
      }
      return handle || null;
    } catch (e) {
      error('[FB ERR] /me failed:', e.response?.data || e.message);
      const fbErr = e.response?.data;
      if (fbErr?.error?.code === 190) {
        throw new Error('Facebook token expired or invalid. Please reconnect Facebook.');
      }
      throw e;
    }
  }

  /**
   * Detect media type by buffer signature or filename
   * Returns { type: 'IMAGE'|'IMAGE_GIF'|'VIDEO', mimeType, filename }
   */
  detectMedia(input, filenameHint = null) {
    // Default assumption
    let out = { type: 'VIDEO', mimeType: 'video/mp4', filename: 'video.mp4' };

    if (Buffer.isBuffer(input) && input.length >= 12) {
      const buf = input;
      // JPEG
      if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) {
        return { type: 'IMAGE', mimeType: 'image/jpeg', filename: 'image.jpg' };
      }
      // PNG
      if (buf.slice(0,8).compare(Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A])) === 0) {
        return { type: 'IMAGE', mimeType: 'image/png', filename: 'image.png' };
      }
      // GIF
      if (buf.slice(0,3).toString() === 'GIF') {
        return { type: 'IMAGE_GIF', mimeType: 'image/gif', filename: 'image.gif' };
      }
      // MP4 (ftyp)
      if (buf.slice(4,8).toString() === 'ftyp') {
        return { type: 'VIDEO', mimeType: 'video/mp4', filename: 'video.mp4' };
      }
    }

    if (filenameHint && typeof filenameHint === 'string') {
      const name = filenameHint.toLowerCase();
      if (/\.gif(\?|$)/i.test(name)) return { type: 'IMAGE_GIF', mimeType: 'image/gif', filename: 'image.gif' };
      if (/\.(jpe?g)(\?|$)/i.test(name)) return { type: 'IMAGE', mimeType: 'image/jpeg', filename: 'image.jpg' };
      if (/\.(png)(\?|$)/i.test(name)) return { type: 'IMAGE', mimeType: 'image/png', filename: 'image.png' };
      if (/\.(mp4|mov|m4v|webm)(\?|$)/i.test(name)) return { type: 'VIDEO', mimeType: 'video/mp4', filename: 'video.mp4' };
    }

    return out;
  }

  _mimeFromFilename(name) {
    const low = String(name).toLowerCase();
    if (low.endsWith('.jpg') || low.endsWith('.jpeg')) return 'image/jpeg';
    if (low.endsWith('.png')) return 'image/png';
    if (low.endsWith('.gif')) return 'image/gif';
    if (low.endsWith('.mp4')) return 'video/mp4';
    if (low.endsWith('.mov')) return 'video/quicktime';
    if (low.endsWith('.webm')) return 'video/webm';
    return null;
  }

  /**
   * Upload media with text to a Facebook Page (required). Uses URL-based upload.
   */
  async uploadMediaWithText(identifier, mediaUrlOrBuffer, text, explicitType = null) {
    const doc = await this.findToken(identifier);
    if (!doc) throw new Error('Facebook not connected for this user');

    // ✅ Require Page context (API does not allow posting to personal timeline)
    if (!doc.pageId || !doc.pageAccessToken) {
      throw new Error('Facebook Page not connected. Please connect a Facebook Page to publish.');
    }
    const targetId = doc.pageId;
    const tokenForPost = doc.pageAccessToken;

    // Normalize input to a URL that Facebook can pull (S3)
    let inputUrl;
    let detectedFrom = 'default';
    let filenameHint = null;

    if (typeof mediaUrlOrBuffer === 'string') {
      filenameHint = mediaUrlOrBuffer;
      // Provisional detect from filename
      const typeFromName = this.detectMedia(null, filenameHint).type; // IMAGE | IMAGE_GIF | VIDEO
      const kindFromName = (explicitType?.toUpperCase() === 'IMAGE' || typeFromName.startsWith('IMAGE')) ? 'image' : 'video';
      inputUrl = await this.mediaManager.getConsistentMediaUrl(mediaUrlOrBuffer, kindFromName);
      detectedFrom = 'url';
    } else if (Buffer.isBuffer(mediaUrlOrBuffer)) {
      const info = this.detectMedia(mediaUrlOrBuffer);
      filenameHint = info.filename;
      // Rehost buffers to S3; FB will ingest by URL
      inputUrl = await this.rehostToS3(mediaUrlOrBuffer, info.filename);
      detectedFrom = 'buffer';
    } else {
      throw new Error('uploadMediaWithText requires a Buffer or URL string input.');
    }

    // Final media type
    let infoFinal;
    if (explicitType) {
      const t = String(explicitType).toUpperCase();
      if (t === 'IMAGE') infoFinal = { type: 'IMAGE' };
      else if (t === 'IMAGE_GIF' || t === 'GIF') infoFinal = { type: 'IMAGE_GIF' };
      else infoFinal = { type: 'VIDEO' };
    } else {
      infoFinal = this.detectMedia(null, filenameHint);
    }
    const isImage = infoFinal.type === 'IMAGE' || infoFinal.type === 'IMAGE_GIF';

    // Caption/message
    const captionText = Array.isArray(text) ? (text[0] || '') : (text || '');
    const message = String(captionText).trim().slice(0, 63206); // FB limit

    try {
      if (isImage) {
        log('[Facebook] Posting IMAGE (source:', detectedFrom, ')…');
        const formData = new FormData();
        formData.append('url', inputUrl); // URL path for photos
        if (message) formData.append('message', message);
        formData.append('access_token', tokenForPost);

        const response = await axios.post(`${FACEBOOK_API_URL}/${targetId}/photos`, formData, {
          headers: formData.getHeaders(),
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          timeout: 120000
        });

        log('[FB] photo post success - id:', response.data.id);
        let url = `https://www.facebook.com/${response.data.id}`;
        try {
          const linkResp = await axios.get(`${FACEBOOK_API_URL}/${response.data.id}`, {
            params: { access_token: tokenForPost, fields: 'permalink_url,link' },
            timeout: 15000
          });
          url = linkResp.data?.permalink_url || linkResp.data?.link || url;
        } catch (e2) {
          warn('[FB] Could not fetch photo permalink, falling back to ID URL.');
        }
        return { success: true, postId: response.data.id, url, message: 'Successfully published to Facebook' };

      } else {
        log('[Facebook] Posting VIDEO (source:', detectedFrom, ')…');
        const formData = new FormData();
        formData.append('file_url', inputUrl); // URL path for videos
        if (message) formData.append('description', message);
        formData.append('access_token', tokenForPost);

        const response = await axios.post(`${FACEBOOK_API_URL}/${targetId}/videos`, formData, {
          headers: formData.getHeaders(),
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          timeout: 300000
        });

        log('[FB] video post success - id:', response.data.id);
        let url = `https://www.facebook.com/watch?v=${response.data.id}`;
        try {
          const linkResp = await axios.get(`${FACEBOOK_API_URL}/${response.data.id}`, {
            params: { access_token: tokenForPost, fields: 'permalink_url,link' },
            timeout: 15000
          });
          url = linkResp.data?.permalink_url || linkResp.data?.link || url;
        } catch (e2) {
          warn('[FB] Could not fetch video permalink, falling back to watch URL.');
        }
        return { success: true, postId: response.data.id, url, message: 'Successfully published to Facebook' };
      }
    } catch (e) {
      error('[FB ERR] media post failed:', e.response?.data || e.message);
      const fbErr = e.response?.data?.error;

      // Token expired/invalid
      if (fbErr?.code === 190) {
        throw new Error('Facebook token expired or invalid. Please reconnect Facebook.');
      }
      // Permissions missing (common codes)
      if (fbErr?.code === 10 || fbErr?.code === 200 || fbErr?.type === 'OAuthException') {
        throw new Error('Facebook permissions missing (pages_manage_posts and pages_read_engagement). Verify app review and scopes.');
      }
      // Page access issues
      if (fbErr?.code === 32 || fbErr?.code === 803) {
        throw new Error('Facebook Page access error. Ensure the Page is connected and the token has page-level permissions.');
      }
      throw new Error('Facebook media post failed');
    }
  }

  /**
   * Post to Facebook Page (media required)
   */
  async postToFacebook(identifier, text, mediaUrlOrBuffer = null) {
    const doc = await this.findToken(identifier);
    if (!doc) throw new Error('Facebook not connected for this user');

    if (!doc.pageId || !doc.pageAccessToken) {
      throw new Error('Facebook Page not connected. Please connect a Facebook Page to publish.');
    }

    if (!mediaUrlOrBuffer) {
      throw new Error('Facebook requires media content for posting');
    }

    try {
      log('[Facebook] Posting media with text via unified flow…');
      const result = await this.uploadMediaWithText(identifier, mediaUrlOrBuffer, text);
      log('[Facebook] Media post successful');
      return {
        success: true,
        postId: result.postId,
        url: result.url,
        message: 'Successfully published to Facebook'
      };
    } catch (e) {
      error('[FB ERR] media post failed:', e.response?.data || e.message);
      const fbErr = e.response?.data?.error;
      if (fbErr?.code === 190) {
        throw new Error('Facebook token expired or invalid. Please reconnect Facebook.');
      }
      throw new Error(`Facebook media post failed: ${e.message}`);
    }
  }
}

module.exports = FacebookService;