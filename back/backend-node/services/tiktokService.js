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

async function getValidAccessToken(userId) {
  const doc = await TikTokToken.findOne({ userId, provider: 'tiktok' });
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
 * Upload a video file buffer to TikTok.
 * Returns { video_id }
 */
async function uploadVideo({ userId, fileBuffer, mimeType = 'video/mp4' }) {
  const accessToken = await getValidAccessToken(userId);
  const url = `${TIKTOK_API_BASE}/video/upload/`;

  const { data } = await axios.post(url, fileBuffer, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': mimeType,
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  // Expected: { data: { video: { video_id } } } OR { video_id }
  const videoId =
    data?.data?.video?.video_id ??
    data?.video_id ??
    null;

  if (!videoId) {
    throw new Error(`TikTok upload response missing video_id: ${JSON.stringify(data)}`);
  }

  return { video_id: videoId };
}

/**
 * Publish a previously uploaded video by video_id with a title/caption
 */
async function publishVideo({ userId, videoId, title }) {
  const accessToken = await getValidAccessToken(userId);
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
  return data;
}

module.exports = {
  exchangeCodeForToken,
  refreshAccessToken,
  getValidAccessToken,
  uploadVideo,
  publishVideo,
};
