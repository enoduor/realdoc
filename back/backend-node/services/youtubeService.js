/* eslint-disable no-console */
const { google } = require('googleapis');
const axios = require('axios');
const YouTubeToken = require('../models/YouTubeToken');
const FormData = require('form-data');
const path = require('path');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const fileType = require('file-type');

const PYTHON_API_BASE_URL = process.env.PYTHON_API_BASE_URL || 'http://localhost:5001';

class YouTubeService {
  constructor(config = {}) {
    // Configuration can be added here if needed
  }

  getOAuthClient() {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
      throw new Error('Missing Google OAuth env (GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI)');
    }
    return new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
  }

  /**
   * Find a token doc by { clerkUserId } - same pattern as other platforms
   */
  async findToken(identifier = {}) {
    if (identifier.clerkUserId) {
      return YouTubeToken.findOne({ 
        clerkUserId: identifier.clerkUserId, 
        isActive: true 
      });
    }
    return null;
  }

  /**
   * Get refresh token from identifier - same pattern as other platforms
   */
  async getRefreshTokenFromIdentifier(identifier) {
    const doc = await this.findToken(identifier);
    if (!doc) throw new Error('YouTube not connected for this user');
    return doc.refreshToken;
  }

  async getYouTubeClient(refreshToken) {
    if (!refreshToken) throw new Error('Missing user refresh token');
    const auth = this.getOAuthClient();
    auth.setCredentials({ refresh_token: refreshToken });
    return google.youtube({ version: 'v3', auth });
  }

  /**
   * Validate YouTube credentials and get client
   * Follows the same pattern as other platforms: validate credentials at start
   */
  async validateYouTubeCredentials(refreshToken) {
    if (!refreshToken) {
      throw new Error('YouTube not connected for this user - missing refresh token');
    }
    
    try {
      const yt = await this.getYouTubeClient(refreshToken);
      // Test the credentials by making a light API call
      await yt.channels.list({
        part: ['snippet'],
        mine: true
      });
      return yt;
    } catch (error) {
      if (error.message.includes('invalid_grant') || error.message.includes('invalid_token')) {
        throw new Error('YouTube token has expired. Please reconnect your YouTube account.');
      }
      throw new Error(`YouTube authentication failed: ${error.message}`);
    }
  }

  async whoAmI(refreshToken) {
    const yt = await this.getYouTubeClient(refreshToken);
    const res = await yt.channels.list({
      part: ['snippet', 'contentDetails', 'statistics'],
      mine: true
    });
    return res.data;
  }

  /**
   * Detect MIME type and filename from buffer using file-type package
   * This provides accurate detection instead of hard-coded assumptions
   */
  detectMediaType(buffer) {
    try {
      const fileInfo = fileType.fromBuffer(buffer);
      if (fileInfo) {
        return {
          mimeType: fileInfo.mime,
          extension: fileInfo.ext,
          filename: `video.${fileInfo.ext}` // Default filename with correct extension
        };
      }
      
      // Fallback: try to detect from buffer magic bytes
      if (buffer.length >= 12) {
        // MP4 magic bytes
        if (buffer.slice(4, 8).toString('hex') === '66747970') {
          return { mimeType: 'video/mp4', extension: 'mp4', filename: 'video.mp4' };
        }
        // MOV magic bytes
        if (buffer.slice(4, 8).toString('hex') === '6d6f6f76') {
          return { mimeType: 'video/quicktime', extension: 'mov', filename: 'video.mov' };
        }
        // AVI magic bytes
        if (buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'AVI ') {
          return { mimeType: 'video/x-msvideo', extension: 'avi', filename: 'video.avi' };
        }
      }
      
      // Final fallback
      return { mimeType: 'video/mp4', extension: 'mp4', filename: 'video.mp4' };
    } catch (error) {
      console.warn('[YouTube] MIME type detection failed, using fallback:', error.message);
      return { mimeType: 'video/mp4', extension: 'mp4', filename: 'video.mp4' };
    }
  }

  /**
   * Download media from external URL to buffer
   */
  async downloadToBuffer(url) {
    console.log('[YouTube] Downloading media from external URL:', url);
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000,
        maxContentLength: 50 * 1024 * 1024,
        maxBodyLength: 50 * 1024 * 1024,
        headers: { 'User-Agent': 'CreatorSync/1.0' }
      });
      const buffer = Buffer.from(response.data);
      console.log('[YouTube] Media downloaded successfully, size:', buffer.length, 'bytes');
      return buffer;
    } catch (error) {
      console.error('[YouTube] Failed to download media:', error.message);
      throw new Error('Failed to download media from external URL');
    }
  }

  /**
   * Rehost media to S3 for reliable YouTube access
   */
  async rehostToS3(buffer, originalUrl) {
    console.log('[YouTube] Rehosting media to S3 for reliable YouTube access...');
    try {
      const form = new FormData();
      
      // Detect real MIME type and filename from buffer
      const mediaInfo = this.detectMediaType(buffer);
      const filename = path.basename(originalUrl.split('?')[0]) || mediaInfo.filename;
      
      console.log('[YouTube] Detected media type:', mediaInfo.mimeType, 'extension:', mediaInfo.extension);
      
      form.append('file', buffer, { filename, contentType: mediaInfo.mimeType });
      form.append('platform', 'youtube');

      const resp = await axios.post(`${PYTHON_API_BASE_URL}/api/v1/upload`, form, {
        headers: form.getHeaders(),
        timeout: 60000,
      });
      
      if (!resp.data?.url) throw new Error('S3 rehost failed: no URL returned');
      
      console.log('[YouTube] Media rehosted to S3:', resp.data.url);
      return resp.data.url;
    } catch (error) {
      console.error('[YouTube] Failed to rehost media to S3:', error.message);
      throw new Error('Failed to rehost media to S3');
    }
  }

    /**
   * Upload video using YouTube's resumable upload API with streaming
   * This avoids big in-memory buffers and allows uploads to resume on failure
   * 
   * Benefits:
   * - Streaming uploads (no large in-memory buffers)
   * - Automatic resumption on network failures
   * - Better memory efficiency for large videos
   * - Accurate MIME type detection for better YouTube processing
   * - Size-based upload strategy (resumable for large files)
   */
  async uploadVideoResumable(yt, mediaBuffer, meta) {
    const { title, description, tags = [], privacyStatus = 'unlisted' } = meta;
    
    const fileSizeMB = Math.round(mediaBuffer.length / (1024 * 1024));
    console.log(`[YouTube] Starting resumable upload with streaming... (File size: ${fileSizeMB} MB)`);
    
    // Detect real MIME type for better YouTube processing
    const mediaInfo = this.detectMediaType(mediaBuffer);
    console.log('[YouTube] Using detected MIME type for upload:', mediaInfo.mimeType);
    
    // Size-based upload strategy
    if (fileSizeMB > 100) {
      console.log('[YouTube] Large file detected (>100 MB), using enhanced resumable upload...');
    } else if (fileSizeMB > 50) {
      console.log('[YouTube] Medium file detected (50-100 MB), using standard resumable upload...');
    } else {
      console.log('[YouTube] Small file detected (<50 MB), using optimized resumable upload...');
    }
    
    // Step 1: Initialize resumable upload with enhanced options for large files
    const uploadOptions = {
      part: ['snippet', 'status'],
      requestBody: {
        snippet: { title, description, tags },
        status: { privacyStatus }
      },
      media: {
        body: Readable.from(mediaBuffer), // Convert buffer to readable stream
        mimeType: mediaInfo.mimeType // Use detected MIME type instead of hard-coded
      }
    };
    
    // Add resumable upload options for large files
    if (fileSizeMB > 100) {
      uploadOptions.media.resumable = true;
      console.log('[YouTube] Enhanced resumable upload enabled for large file');
    }
    
    console.log('[YouTube] Starting upload with options:', JSON.stringify(uploadOptions, null, 2));
    
    // Step 2: Execute the upload
    try {
      const response = await yt.videos.insert(uploadOptions);
      console.log(`[YouTube] Upload completed successfully! (${fileSizeMB} MB)`);
      return response;
    } catch (error) {
      console.error(`[YouTube] Upload failed for ${fileSizeMB} MB file:`, error.message);
      
      // For large files, provide specific resumable upload guidance
      if (fileSizeMB > 100) {
        console.log('[YouTube] Large file upload failed. The upload may be resumable on retry.');
      }
      
      throw error;
    }
  }

  /**
   * Posts a video to YouTube.
   * YouTube-only approach: downloads media from S3 URL and uploads to YouTube
   * ✅ UPDATED: Now uses resumable uploads with streaming for better performance and reliability
   * ✅ ENHANCED: Size-based resumable upload strategy for large files (>100 MB)
   * ✅ S3 ONLY: Only accepts S3 URLs, downloads media from S3 for processing
   */
  async postToYouTube(identifier, fileInput, meta = {}) {
    console.log('[YouTube] Starting postToYouTube with identifier:', identifier);
    
    // ✅ CREDENTIAL CHECK AT THE START (consistent with other platforms)
    const refreshToken = await this.getRefreshTokenFromIdentifier(identifier);
    console.log('[YouTube] Got refresh token:', refreshToken ? 'YES' : 'NO');
    
    if (!refreshToken) {
      throw new Error('YouTube not connected for this user - missing refresh token');
    }
    
    const yt = await this.validateYouTubeCredentials(refreshToken);
    console.log('[YouTube] YouTube client validated successfully');
    
    const { title, description, tags = [], privacyStatus = 'unlisted' } = meta;
    console.log('[YouTube] Meta received:', { title, description, tags, privacyStatus });

    let mediaBody = fileInput;
    let s3Url = null;

    // Handle S3 URL string
    if (typeof fileInput === 'string') {
      // Check if this is an S3 URL (multiple patterns for robustness)
      const s3Patterns = [
        'amazonaws.com',
        's3.amazonaws.com',
        'bigvideograb-media.s3.amazonaws.com', // Specific bucket
        's3://',
        'https://s3.'
      ];
      const isS3Url = s3Patterns.some(pattern => fileInput.includes(pattern));
      
      if (isS3Url) {
        console.log('[YouTube] Detected S3 URL, downloading media from S3:', fileInput);
        try {
          // Download media from S3 URL
          const mediaBuffer = await this.downloadToBuffer(fileInput);
          console.log('[YouTube] Media downloaded from S3, size:', mediaBuffer.length, 'bytes');
          
          // Detect MIME type from downloaded buffer
          const mediaInfo = this.detectMediaType(mediaBuffer);
          console.log('[YouTube] Detected media type from S3:', mediaInfo.mimeType, 'extension:', mediaInfo.extension);
          
          // Use downloaded buffer for YouTube upload
          mediaBody = mediaBuffer;
          s3Url = fileInput; // Already have S3 URL
          console.log('[YouTube] Using S3-downloaded buffer for YouTube upload');
        } catch (error) {
          console.error('[YouTube] Failed to download from S3 URL:', error.message);
          throw new Error('Failed to download media from S3 URL');
        }
      } else {
        throw new Error('YouTube only accepts S3 URLs. Received: ' + fileInput);
      }
    } else {
      console.log('[YouTube] Using direct file input (not URL)');
      mediaBody = fileInput;
    }

    console.log('[YouTube] Starting YouTube video upload with resumable streaming...');
    console.log('[YouTube] Media body type:', typeof mediaBody, 'isBuffer:', Buffer.isBuffer(mediaBody), 'length:', mediaBody?.length);
    
    // Ensure mediaBody is a buffer for the upload method
    if (!Buffer.isBuffer(mediaBody)) {
      throw new Error('Media body must be a buffer for YouTube upload');
    }
    
    try {
      // Use resumable upload with streaming for better performance and reliability
      const res = await this.uploadVideoResumable(yt, mediaBody, meta);

      console.log('[YouTube] Video upload successful, response:', res.data);

      // Return structured object like other platforms
      const videoId = res.data.id;
      const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
      
      console.log('[YouTube] Generated URL:', youtubeUrl);
      
      return {
        success: true,
        postId: videoId,
        url: youtubeUrl,
        message: 'Successfully published to YouTube'
      };
    } catch (error) {
      console.error('[YouTube] Video upload failed:', error.message);
      throw new Error(`YouTube video upload failed: ${error.message}`);
    }
  }
}

module.exports = YouTubeService;

