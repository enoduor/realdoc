/* eslint-disable no-console */
const axios = require('axios');
const FormData = require('form-data');
const path = require('path');
const FacebookToken = require('../models/FacebookToken');

const {
  FACEBOOK_API_URL,
  FACEBOOK_APP_ID,
  FACEBOOK_APP_SECRET
} = process.env;

const PYTHON_API_BASE_URL = process.env.PYTHON_API_BASE_URL || 'http://localhost:5001';
const MediaManagerService = require('./mediaManagerService');

class FacebookService {
  constructor(config = {}) {
    // No AWS SDK needed - uses Python backend for S3 uploads (like Instagram)
    this.mediaManager = MediaManagerService.getInstance();
  }

  /**
   * Download media from external URL to buffer
   */
  async downloadToBuffer(url) {
    console.log('[Facebook] Downloading media from external URL:', url);
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000,
        maxContentLength: 50 * 1024 * 1024,
        maxBodyLength: 50 * 1024 * 1024,
        headers: { 'User-Agent': 'Repostly/1.0' }
      });
      const buffer = Buffer.from(response.data);
      console.log('[Facebook] Media downloaded successfully, size:', buffer.length, 'bytes');
      return buffer;
    } catch (error) {
      console.error('[Facebook] Failed to download media:', error.message);
      throw new Error('Failed to download media from external URL');
    }
  }

  /**
   * Rehost media to S3 for reliable Facebook access
   */
  async rehostToS3(buffer, originalUrl) {
    console.log('[Facebook] Rehosting media to S3 for reliable Facebook access...');
    try {
      const form = new FormData();
      const filename = path.basename(originalUrl.split('?')[0]) || 'media';
      const contentType = 'video/mp4'; // Will be overridden by detectMedia
      
      form.append('file', buffer, { filename, contentType });
      form.append('platform', 'facebook');

      const resp = await axios.post(`${PYTHON_API_BASE_URL}/api/v1/upload`, form, {
        headers: form.getHeaders(),
        timeout: 60000,
      });
      
      if (!resp.data?.url) throw new Error('S3 rehost failed: no URL returned');
      
      console.log('[Facebook] Media rehosted to S3:', resp.data.url);
      return resp.data.url;
    } catch (error) {
      console.error('[Facebook] Failed to rehost media to S3:', error.message);
      throw new Error('Failed to rehost media to S3');
    }
  }

  /**
   * Find a token doc by { facebookUserId }, { clerkUserId }, { userId }, or { email }
   */
  async findToken(identifier = {}) {
    if (identifier.facebookUserId) {
      return FacebookToken.findOne({ facebookUserId: identifier.facebookUserId });
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
   * Get Facebook user info and cache handle
   */
  async getFacebookHandle(identifier) {
    const doc = await this.findToken(identifier);
    if (!doc) throw new Error('Facebook not connected for this user');

    const handleCacheAge = doc.handleUpdatedAt ? Date.now() - new Date(doc.handleUpdatedAt).getTime() : Infinity;
    const CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

    if (doc.handle && handleCacheAge < CACHE_MAX_AGE) {
      console.log('[Facebook] Using cached handle (age:', Math.round(handleCacheAge / 1000 / 60), 'min):', doc.handle);
      return doc.handle;
    }

    console.log('[Facebook] Handle cache stale/missing, making API call to get user info...');

    try {
      const response = await axios.get(`${FACEBOOK_API_URL}/me`, {
        params: {
          access_token: doc.accessToken,
          fields: 'id,name,username'
        },
        timeout: 15000
      });

      console.log('[FB] me success - data:', response.data);

      const handle = response.data?.username || response.data?.name || `fb_${response.data?.id}`;
      if (handle) {
        doc.handle = handle;
        doc.name = response.data?.name || doc.name;
        doc.handleUpdatedAt = new Date();
        await doc.save();
        console.log('[Facebook] Cached handle:', handle);
      }
      return handle || null;
    } catch (e) {
      console.error('[FB ERR] me failed:', e.response?.data || e.message);
      const fbErr = e.response?.data;
      if (fbErr?.error?.code === 190) {
        throw new Error('Facebook token expired or invalid. Please reconnect Facebook.');
      }
      throw e;
    }
  }

  /**
   * Internal: detect media type from Buffer or filename
   * Returns { type: 'IMAGE'|'IMAGE_GIF'|'VIDEO', mimeType: string, filename: string }
   */
  detectMedia(input, filenameHint = null) {
    // Default
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

  /**
   * Upload media to Facebook with text
   */
  async uploadMediaWithText(identifier, mediaUrlOrBuffer, text, explicitType = null) {
    const doc = await this.findToken(identifier);
    if (!doc) throw new Error('Facebook not connected for this user');

    let input;
    let filenameHint = null;
    let s3Url = null;

    // Handle URL string by using centralized media manager
    if (typeof mediaUrlOrBuffer === 'string') {
      console.log('[Facebook] Getting consistent media URL via centralized manager...');
      try {
        // Get consistent S3 URL (or create if doesn't exist)
        const s3Url = await this.mediaManager.getConsistentMediaUrl(mediaUrlOrBuffer, 'video');
        
        // Use S3 URL for Facebook upload (Facebook API accepts URL references)
        input = s3Url;
        filenameHint = mediaUrlOrBuffer;
        console.log('[Facebook] Using consistent S3 URL via centralized manager:', s3Url);
      } catch (error) {
        console.error('[Facebook] Failed to prepare media via centralized manager:', error.message);
        throw new Error('Failed to prepare media for Facebook');
      }
    } else if (Buffer.isBuffer(mediaUrlOrBuffer)) {
      input = mediaUrlOrBuffer;
    } else {
      throw new Error('uploadMediaWithText requires a Buffer or URL string input.');
    }

    // Detect type (explicitType overrides)
    let info;
    if (explicitType) {
      const t = String(explicitType).toUpperCase();
      if (t === 'IMAGE') info = { type: 'IMAGE', mimeType: 'image/jpeg', filename: 'image.jpg' };
      else if (t === 'IMAGE_GIF' || t === 'GIF') info = { type: 'IMAGE_GIF', mimeType: 'image/gif', filename: 'image.gif' };
      else info = { type: 'VIDEO', mimeType: 'video/mp4', filename: 'video.mp4' };
    } else {
      info = this.detectMedia(input, filenameHint);
    }

    const isImage = info.type === 'IMAGE' || info.type === 'IMAGE_GIF';

    // Resolve target and token
    const targetId = doc.pageAccessToken && doc.pageId ? doc.pageId : 'me';
    const tokenForPost = doc.pageAccessToken && doc.pageId ? doc.pageAccessToken : doc.accessToken;

    try {
      if (isImage) {
        console.log('[Facebook] Posting image with text...');

        const formData = new FormData();
        // Always use S3 URL for Facebook (LinkedIn/Instagram approach)
        formData.append('url', input); // input is now the S3 URL
        console.log('[Facebook] Using S3 URL for image upload:', input);
        formData.append('message', text || '');
        formData.append('access_token', tokenForPost);

        const response = await axios.post(`${FACEBOOK_API_URL}/${targetId}/photos`, formData, {
          headers: {
            ...formData.getHeaders()
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          timeout: 120000
        });

        console.log('[FB] photo post success - id:', response.data.id);
        // Try to fetch a permalink URL for the created object
        let url = null;
        try {
          const linkResp = await axios.get(`${FACEBOOK_API_URL}/${response.data.id}`, {
            params: { access_token: tokenForPost, fields: 'permalink_url,link' },
            timeout: 15000
          });
          url = linkResp.data?.permalink_url || linkResp.data?.link || null;
        } catch (e2) {
          // Fallback for photos
          url = `https://www.facebook.com/${response.data.id}`;
        }
        return {
          success: true,
          postId: response.data.id,
          url: url,
          message: 'Successfully published to Facebook'
        };
      } else {
        console.log('[Facebook] Posting video with text...');

        const formData = new FormData();
        // Always use S3 URL for Facebook (LinkedIn/Instagram approach)
        formData.append('file_url', input); // input is now the S3 URL
        console.log('[Facebook] Using S3 URL for video upload:', input);
        formData.append('description', text || '');
        formData.append('access_token', tokenForPost);

        const response = await axios.post(`${FACEBOOK_API_URL}/${targetId}/videos`, formData, {
          headers: {
            ...formData.getHeaders()
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          timeout: 300000
        });

        console.log('[FB] video post success - id:', response.data.id);
        // Try to fetch a permalink URL for the created video
        let url = null;
        try {
          const linkResp = await axios.get(`${FACEBOOK_API_URL}/${response.data.id}`, {
            params: { access_token: tokenForPost, fields: 'permalink_url,link' },
            timeout: 15000
          });
          url = linkResp.data?.permalink_url || linkResp.data?.link || null;
        } catch (e2) {
          // Fallback for videos
          url = `https://www.facebook.com/watch?v=${response.data.id}`;
        }
        return {
          success: true,
          postId: response.data.id,
          url: url,
          message: 'Successfully published to Facebook'
        };
      }
    } catch (e) {
      console.error('[FB ERR] media post failed:', e.response?.data || e.message);
      const fbErr = e.response?.data;
      if (fbErr?.error?.code === 190) {
        throw new Error('Facebook token expired or invalid. Please reconnect Facebook.');
      }
      throw new Error('Facebook media post failed');
    }
  }

  /**
   * Post to Facebook
   */
  async postToFacebook(identifier, text, mediaUrlOrBuffer = null) {
    const doc = await this.findToken(identifier);
    if (!doc) throw new Error('Facebook not connected for this user');

    // Resolve target and token
    const targetId = doc.pageAccessToken && doc.pageId ? doc.pageId : 'me';
    const tokenForPost = doc.pageAccessToken && doc.pageId ? doc.pageAccessToken : doc.accessToken;

    const message = String(text || '').trim().slice(0, 63206); // Facebook limit

    if (!mediaUrlOrBuffer) {
      throw new Error('Facebook requires media content for posting');
    }

    try {
      console.log('[Facebook] Posting media with text using LinkedIn-style approach...');
      const result = await this.uploadMediaWithText(identifier, mediaUrlOrBuffer, message);
      console.log('[Facebook] Media post successful');
      
      // Return structured object like other platforms
      return {
        success: true,
        postId: result.postId,
        url: result.url,
        message: 'Successfully published to Facebook'
      };
    } catch (error) {
      console.error('[FB ERR] media post failed:', error.response?.data || error.message);
      const fbErr = error.response?.data;
      if (fbErr?.error?.code === 190) {
        throw new Error('Facebook token expired or invalid. Please reconnect Facebook.');
      }
      throw new Error(`Facebook media post failed: ${error.message}`);
    }
  }
}

module.exports = FacebookService;
