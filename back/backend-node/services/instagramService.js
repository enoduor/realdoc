/* eslint-disable no-console */
const axios = require('axios');
const FormData = require('form-data');
const path = require('path');
const InstagramToken = require('../models/InstagramToken');

const FACEBOOK_API_URL = process.env.FACEBOOK_API_URL || 'https://graph.facebook.com/v18.0';
const PYTHON_API_BASE_URL = process.env.PYTHON_API_BASE_URL || 'http://localhost:5001';
const MediaManagerService = require('./mediaManagerService');

class InstagramService {
  constructor(config = {}) {
    // Configuration can be added here if needed
    this.mediaManager = MediaManagerService.getInstance();
  }

  inferFilenameFromUrl(url) {
    try {
      const p = new URL(url);
      const base = path.basename(p.pathname);
      if (!base || base === '/' || base === '.') return 'upload';
      return base.includes('.') ? base : `${base}`;
    } catch {
      return 'upload';
    }
  }

  async downloadToBuffer(mediaUrl) {
    const resp = await axios.get(mediaUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
      maxContentLength: 50 * 1024 * 1024,
      maxBodyLength: 50 * 1024 * 1024,
      headers: { 'User-Agent': 'CreatorSync/1.0' }
    });
    const buffer = Buffer.from(resp.data);
    const contentType = resp.headers['content-type'] || 'application/octet-stream';
    const filename = this.inferFilenameFromUrl(mediaUrl);
    return { buffer, contentType, filename };
  }

  async rehostToS3(buffer, filename, contentType) {
    const form = new FormData();
    form.append('file', buffer, { filename, contentType });
    form.append('platform', 'instagram');

    const resp = await axios.post(`${PYTHON_API_BASE_URL}/api/v1/upload`, form, {
      headers: form.getHeaders(),
      timeout: 60000,
    });
    if (!resp.data?.url) throw new Error('S3 rehost failed: no URL returned');
    return resp.data.url;
  }

  async findToken(identifier = {}) {
    if (identifier.igUserId) {
      return InstagramToken.findOne({ igUserId: identifier.igUserId, isActive: true }).sort({ updatedAt: -1 });
    }
    if (identifier.clerkUserId) {
      return InstagramToken.findOne({ clerkUserId: identifier.clerkUserId, isActive: true }).sort({ updatedAt: -1 });
    }
    if (identifier.userId) {
      return InstagramToken.findOne({ userId: identifier.userId, isActive: true }).sort({ updatedAt: -1 });
    }
    if (identifier.email) {
      return InstagramToken.findOne({ email: identifier.email, isActive: true }).sort({ updatedAt: -1 });
    }
    return null;
  }

  async createContainerImage(accessToken, igUserId, imageUrl, caption) {
    const resp = await axios.post(`${FACEBOOK_API_URL}/${igUserId}/media`, null, {
      params: { image_url: imageUrl, caption, access_token: accessToken },
      timeout: 20000,
    });
    return resp.data; // { id: creation_id }
  }

  async createContainerVideo(accessToken, igUserId, videoUrl, caption) {
    const resp = await axios.post(`${FACEBOOK_API_URL}/${igUserId}/media`, null, {
      params: { media_type: 'REELS', video_url: videoUrl, caption, access_token: accessToken },
      timeout: 30000,
    });
    return resp.data; // { id: creation_id }
  }

  async getContainerStatus(accessToken, creationId) {
    const resp = await axios.get(`${FACEBOOK_API_URL}/${creationId}`, {
      params: { fields: 'status_code', access_token: accessToken },
      timeout: 15000,
    });
    return resp.data?.status_code;
  }

  async publishMedia(accessToken, igUserId, creationId) {
    const resp = await axios.post(`${FACEBOOK_API_URL}/${igUserId}/media_publish`, null, {
      params: { creation_id: creationId, access_token: accessToken },
      timeout: 60000, // Increased from 15s to 60s for video processing
    });
    return resp.data; // { id: ig_media_id }
  }

  async getPermalink(accessToken, mediaId) {
    const resp = await axios.get(`${FACEBOOK_API_URL}/${mediaId}`, {
      params: { fields: 'permalink', access_token: accessToken },
      timeout: 30000, // Increased from 15s to 30s
    });
    return resp.data?.permalink || null;
  }

  // NEW: LinkedIn-style Instagram posting - always download and rehost to S3 for reliability
  async postToInstagram(identifier, message, mediaUrl, isVideo = false) {
    const doc = await this.findToken(identifier);
    if (!doc || !doc.accessToken || !doc.igUserId) {
      throw new Error('Instagram not connected for this user');
    }
    
    const accessToken = doc.accessToken;
    const igUserId = doc.igUserId;

    // 🔑 NEW: Get consistent media URL via centralized manager
    console.log('[IG] Getting consistent media URL via centralized manager...');
    const s3Url = await this.mediaManager.getConsistentMediaUrl(mediaUrl, isVideo ? 'video' : 'image');
    console.log('[IG] Using consistent S3 URL via centralized manager:', s3Url);
    
    // 🔑 NEW: Create container with S3 URL (always accessible to Instagram)
    console.log('[IG] Creating container with S3 URL...');
    let creation;
    try {
      if (isVideo) {
        creation = await this.createContainerVideo(accessToken, igUserId, s3Url, message);
      } else {
        creation = await this.createContainerImage(accessToken, igUserId, s3Url, message);
      }
      console.log(`[IG] Container created successfully with S3 URL:`, creation);
    } catch (error) {
      console.error(`[IG] Container creation failed:`, error.response?.data || error.message);
      throw error;
    }

    if (isVideo) {
      // Poll for video processing
      const start = Date.now();
      console.log(`[IG] Starting video processing for container: ${creation.id}`);
      while (Date.now() - start < 120000) { // up to 2 minutes
        const status = await this.getContainerStatus(accessToken, creation.id);
        console.log(`[IG] Container ${creation.id} status: ${status}`);
        if (status === 'FINISHED') {
          console.log(`[IG] Video processing completed successfully`);
          break;
        }
        if (status === 'ERROR') {
          console.error(`[IG] Video processing failed for container: ${creation.id}`);
          throw new Error('Instagram video processing failed');
        }
        console.log(`[IG] Waiting 3 seconds before next status check...`);
        await new Promise((r) => setTimeout(r, 3000));
      }
    }

    console.log('[IG] Publishing media...');
    const published = await this.publishMedia(accessToken, igUserId, creation.id);
    const permalink = await this.getPermalink(accessToken, published.id);
    
    // Return structured object like LinkedIn
    return {
      success: true,
      postId: published.id,
      url: permalink,
      message: 'Successfully published to Instagram'
    };
  }
}

module.exports = InstagramService;


