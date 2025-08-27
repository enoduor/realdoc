/* eslint-disable no-console */
const { TwitterApi } = require('twitter-api-v2');
const TwitterToken = require('../models/TwitterToken');

const {
  TWITTER_API_KEY,
  TWITTER_API_SECRET,
} = process.env;

// Rate limit management removed for testing

/**
 * Find a token doc by { twitterUserId }, { userId }, or { email }
 */
async function findToken(identifier = {}) {
  if (identifier.twitterUserId) {
    return TwitterToken.findOne({ twitterUserId: identifier.twitterUserId });
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
function getUserClientFromDoc(doc) {
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
async function getUserClient(identifier) {
  const doc = await findToken(identifier);
  if (!doc) throw new Error('Twitter not connected for this user');
  return getUserClientFromDoc(doc);
}

/**
 * Get the user handle (username) with improved caching.
 * Only makes API call if handle is not cached or cache is stale.
 */
async function getTwitterHandle(identifier) {
  const doc = await findToken(identifier);
  if (!doc) throw new Error('Twitter not connected for this user');

  const handleCacheAge = doc.handleUpdatedAt ? Date.now() - new Date(doc.handleUpdatedAt).getTime() : Infinity;
  const CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

  if (doc.handle && handleCacheAge < CACHE_MAX_AGE) {
    console.log('[Twitter] Using cached handle (age:', Math.round(handleCacheAge / 1000 / 60), 'min):', doc.handle);
    return doc.handle;
  }

  console.log('[Twitter] Handle cache stale/missing, making API call to get user info...');
  const client = getUserClientFromDoc(doc);

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
 * Upload media (image or video) to Twitter.
 * - Accepts Buffer or URL string.
 * - Downloads URL to Buffer if needed.
 * - Detects type from Buffer magic bytes.
 */
async function uploadMedia(identifier, mediaUrlOrBuffer, explicitType = null) {
  const client = await getUserClient(identifier);

  let input;
  
  // Handle URL string by downloading to Buffer
  if (typeof mediaUrlOrBuffer === 'string') {
    console.log('[Twitter] Downloading media from URL:', mediaUrlOrBuffer);
    try {
      const axios = require('axios');
      const response = await axios.get(mediaUrlOrBuffer, { responseType: 'arraybuffer' });
      input = Buffer.from(response.data);
      console.log('[Twitter] Downloaded media, size:', input.length, 'bytes');
    } catch (error) {
      console.error('[Twitter] Failed to download media from URL:', error.message);
      throw new Error('Failed to download media from URL');
    }
  } else if (Buffer.isBuffer(mediaUrlOrBuffer)) {
    input = mediaUrlOrBuffer;
  } else {
    throw new Error('uploadMedia requires a Buffer or URL string input.');
  }

  // Sniff Buffer type
  const sniffBufferType = (buf) => {
    if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
    if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'IMAGE'; // JPEG
    if (buf.slice(0,8).compare(Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A])) === 0) return 'IMAGE'; // PNG
    if (buf.slice(0,3).toString() === 'GIF') return 'IMAGE_GIF'; // GIF
    if (buf.slice(4,8).toString() === 'ftyp') return 'VIDEO'; // MP4/ISO base
    return null;
  };

  let detectedType = (explicitType || sniffBufferType(input) || 'VIDEO').toString().toUpperCase();
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
 * Post a Tweet (v2), with optional media (Buffer or URL).
 * Trims text to 280 characters.
 */
async function postTweet(identifier, text, mediaUrlOrBuffer = null) {
  const client = await getUserClient(identifier);
  const payload = { text: String(text || '').trim().slice(0, 280) };

  if (mediaUrlOrBuffer) {
    try {
      console.log('[Twitter] Attempting to upload media and post tweet...');
      const mediaId = await uploadMedia(identifier, mediaUrlOrBuffer);
      console.log('[Twitter] Media uploaded successfully, posting tweet with media...');

      const resp = await client.v2.tweet({
        ...payload,
        media: { media_ids: [mediaId] },
      });
      console.log('[TW] v2.tweet (with media) success');

      console.log('[Twitter] Tweet with media posted successfully');
      
      // Return structured object like LinkedIn
      const tweetId = resp?.data?.id;
      const twitterUrl = `https://twitter.com/i/status/${tweetId}`;
      
      return {
        success: true,
        postId: tweetId,
        url: twitterUrl,
        message: 'Successfully published to Twitter'
      };
    } catch (error) {
      console.error('[TW ERR] v2.tweet (with media) failed:', error.code, error.message);
      console.log('[Twitter] Attempting text-only tweet as fallback...');
      const resp = await client.v2.tweet(payload);
      
      // Return structured object for fallback too
      const tweetId = resp?.data?.id;
      const twitterUrl = `https://twitter.com/i/status/${tweetId}`;
      
      return {
        success: true,
        postId: tweetId,
        url: twitterUrl,
        message: 'Successfully published to Twitter (text-only)'
      };
    }
  }

  console.log('[Twitter] Posting text-only tweet...');
  try {
    const resp = await client.v2.tweet(payload);
    console.log('[TW] v2.tweet (text-only) success');
    
    // Return structured object like LinkedIn
    const tweetId = resp?.data?.id;
    const twitterUrl = `https://twitter.com/i/status/${tweetId}`;
    
    return {
      success: true,
      postId: tweetId,
      url: twitterUrl,
      message: 'Successfully published to Twitter'
    };
  } catch (error) {
    console.error('[TW ERR] v2.tweet (text-only) failed:', error.code, error.message);
    throw error;
  }
}

module.exports = {
  findToken,
  getTwitterHandle,
  uploadMedia,
  postTweet,
};