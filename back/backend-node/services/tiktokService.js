/* back/backend-node/services/tiktokService.js */
const axios = require('axios');
const qs = require('qs');
const dayjs = require('dayjs');
const TikTokToken = require('../models/TikTokToken');

// For sandbox testing, use the sandbox API URL
const TIKTOK_API_BASE = process.env.TIKTOK_API_URL || 'https://open-sandbox.tiktokapis.com/v2';
const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;
const REDIRECT_URI = process.env.TIKTOK_REDIRECT_URI; // e.g., https://yourdomain.com/api/auth/tiktok/callback

function isExpiringSoon(expiresAt) {
  // refresh 5 minutes before expiry
  return dayjs(expiresAt).diff(dayjs(), 'second') < 300;
}

async function exchangeCodeForToken(code) {
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

async function refreshAccessToken(doc) {
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

async function getValidAccessTokenByClerk(clerkUserId) {
  const doc = await TikTokToken.findOne({ clerkUserId, provider: 'tiktok' });
  if (!doc) throw new Error('TikTok not connected for this user');
  if (isExpiringSoon(doc.expiresAt)) {
    try {
      return await refreshAccessToken(doc);
    } catch (e) {
      // bubble up so caller can re-auth if needed
      throw new Error(`TikTok token refresh failed: ${e.message}`);
    }
  }
  return doc.accessToken;
}

/**
 * Upload a media file buffer to TikTok (supports both images and videos).
 * Returns { video_id } or { image_id }
 */
async function uploadVideo({ clerkUserId, fileBuffer, mimeType = 'video/mp4' }) {
  const accessToken = await getValidAccessTokenByClerk(clerkUserId);
  const url = `${TIKTOK_API_BASE}/video/upload/`;

  // Detect if this is an image or video based on MIME type
  const isImage = mimeType.startsWith('image/');
  const isVideo = mimeType.startsWith('video/');
  
  if (!isImage && !isVideo) {
    throw new Error(`Unsupported media type: ${mimeType}. TikTok supports images and videos.`);
  }

  let input;
  
  // Handle URL string by downloading to Buffer
  if (typeof fileBuffer === 'string') {
    console.log('[TikTok] Downloading media from URL:', fileBuffer);
    try {
      const response = await axios.get(fileBuffer, { responseType: 'arraybuffer' });
      input = Buffer.from(response.data);
      console.log('[TikTok] Downloaded media, size:', input.length, 'bytes');
    } catch (error) {
      console.error('[TikTok] Failed to download media from URL:', error.message);
      throw new Error('Failed to download media from URL');
    }
  } else if (Buffer.isBuffer(fileBuffer)) {
    input = fileBuffer;
  } else {
    throw new Error('uploadVideo requires a Buffer or URL string input.');
  }

  const { data } = await axios.post(url, input, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': mimeType,
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  // Expected: { data: { video: { video_id } } } OR { video_id } OR { image_id }
  const mediaId =
    data?.data?.video?.video_id ??
    data?.video_id ??
    data?.image_id ??
    data?.data?.image?.image_id ??
    null;

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
async function publishVideo({ clerkUserId, videoId, title }) {
  const accessToken = await getValidAccessTokenByClerk(clerkUserId);
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
 * @param {string} message  Caption/text for the post
 * @param {string} mediaUrl  URL to media file
 * @param {string} mediaType  'video' or 'image'
 */
async function postToTikTok(identifier, message, mediaUrl, mediaType = 'video') {
  const { clerkUserId } = identifier;
  
  if (!clerkUserId) {
    throw new Error('TikTok requires authenticated clerkUserId');
  }

  if (!mediaUrl) {
    throw new Error('TikTok requires media content: mediaUrl (HTTPS URL)');
  }

  if (!message) {
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
  const { video_id } = await uploadVideo({
    clerkUserId: clerkUserId,
    fileBuffer: mediaUrl, // S3 URL - TikTok service will download it
    mimeType: mimeType,
  });

  // 2) Publish media
  const result = await publishVideo({
    clerkUserId: clerkUserId,
    videoId: video_id,
    title: message,
  });

  return result;
}

module.exports = {
  exchangeCodeForToken,
  refreshAccessToken,
  // Back-compat export name
  getValidAccessToken: getValidAccessTokenByClerk,
  uploadVideo,
  publishVideo,
  postToTikTok,
};
