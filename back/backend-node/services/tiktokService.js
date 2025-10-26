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

      // Security: Never log tokens in production
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 [TikTok Token Exchange] Full response:', JSON.stringify(data, null, 2));
      }

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
   * Get TikTok creator info including privacy options, interaction settings, and limits
   * Note: Rate limited to 20 requests per minute per user access_token
   */
  async getCreatorInfo(clerkUserId) {
    const accessToken = await this.getValidAccessTokenByClerk(clerkUserId);
    const url = `${TIKTOK_API_BASE}/post/publish/creator_info/query/`;

    console.log('[TikTok] Fetching creator info...');

    try {
      const { data } = await axios.post(url, {}, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8'
        },
        timeout: 10000
      });

      console.log('[TikTok] Creator info response:', data);

      // Check for errors
      if (data.error?.code !== 'ok') {
        throw new Error(`TikTok API error: ${data.error?.message || data.error?.code}`);
      }

      const creatorData = data.data;
      
      return {
        creatorAvatarUrl: creatorData.creator_avatar_url,
        creatorUsername: creatorData.creator_username,
        creatorNickname: creatorData.creator_nickname,
        privacyLevelOptions: creatorData.privacy_level_options || [],
        commentDisabled: creatorData.comment_disabled || false,
        duetDisabled: creatorData.duet_disabled || false,
        stitchDisabled: creatorData.stitch_disabled || false,
        maxVideoPostDurationSec: creatorData.max_video_post_duration_sec || 180 // Default 3 minutes
      };
    } catch (error) {
      // Handle specific error codes
      if (error.response?.status === 200 && error.response?.data?.error) {
        const errorCode = error.response.data.error.code;
        
        if (errorCode === 'spam_risk_too_many_posts') {
          throw new Error('Daily post limit reached for this TikTok account. Try again tomorrow.');
        }
        if (errorCode === 'spam_risk_user_banned_from_posting') {
          throw new Error('This TikTok account is banned from posting.');
        }
        if (errorCode === 'spam_risk_too_many_pending_share') {
          throw new Error('TikTok limit: Maximum 5 pending drafts per 24 hours. Publish or delete drafts in TikTok mobile app (Profile → Drafts), then try again.');
        }
        if (errorCode === 'reached_active_user_cap') {
          throw new Error('Daily quota for active users reached. Try again tomorrow.');
        }
        if (errorCode === 'scope_not_authorized') {
          throw new Error('TikTok posting unavailable. Missing required permissions.');
        }
      }

      if (error.response?.status === 401) {
        throw new Error('TikTok authentication failed. Please reconnect your account.');
      }

      if (error.response?.status === 429) {
        throw new Error('TikTok rate limit exceeded. Please wait a moment and try again.');
      }

      console.error('[TikTok] Failed to get creator info:', error.response?.data || error.message);
      throw new Error(`Failed to get TikTok creator info: ${error.message}`);
    }
  }

  /**
   * Fetch upload/publish status for a TikTok post
   * Note: Rate limited to 30 requests per minute per user access_token
   */
  async fetchPublishStatus(clerkUserId, publishId) {
    const accessToken = await this.getValidAccessTokenByClerk(clerkUserId);
    const url = `${TIKTOK_API_BASE}/post/publish/status/fetch/`;

    console.log('[TikTok] Fetching publish status for:', publishId);

    try {
      const { data } = await axios.post(url, {
        publish_id: publishId
      }, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8'
        },
        timeout: 10000
      });

      console.log('[TikTok] Status fetch response:', data);

      // Check for errors
      if (data.error?.code !== 'ok') {
        throw new Error(`TikTok API error: ${data.error?.message || data.error?.code}`);
      }

      const statusData = data.data;
      
      return {
        status: statusData.status, // PROCESSING_UPLOAD, PROCESSING_DOWNLOAD, PUBLISH_COMPLETE, FAILED, etc.
        failReason: statusData.fail_reason || null,
        publiclyAvailablePostId: statusData.publicaly_available_post_id || [],
        uploadedBytes: statusData.uploaded_bytes || 0
      };
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error('TikTok authentication failed. Please reconnect your account.');
      }

      if (error.response?.status === 429) {
        throw new Error('TikTok rate limit exceeded. Please wait a moment and try again.');
      }

      console.error('[TikTok] Failed to fetch publish status:', error.response?.data || error.message);
      throw new Error(`Failed to fetch TikTok publish status: ${error.message}`);
    }
  }

  /**
   * Validate image restrictions for TikTok
   */
  validateImageRestrictions(fileBuffer, mimeType) {
    // Supported formats: WebP, JPEG
    const supportedFormats = ['image/webp', 'image/jpeg', 'image/jpg'];
    if (!supportedFormats.includes(mimeType.toLowerCase())) {
      throw new Error(`TikTok only supports WebP and JPEG images. Received: ${mimeType}`);
    }

    // Maximum 20MB per image
    const maxSize = 20 * 1024 * 1024; // 20MB
    if (fileBuffer.length > maxSize) {
      throw new Error(`TikTok image size limit is 20MB. Your image is ${Math.round(fileBuffer.length / (1024 * 1024))}MB`);
    }

    // Note: Maximum 1080p resolution check would require image processing
    // This is enforced by TikTok API on upload
    console.log('[TikTok] Image validation passed:', {
      mimeType,
      size: `${Math.round(fileBuffer.length / (1024 * 1024))}MB`,
      maxAllowed: '20MB'
    });
  }

  /**
   * Validate video restrictions for TikTok
   */
  validateVideoRestrictions(fileBuffer, mimeType) {
    // Supported formats: MP4 (recommended), WebM, MOV
    const supportedFormats = ['video/mp4', 'video/webm', 'video/quicktime', 'video/mov'];
    if (!supportedFormats.includes(mimeType.toLowerCase())) {
      throw new Error(`TikTok only supports MP4, WebM, and MOV videos. Received: ${mimeType}`);
    }

    // Maximum 4GB per video
    const maxSize = 4 * 1024 * 1024 * 1024; // 4GB
    if (fileBuffer.length > maxSize) {
      throw new Error(`TikTok video size limit is 4GB. Your video is ${Math.round(fileBuffer.length / (1024 * 1024 * 1024))}GB`);
    }

    console.log('[TikTok] Video validation passed:', {
      mimeType,
      size: `${Math.round(fileBuffer.length / (1024 * 1024))}MB`,
      maxAllowed: '4GB'
    });

    // Note: Additional restrictions enforced by TikTok API:
    // - Codecs: H.264 (recommended), H.265, VP8, VP9
    // - Framerate: 23-60 FPS
    // - Resolution: 360px-4096px (both height and width)
    // - Duration: Maximum 10 minutes (TikTok may trim based on user's account limits)
  }

  /**
   * Upload photo to TikTok using Content Posting API
   * Uses FILE_UPLOAD method (downloads from S3, uploads buffer to TikTok)
   * This avoids domain verification requirements of PULL_FROM_URL
   */
  async uploadPhoto({ clerkUserId, photoUrl, caption = '' }) {
    const accessToken = await this.getValidAccessTokenByClerk(clerkUserId);
    const url = `${TIKTOK_API_BASE}/post/publish/content/init/`;

    console.log('[TikTok] Uploading photo as draft (FILE_UPLOAD mode)...');
    
    // Download image from S3 to buffer (same as video)
    console.log('[TikTok] Downloading image from S3:', photoUrl);
    const imageResponse = await axios.get(photoUrl, {
      responseType: 'arraybuffer',
      timeout: 30000
    });
    const imageBuffer = Buffer.from(imageResponse.data);
    const imageSize = imageBuffer.length;
    console.log('[TikTok] Image downloaded, size:', imageSize, 'bytes');
    
    // Validate image size (max 20MB for TikTok photos)
    if (imageSize > 20 * 1024 * 1024) {
      throw new Error('Image exceeds TikTok maximum size of 20MB');
    }

    // TikTok photo API supports title (90 chars) and description (4000 chars)
    const payload = {
      post_info: {
        title: caption.substring(0, 90), // Max 90 characters for photo title
        description: caption // Full caption in description (max 4000 chars)
      },
      source_info: {
        source: 'FILE_UPLOAD',
        photo_cover_index: 0,
        photo_images: [imageSize] // Array of image sizes in bytes
      },
      post_mode: 'MEDIA_UPLOAD', // Upload to TikTok (draft mode)
      media_type: 'PHOTO'
    };

    console.log('[TikTok] Photo init payload:', payload);

    try {
      // Step 1: Initialize photo upload
      const { data } = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8'
        },
        timeout: 30000
      });

      console.log('[TikTok] Photo init response:', data);

      // Check for errors
      if (data.error?.code !== 'ok') {
        const errorCode = data.error?.code;
        console.error('[TikTok] Photo init failed:', errorCode);
        
        // Handle specific photo upload errors
        if (errorCode === 'spam_risk_too_many_pending_share') {
          throw new Error('TikTok limit: Maximum 5 pending drafts per 24 hours. Publish or delete drafts in TikTok mobile app (Profile → Drafts), then try again.');
        }
        if (errorCode === 'app_version_check_failed') {
          throw new Error('TikTok app version too old. Please update your TikTok mobile app to version 31.8 or higher.');
        }
        if (errorCode === 'url_ownership_unverified') {
          throw new Error('S3 domain not verified with TikTok. Using FILE_UPLOAD method instead.');
        }
        
        throw new Error(`TikTok photo init error: ${errorCode}`);
      }

      const publishId = data?.data?.publish_id;
      const uploadUrl = data?.data?.upload_url;
      
      if (!uploadUrl) {
        console.log('[TikTok] No upload_url in response - photo might be ready already');
        return {
          publish_id: publishId,
          mediaType: 'image'
        };
      }

      // Step 2: Upload the image buffer to TikTok's upload URL
      console.log('[TikTok] Step 2: Uploading image buffer to TikTok...');
      const uploadResponse = await axios.put(uploadUrl, imageBuffer, {
        headers: {
          'Content-Type': 'image/jpeg',
          'Content-Length': imageSize
        },
        timeout: 60000,
        maxBodyLength: Infinity
      });

      console.log('[TikTok] Image buffer uploaded successfully, status:', uploadResponse.status);
      
      return {
        publish_id: publishId,
        mediaType: 'image'
      };
    } catch (error) {
      console.error('[TikTok] Photo upload failed:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Initialize + upload video to TikTok using the correct API flow.
   */
  async uploadVideo({ clerkUserId, fileBuffer, mimeType = 'video/mp4' }) {
    const accessToken = await this.getValidAccessTokenByClerk(clerkUserId);
    // Use inbox endpoint for draft mode (Upload to TikTok)
    const url = `${TIKTOK_API_BASE}/post/publish/inbox/video/init/`;

    // Validate video restrictions before upload
    this.validateVideoRestrictions(fileBuffer, mimeType);

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

    // Step 1: Initialize upload with TikTok API (Draft mode - inbox endpoint)
    console.log('[TikTok] Step 1: Initializing draft upload...');
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
    
    let initData;
    try {
      const response = await axios.post(
        url,
        initPayload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      initData = response.data;
    } catch (axiosError) {
      // Log the full error response
      console.error('[TikTok] Init request failed:', {
        status: axiosError.response?.status,
        data: axiosError.response?.data,
        message: axiosError.message
      });
      
      // Check if it's a 400 with TikTok error code
      if (axiosError.response?.status === 400 && axiosError.response?.data?.error) {
        const errorCode = axiosError.response.data.error.code;
        console.error('[TikTok] TikTok API returned error code:', errorCode);
        
        // Handle specific error codes from official TikTok documentation
        if (errorCode === 'spam_risk_too_many_posts') {
          throw new Error('Daily post limit reached for this TikTok account. Try again tomorrow.');
        }
        if (errorCode === 'spam_risk_user_banned_from_posting') {
          throw new Error('This TikTok account is banned from posting.');
        }
        if (errorCode === 'reached_active_user_cap') {
          throw new Error('Daily quota for active users reached. Try again tomorrow.');
        }
        if (errorCode === 'unaudited_client_can_only_post_to_private_accounts') {
          throw new Error('Your TikTok app is unaudited and can only post to private accounts.');
        }
        if (errorCode === 'url_ownership_unverified') {
          throw new Error('URL domain ownership not verified with TikTok.');
        }
        if (errorCode === 'privacy_level_option_mismatch') {
          throw new Error('Invalid privacy level selected for this TikTok account.');
        }
        
        // Generic error (includes undocumented codes like spam_risk_too_many_pending_share)
        throw new Error(`TikTok API error: ${errorCode} - ${axiosError.response.data.error?.message || 'Please try again later'}`);

      } else {
        throw axiosError;
      }
    }

    console.log('[TikTok] Init response:', initData);
    
    // Check for errors (this should not be reached if we handled above, but keep as safety)
    if (initData.error?.code !== 'ok') {
      const errorCode = initData.error?.code;
      
      // Handle specific error codes
      if (errorCode === 'spam_risk_too_many_pending_share') {
        throw new Error('Too many pending drafts in your TikTok account. Please publish or delete some drafts from your TikTok mobile app before uploading more.');
      }
      if (errorCode === 'spam_risk_too_many_posts') {
        throw new Error('Daily post limit reached for this TikTok account. Try again tomorrow.');
      }
      if (errorCode === 'spam_risk_user_banned_from_posting') {
        throw new Error('This TikTok account is banned from posting.');
      }
      if (errorCode === 'reached_active_user_cap') {
        throw new Error('Daily quota for active users reached. Try again tomorrow.');
      }
      
      throw new Error(`TikTok API error: ${initData.error?.message || errorCode}`);
    }
    
    const publishId = initData?.data?.publish_id;
    const uploadUrl = initData?.data?.upload_url;

    if (!publishId || !uploadUrl) {
      throw new Error(`TikTok init response missing publish_id or upload_url: ${JSON.stringify(initData)}`);
    }

    console.log('[TikTok] Got publish_id:', publishId);
    console.log('[TikTok] Got upload_url:', uploadUrl);

    // Step 2: Upload bytes directly to upload_url using PUT request
    console.log('[TikTok] Step 2: Uploading file bytes to TikTok servers...');
    console.log('[TikTok] Upload details:', {
      publishId,
      fileSize: fileBuffer.length,
      mimeType,
      uploadUrl: uploadUrl.substring(0, 50) + '...'
    });

    const uploadResponse = await axios.put(
      uploadUrl,
      fileBuffer,
      {
        headers: {
          'Content-Range': `bytes 0-${fileBuffer.length - 1}/${fileBuffer.length}`,
          'Content-Type': mimeType
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 180000
      }
    );

    console.log('[TikTok] Upload response status:', uploadResponse.status);

    return {
      publish_id: publishId,
      mediaType: 'video'
    };
  }

  /**
   * Upload video to TikTok as draft for user to edit and publish
   * @param {Object} options
   * @param {string} options.clerkUserId - User's Clerk ID
   * @param {string} options.uploadId - TikTok upload ID
   * @param {string} options.title - Video caption/title
   */
  async publishVideo({ clerkUserId, uploadId, title }) {
    const accessToken = await this.getValidAccessTokenByClerk(clerkUserId);
    const url = `${TIKTOK_API_BASE}/post/publish/video/`;

    // Step 3: Upload as draft - user will edit and publish from TikTok app
    console.log('[TikTok] Step 3: Uploading video as draft...');
    
    const payload = {
      post_info: {
        caption: title,
        post_mode: 'DRAFT' // Always upload as draft
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

    // Handle draft upload response
    const status = data?.data?.status;

    // Draft upload successful - video is now in user's TikTok drafts
    if (status === 'PROCESSING' || status === 'SUCCESS') {
      return {
        success: true,
        platform: 'tiktok',
        postId: uploadId,
        url: null, // No URL for drafts - user publishes from TikTok app
        message: '✅ Successfully uploaded to TikTok as draft. Open your TikTok app to edit and publish.'
      };
    }

    // Handle errors
    const errorMessage = data?.data?.error_message || data?.error?.message || status || 'Unknown error';
    return {
      success: false,
      platform: 'tiktok',
      postId: uploadId,
      message: `Failed to upload to TikTok: ${errorMessage}`
    };
  }

  /**
   * Uploads content to TikTok as draft (Upload to TikTok mode).
   * User can then edit and publish from their TikTok app.
   * @param {Object} identifier - User identifier with clerkUserId
   * @param {string|Array} message - Caption text
   * @param {string} mediaUrl - S3 URL of media file
   * @param {string} mediaType - Media type (default: 'video')
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
    console.log('[TikTok] Token scopes:', scopeStr);
    console.log('[TikTok] Media type:', mediaType);
    
    const hasVideoUpload = /\bvideo\.upload\b/.test(scopeStr);
    const hasVideoPublish = /\bvideo\.publish\b/.test(scopeStr);
    
    console.log('[TikTok] Scope check:', {
      hasVideoUpload,
      hasVideoPublish,
      scopeStr
    });
    
    if (!hasVideoUpload || !hasVideoPublish) {
      throw new Error(`TikTok posting unavailable. Missing required scopes: ${!hasVideoUpload ? 'video.upload ' : ''}${!hasVideoPublish ? 'video.publish' : ''}. Current scopes: ${scopeStr}`);
    }

    const profile = await this.getTikTokProfile(identifier);
    console.log('[TikTok] Uploading as draft for:', profile.displayName || profile.username || 'TikTok User');

    try {
      // Get creator info to check limits and settings
      const creatorInfo = await this.getCreatorInfo(clerkUserId);
      console.log('[TikTok] Creator info:', {
        username: creatorInfo.creatorUsername,
        maxDuration: `${creatorInfo.maxVideoPostDurationSec}s`,
        privacyOptions: creatorInfo.privacyLevelOptions
      });

      // Check if user has reached daily post limit or is banned
      // (This is handled by getCreatorInfo throwing errors)

      let publish_id;

      // Determine if it's an image or video
      console.log('[TikTok] Media type detected:', mediaType, 'URL:', mediaUrl);
      
      if (mediaType === 'image') {
        // Photo upload using PULL_FROM_URL
        console.log('[TikTok] Uploading photo...');
        const result = await this.uploadPhoto({
          clerkUserId,
          photoUrl: mediaUrl, // S3 URL
          caption: captionText
        });
        publish_id = result.publish_id;
        console.log('[TikTok] Photo uploaded as draft. Publish ID:', publish_id);
      } else {
        // Video upload using FILE_UPLOAD
        console.log('[TikTok] Uploading video...');
        const mimeType = 'video/mp4';
        const result = await this.uploadVideo({
          clerkUserId,
          fileBuffer: mediaUrl, // S3 URL - TikTok service will download it
          mimeType
        });
        publish_id = result.publish_id;
        console.log('[TikTok] Video uploaded as draft. Publish ID:', publish_id);
      }
      
      const mediaTypeName = mediaType === 'image' ? 'Photo' : 'Video';
      return {
        success: true,
        platform: 'tiktok',
        postId: publish_id,
        url: 'https://www.tiktok.com/tiktokstudio/content?tab=draft', // TikTok Studio drafts tab
        message: `✅ Successfully uploaded ${mediaTypeName} to TikTok mobile app as draft.`
      };
    } catch (error) {
      // If the error already has a user-friendly message (from uploadVideo or getCreatorInfo), preserve it
      if (error.message && !error.response) {
        // This is a custom error we threw with a user-friendly message - just re-throw it
        console.error('❌ TikTok Error:', error.message);
        throw error;
      }
      
      // Handle HTTP errors
      if (error.response?.status === 401) {
        console.error('❌ TikTok 401 Error - Token/Scope Issue:', error.response?.data);
        throw new Error('TikTok posting unavailable. Authentication failed.');
      }
      if (error.response?.status === 403) {
        console.error('❌ TikTok 403 Error - Permission Issue:', error.response?.data);
        throw new Error('TikTok posting unavailable. Permission denied.');
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