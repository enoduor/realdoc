const axios = require('axios');
const crypto = require('crypto');
const path = require('path');
const FormData = require('form-data');

const PYTHON_API_BASE_URL = process.env.PYTHON_API_BASE_URL || 'http://localhost:5001';

class MediaManagerService {
  constructor() {
    if (MediaManagerService.instance) {
      return MediaManagerService.instance;
    }
    
    this.mediaCache = new Map(); // Cache media hash -> S3 URL
    MediaManagerService.instance = this;
  }

  /**
   * Generate consistent hash for media content
   */
  generateMediaHash(buffer, originalUrl) {
    // Only hash the content, not the URL - this ensures same content = same hash
    const contentHash = crypto.createHash('md5').update(buffer).digest('hex');
    return contentHash;
  }

  /**
   * Check if media already exists in S3
   */
  async checkExistingMedia(mediaHash) {
    if (this.mediaCache.has(mediaHash)) {
      return this.mediaCache.get(mediaHash);
    }
    return null;
  }

  /**
   * Download media from external URL to buffer
   */
  async downloadToBuffer(url) {
    console.log('[MediaManager] Downloading media from external URL:', url);
    try {
      const response = await fetch(url);
      const buffer = Buffer.from(await response.arrayBuffer());
      console.log('[MediaManager] Media downloaded successfully, size:', buffer.length, 'bytes');
      return buffer;
    } catch (error) {
      console.error('[MediaManager] Failed to download media:', error.message);
      throw new Error('Failed to download media from external URL');
    }
  }

  /**
   * Upload media to S3 with consistent naming
   */
  async uploadToS3(buffer, originalUrl, mediaType = 'video') {
    console.log('[MediaManager] Uploading media to S3 with consistent naming...');
    try {
      const form = new FormData();
      
      // Use consistent filename based on content hash
      const mediaHash = this.generateMediaHash(buffer, originalUrl);
      const extension = path.extname(originalUrl.split('?')[0]) || '.mp4';
      const filename = `media_${mediaHash}${extension}`;
      
      const contentType = mediaType === 'video' ? 'video/mp4' : 'image/jpeg';
      
      form.append('file', buffer, { filename, contentType });
      form.append('platform', 'centralized');

      const resp = await axios.post(`${PYTHON_API_BASE_URL}/api/v1/upload`, form, {
        headers: form.getHeaders(),
        timeout: 60000,
      });
      
      if (!resp.data?.url) throw new Error('S3 upload failed: no URL returned');
      
      const s3Url = resp.data.url;
      console.log('[MediaManager] Media uploaded to S3 with consistent URL:', s3Url);
      
      // Cache the result
      this.mediaCache.set(mediaHash, s3Url);
      
      return s3Url;
    } catch (error) {
      console.error('[MediaManager] Failed to upload media to S3:', error.message);
      throw new Error('Failed to upload media to S3');
    }
  }

  /**
   * Check if URL is already an S3 URL
   */
  isS3Url(url) {
    return url.includes('amazonaws.com') || url.includes('s3.amazonaws.com');
  }

  /**
   * Get or create consistent S3 URL for media
   * This is the main method all platforms should use
   */
  async getConsistentMediaUrl(mediaUrl, mediaType = 'video') {
    console.log('[MediaManager] Getting consistent media URL for:', mediaUrl);
    
    // If already S3 URL, return it directly (no need to re-upload)
    if (this.isS3Url(mediaUrl)) {
      console.log('[MediaManager] Already S3 URL, returning directly:', mediaUrl);
      return mediaUrl;
    }
    
    try {
      // Download media to get buffer
      const mediaBuffer = await this.downloadToBuffer(mediaUrl);
      
      // Generate consistent hash
      const mediaHash = this.generateMediaHash(mediaBuffer, mediaUrl);
      
      // Check if we already have this media
      const existingUrl = await this.checkExistingMedia(mediaHash);
      if (existingUrl) {
        console.log('[MediaManager] Using existing S3 URL:', existingUrl);
        return existingUrl;
      }
      
      // Upload to S3 with consistent naming
      const s3Url = await this.uploadToS3(mediaBuffer, mediaUrl, mediaType);
      console.log('[MediaManager] Created new consistent S3 URL:', s3Url);
      
      return s3Url;
    } catch (error) {
      console.error('[MediaManager] Failed to get consistent media URL:', error.message);
      throw new Error('Failed to get consistent media URL');
    }
  }

  /**
   * Get media buffer for platforms that need it (like Twitter)
   */
  async getMediaBuffer(mediaUrl) {
    console.log('[MediaManager] Getting media buffer for:', mediaUrl);
    return await this.downloadToBuffer(mediaUrl);
  }

  /**
   * Clear media cache (useful for testing)
   */
  clearCache() {
    this.mediaCache.clear();
    console.log('[MediaManager] Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.mediaCache.size,
      keys: Array.from(this.mediaCache.keys())
    };
  }

  /**
   * Get singleton instance
   */
  static getInstance() {
    if (!MediaManagerService.instance) {
      MediaManagerService.instance = new MediaManagerService();
    }
    return MediaManagerService.instance;
  }
}

module.exports = MediaManagerService;
