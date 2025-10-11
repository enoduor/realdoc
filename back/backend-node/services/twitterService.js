/* eslint-disable no-console */
const { TwitterApi } = require('twitter-api-v2');
const TwitterToken = require('../models/TwitterToken');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

const {
  TWITTER_API_KEY,
  TWITTER_API_SECRET
} = process.env;

const PYTHON_API_BASE_URL = process.env.PYTHON_API_BASE_URL || 'http://localhost:5001';
const MediaManagerService = require('./mediaManagerService');

class TwitterService {
  constructor(config = {}) {
    // No AWS SDK needed - uses Python backend for S3 uploads (like Instagram)
    this.mediaManager = MediaManagerService.getInstance();
  }

  /**
   * Download media from external URL to buffer
   */
  async downloadToBuffer(url) {
    console.log('[Twitter] Downloading media from external URL:', url);
    try {
      const response = await fetch(url);
      const buffer = Buffer.from(await response.arrayBuffer());
      console.log('[Twitter] Media downloaded successfully, size:', buffer.length, 'bytes');
      return buffer;
    } catch (error) {
      console.error('[Twitter] Failed to download media:', error.message);
      throw new Error('Failed to download media from external URL');
    }
  }

  /**
   * Rehost media to S3 for reliable Twitter access
   */
  async rehostToS3(buffer, originalUrl) {
    console.log('[Twitter] Rehosting media to S3 for reliable Twitter access...');
    try {
      const form = new FormData();
      const filename = path.basename(originalUrl.split('?')[0]) || 'media';
      const contentType = 'video/mp4'; // Will be overridden by detectMedia
      
      form.append('file', buffer, { filename, contentType });
      form.append('platform', 'twitter');

      const resp = await axios.post(`${PYTHON_API_BASE_URL}/api/v1/upload`, form, {
        headers: form.getHeaders(),
        timeout: 60000,
      });
      
      if (!resp.data?.url) throw new Error('S3 rehost failed: no URL returned');
      
      console.log('[Twitter] Media rehosted to S3:', resp.data.url);
      return resp.data.url;
    } catch (error) {
      console.error('[Twitter] Failed to rehost media to S3:', error.message);
      throw new Error('Failed to rehost media to S3');
    }
  }

  // Rate limit management removed for testing

  /**
   * Find a token doc by { twitterUserId }, { clerkUserId }, { userId }, or { email }
   */
  async findToken(identifier = {}) {
    if (identifier.twitterUserId) {
      return TwitterToken.findOne({ twitterUserId: identifier.twitterUserId });
    }
    if (identifier.clerkUserId) {
      return TwitterToken.findOne({
        clerkUserId: identifier.clerkUserId,
        oauthToken: { $exists: true },
        oauthTokenSecret: { $exists: true }
      }).sort({ updatedAt: -1 });
    }
    if (identifier.userId) {
      return TwitterToken.findOne({
        userId: identifier.userId,
        oauthToken: { $exists: true },
        oauthTokenSecret: { $exists: true }
      }).sort({ updatedAt: -1 });
    }
    if (identifier.email) {
      return TwitterToken.findOne({
        email: identifier.email,
        oauthToken: { $exists: true },
        oauthTokenSecret: { $exists: true }
      }).sort({ updatedAt: -1 });
    }
    return null;
  }

  /**
   * Build a Twitter client from a token doc using OAuth 1.0a user tokens.
   * REQUIRED for v1.1 media upload.
   */
  getUserClientFromDoc(doc) {
    const oauthToken = doc.oauthToken;             // <-- update if different
    const oauthTokenSecret = doc.oauthTokenSecret; // <-- update if different

    if (!oauthToken || !oauthTokenSecret) {
      throw new Error('Twitter OAuth1 tokens missing (required for media upload and tweeting)');
    }

    return new TwitterApi({
      appKey: TWITTER_API_KEY,
      appSecret: TWITTER_API_SECRET,
      accessToken: oauthToken,
      accessSecret: oauthTokenSecret,
    });
  }

  /**
   * Resolve a client for the given identifier.
   */
  async getUserClient(identifier) {
    const doc = await this.findToken(identifier);
    if (!doc) throw new Error('Twitter not connected for this user');
    return this.getUserClientFromDoc(doc);
  }

