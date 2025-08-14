/* back/backend-node/services/twitterService.js */
const axios = require('axios');
const TwitterToken = require('../models/TwitterToken');

function isExpiringSoon(expiresAt, bufferMs = 5 * 60 * 1000) {
  return !expiresAt || new Date(expiresAt).getTime() <= (Date.now() + bufferMs);
}

/** Find a token doc by either { twitterUserId } or { userId } (prefers twitterUserId). */
async function findToken(identifier = {}) {
  const { twitterUserId, userId } = identifier || {};
  if (twitterUserId) return TwitterToken.findOne({ twitterUserId });
  if (userId) return TwitterToken.findOne({ userId });
  return null;
}

async function refreshAccessToken(identifier) {
  const doc = await findToken(identifier);
  if (!doc || !doc.refreshToken) throw new Error('No stored Twitter refresh token');

  const clientId = process.env.TWITTER_CLIENT_ID;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Twitter client credentials missing');

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const resp = await axios.post(
    'https://api.x.com/2/oauth2/token',
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: doc.refreshToken,
    }),
    {
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 15000,
    }
  );

  const { access_token, refresh_token, expires_in, token_type, scope, error } = resp.data;
  if (error === 'invalid_grant') {
    const err = new Error('TWITTER_REVOKED');
    err.status = 401;
    throw err;
  }

  // rotate + save
  doc.accessToken = access_token;
  doc.refreshToken = refresh_token || doc.refreshToken;
  doc.tokenType = token_type || doc.tokenType || 'bearer';
  doc.scope = scope || doc.scope;
  doc.expiresAt = new Date(Date.now() + Number(expires_in || 7200) * 1000);
  await doc.save();

  return doc.accessToken;
}

async function getValidAccessToken(identifier) {
  const doc = await findToken(identifier);
  if (!doc) throw new Error('Twitter not connected for this user');

  if (isExpiringSoon(doc.expiresAt)) {
    try {
      return await refreshAccessToken(identifier);
    } catch (e) {
      console.error('[Twitter] refresh failed:', e.response?.data || e.message);
      return doc.accessToken; // one-time fallback
    }
  }
  return doc.accessToken;
}

async function getTwitterHandle(identifier) {
  const doc = await findToken(identifier);
  return doc?.handle || 'unknown';
}

// Post a tweet with auto-refresh + single retry on 401
async function postTweet(identifier, text) {
  let token = await getValidAccessToken(identifier);

  const doPost = (bearer) =>
    axios.post(
      'https://api.x.com/2/tweets',
      { text },
      { headers: { Authorization: `Bearer ${bearer}` }, timeout: 15000 }
    );

  try {
    const r = await doPost(token);
    return r.data;
  } catch (err) {
    if (err.response?.status === 401) {
      token = await refreshAccessToken(identifier);
      const r2 = await doPost(token);
      return r2.data;
    }
    throw err;
  }
}

module.exports = { findToken, getValidAccessToken, refreshAccessToken, postTweet, getTwitterHandle };