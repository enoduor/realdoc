/* eslint-disable no-console */
const axios = require('axios');
const { TwitterApi } = require('twitter-api-v2');
const TwitterToken = require('../models/TwitterToken');

const {
  TWITTER_CLIENT_ID,
  TWITTER_CLIENT_SECRET,
} = process.env;

/**
 * Find a token doc by { twitterUserId } or { userId }
 */
async function findToken(identifier = {}) {
  if (identifier.twitterUserId) {
    return TwitterToken.findOne({ twitterUserId: identifier.twitterUserId });
  }
  if (identifier.userId) {
    return TwitterToken.findOne({ userId: identifier.userId, twitterUserId: { $exists: true } });
  }
  return null;
}

/**
 * Returns a valid access token, refreshing if expired (or within 2 minutes).
 * Persists refreshed tokens back to Mongo in the same shape you showed.
 */
async function getValidAccessToken(identifier) {
  const doc = await findToken(identifier);
  if (!doc) throw new Error('Twitter not connected for this user');

  const now = Date.now();
  const expiresAtMs = new Date(doc.expiresAt).getTime();
  const needsRefresh = !expiresAtMs || (expiresAtMs - now) < 2 * 60 * 1000;

  if (!needsRefresh) return doc.accessToken;

  // Refresh using OAuth2 PKCE
  const client = new TwitterApi({
    clientId: TWITTER_CLIENT_ID,
    clientSecret: TWITTER_CLIENT_SECRET,
  });

  try {
    const { accessToken, refreshToken, expiresIn } = await client.refreshOAuth2Token(doc.refreshToken);
    const newExpiresAt = new Date(Date.now() + expiresIn * 1000);

    // Store back with identical schema/fields
    doc.accessToken = accessToken;
    doc.refreshToken = refreshToken || doc.refreshToken;
    doc.expiresAt = newExpiresAt;
    doc.tokenType = 'bearer';
    await doc.save();

    return accessToken;
  } catch (err) {
    console.error('[Twitter] Token refresh failed:', err.response?.data || err.message);
    throw new Error('Twitter token refresh failed');
  }
}

/**
 * Resolve @handle (and cache)
 */
async function getTwitterHandle(identifier) {
  const doc = await findToken(identifier);
  if (!doc) throw new Error('Twitter not connected for this user');
  if (doc.handle) return doc.handle;

  const accessToken = await getValidAccessToken(identifier);
  const userClient = new TwitterApi(accessToken);
  const me = await userClient.v2.me();
  const handle = me?.data?.username;

  if (handle) {
    doc.handle = handle;
    doc.name = me?.data?.name || doc.name;
    await doc.save();
  }
  return handle || null;
}

/**
 * Post a tweet (X API v2)
 */
async function postTweet(identifier, text) {
  const accessToken = await getValidAccessToken(identifier);
  const url = 'https://api.twitter.com/2/tweets';
  const payload = { text: String(text || '').trim() };

  const { data } = await axios.post(url, payload, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  });

  // data: { data: { id, text } }
  return data;
}

module.exports = {
  findToken,
  getValidAccessToken,
  getTwitterHandle,
  postTweet,
};