  /**
   * Get the user handle (username) with improved caching.
   * Only makes API call if handle is not cached or cache is stale.
   */
  async getTwitterHandle(identifier) {
    const doc = await this.findToken(identifier);
    if (!doc) throw new Error('Twitter not connected for this user');

    const handleCacheAge = doc.handleUpdatedAt ? Date.now() - new Date(doc.handleUpdatedAt).getTime() : Infinity;
    const CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

    if (doc.handle && handleCacheAge < CACHE_MAX_AGE) {
      console.log('[Twitter] Using cached handle (age:', Math.round(handleCacheAge / 1000 / 60), 'min):', doc.handle);
      return doc.handle;
    }

    console.log('[Twitter] Handle cache stale/missing, making API call to get user info...');
    const client = this.getUserClientFromDoc(doc);

    try {
      const me = await client.v2.me();
      console.log('[TW] v2.me success - remain:', me.rateLimit?.remaining, 'reset:', me.rateLimit?.reset);

      const handle = me?.data?.username;
      if (handle) {
        doc.handle = handle;
        doc.name = me?.data?.name || doc.name;
        doc.handleUpdatedAt = new Date();
        await doc.save();
        console.log('[Twitter] Cached handle:', handle);
      }
      return handle || null;
    } catch (e) {
      console.error('[TW ERR] v2.me failed:', e.code, e.message);
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
   * Upload media to Twitter (v1.1 API required for media upload)
   * Now uses centralized media manager for consistent S3 URLs
   */
  async uploadMedia(identifier, mediaUrlOrBuffer) {
    const client = await this.getUserClient(identifier);
    let input;
    let filenameHint = null;

    // Handle URL string by using centralized media manager
    if (typeof mediaUrlOrBuffer === 'string') {
      console.log('[Twitter] Getting consistent media URL via centralized manager...');
      try {
        // Get consistent S3 URL (or create if doesn't exist)
        const s3Url = await this.mediaManager.getConsistentMediaUrl(mediaUrlOrBuffer, 'video');
        
        // Get media buffer for Twitter upload (Twitter API expects Buffer, not URL)
        const mediaBuffer = await this.mediaManager.getMediaBuffer(mediaUrlOrBuffer);
        
        input = mediaBuffer;
        filenameHint = mediaUrlOrBuffer;
        console.log('[Twitter] Media prepared with buffer via centralized manager, size:', mediaBuffer.length, 'bytes');
      } catch (error) {
        console.error('[Twitter] Failed to prepare media via centralized manager:', error.message);
        throw new Error('Failed to prepare media for Twitter');
      }
    } else if (Buffer.isBuffer(mediaUrlOrBuffer)) {
      input = mediaUrlOrBuffer;
    } else {
      throw new Error('uploadMedia requires a Buffer or URL string input.');
    }

    // Detect type
    const info = this.detectMedia(input, filenameHint);
    const detectedType = info.type;
    const isGif = detectedType === 'IMAGE_GIF';
    const isImage = detectedType === 'IMAGE' || detectedType === 'IMAGE_GIF';

    try {
      if (isImage) {
        console.log('[Twitter] Uploading as image (Buffer)...');
        const mediaId = isGif
          ? await client.v1.uploadMedia(input, { type: 'gif' })
          : await client.v1.uploadMedia(input, { type: 'png' }); // specify type for images
        console.log('[TW] v1.uploadMedia (image) success - mediaId:', mediaId);
        return mediaId;
      } else {
        console.log('[Twitter] Uploading as video (Buffer)...');
        // Twitter API v1.1 expects Buffer for media upload
        const mediaId = await client.v1.uploadMedia(input, { mimeType: 'video/mp4' });
        console.log('[TW] v1.uploadMedia (video) success - mediaId:', mediaId);
        return mediaId;
      }
    } catch (e) {
      console.error('[TW ERR] v1.uploadMedia failed:', e.code, e.message);
      throw new Error('Twitter media upload failed');
    }
  }

  /**
   * Post content to Twitter (v2), with optional media (Buffer or URL).
   * Trims text to 280 characters.
   * Now uses LinkedIn-style media handling.
   */
  async postToTwitter(identifier, text, mediaUrlOrBuffer = null) {
    // Handle both string and array inputs for captions
    const captionText = Array.isArray(text) ? text[0] || '' : text || '';
    const client = await this.getUserClient(identifier);
    const payload = { text: String(captionText || '').trim().slice(0, 280) };

    if (mediaUrlOrBuffer) {
      try {
        console.log('[Twitter] Uploading media...');
        const mediaId = await this.uploadMedia(identifier, mediaUrlOrBuffer);
        console.log('[Twitter] Media uploaded successfully, posting tweet with media...');

        const resp = await client.v2.tweet({
          ...payload,
          media: { media_ids: [mediaId] },
        });
        console.log('[TW] v2.tweet (with media) success');
        
        // Log rate limit info
        if (resp.rateLimit) {
          console.log('[Twitter] Rate limit:', {
            remaining: resp.rateLimit.remaining,
            limit: resp.rateLimit.limit,
            reset: new Date(resp.rateLimit.reset * 1000).toISOString()
          });
        }
        
        // Return structured object like LinkedIn
        const tweetId = resp?.data?.id;
        const twitterUrl = `https://twitter.com/i/status/${tweetId}`;
        
        return {
          success: true,
          postId: tweetId,
          url: twitterUrl,
          message: 'Successfully published to Twitter',
          rateLimit: resp.rateLimit ? {
            remaining: resp.rateLimit.remaining,
            limit: resp.rateLimit.limit,
            reset: resp.rateLimit.reset
          } : null
        };
      } catch (error) {
        console.error('[TW ERR] v2.tweet (with media) failed:', error.code, error.message);
        console.log('[Twitter] Attempting text-only tweet as fallback...');
        
        try {
          const resp = await client.v2.tweet(payload);
          console.log('[TW] v2.tweet (text-only fallback) success');
          
          // Log rate limit info
          if (resp.rateLimit) {
            console.log('[Twitter] Rate limit:', {
              remaining: resp.rateLimit.remaining,
              limit: resp.rateLimit.limit,
              reset: new Date(resp.rateLimit.reset * 1000).toISOString()
            });
          }
          
          // Return structured object for fallback too
          const tweetId = resp?.data?.id;
          const twitterUrl = `https://twitter.com/i/status/${tweetId}`;
          
          return {
            success: true,
            postId: tweetId,
            url: twitterUrl,
            message: 'Successfully published to Twitter (text-only)',
            rateLimit: resp.rateLimit ? {
              remaining: resp.rateLimit.remaining,
              limit: resp.rateLimit.limit,
              reset: resp.rateLimit.reset
            } : null
          };
        } catch (fallbackError) {
          console.error('[TW ERR] v2.tweet (text-only fallback) also failed:', fallbackError.code, fallbackError.message);
          throw new Error(`Twitter posting failed. Media tweets blocked by API tier (code 453). Text-only fallback also failed: ${fallbackError.message}`);
        }
      }
    }

    console.log('[Twitter] Posting text-only tweet...');
    try {
      const resp = await client.v2.tweet(payload);
      console.log('[TW] v2.tweet (text-only) success');
      
      // Log rate limit info
      if (resp.rateLimit) {
        console.log('[Twitter] Rate limit:', {
          remaining: resp.rateLimit.remaining,
          limit: resp.rateLimit.limit,
          reset: new Date(resp.rateLimit.reset * 1000).toISOString()
        });
      }
      
      // Return structured object like LinkedIn
      const tweetId = resp?.data?.id;
      const twitterUrl = `https://twitter.com/i/status/${tweetId}`;
      
      return {
        success: true,
        postId: tweetId,
        url: twitterUrl,
        message: 'Successfully published to Twitter',
        rateLimit: resp.rateLimit ? {
          remaining: resp.rateLimit.remaining,
          limit: resp.rateLimit.limit,
          reset: resp.rateLimit.reset
        } : null
      };
    } catch (error) {
      console.error('[TW ERR] v2.tweet (text-only) failed:', error.code, error.message);
      throw error;
    }
  }
}

module.exports = TwitterService;