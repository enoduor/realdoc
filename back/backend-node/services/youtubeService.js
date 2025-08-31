/* eslint-disable no-console */
const { google } = require('googleapis');
const axios = require('axios');
const YouTubeToken = require('../models/YouTubeToken');

function getOAuthClient() {
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
async function findToken(identifier = {}) {
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
async function getRefreshTokenFromIdentifier(identifier) {
  const doc = await findToken(identifier);
  if (!doc) throw new Error('YouTube not connected for this user');
  return doc.refreshToken;
}

async function getYouTubeClient(refreshToken) {
  if (!refreshToken) throw new Error('Missing user refresh token');
  const auth = getOAuthClient();
  auth.setCredentials({ refresh_token: refreshToken });
  return google.youtube({ version: 'v3', auth });
}

/**
 * Validate YouTube credentials and get client
 * Follows the same pattern as other platforms: validate credentials at start
 */
async function validateYouTubeCredentials(refreshToken) {
  if (!refreshToken) {
    throw new Error('YouTube not connected for this user - missing refresh token');
  }
  
  try {
    const yt = await getYouTubeClient(refreshToken);
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

async function whoAmI(refreshToken) {
  const yt = await getYouTubeClient(refreshToken);
  const res = await yt.channels.list({
    part: ['snippet', 'contentDetails', 'statistics'],
    mine: true
  });
  return res.data;
}

/**
 * Posts a video to YouTube.
 * @param {Object} identifier  { clerkUserId } - same pattern as other platforms
 * @param {Readable|String} fileInput  Node Readable stream, or HTTPS URL to stream
 * @param {Object} meta  { title, description, tags?, privacyStatus? }
 */
async function postToYouTube(identifier, fileInput, meta = {}) {
  // ✅ CREDENTIAL CHECK AT THE START (consistent with other platforms)
  const refreshToken = await getRefreshTokenFromIdentifier(identifier);
  const yt = await validateYouTubeCredentials(refreshToken);
  
  const { title, description, tags = [], privacyStatus = 'unlisted' } = meta;

  // Support passing a URL (we stream it) or a Node stream
  let mediaBody = fileInput;
  if (typeof fileInput === 'string') {
    const resp = await axios.get(fileInput, { responseType: 'stream' });
    mediaBody = resp.data;
  }

  const res = await yt.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: { title, description, tags },
      status: { privacyStatus }
    },
    media: { body: mediaBody },
    // Optional: onUploadProgress available if using googleapis resumable; simple insert suffices for now.
  });

  // Return structured object like other platforms
  const videoId = res.data.id;
  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
  
  return {
    success: true,
    postId: videoId,
    url: youtubeUrl,
    message: 'Successfully published to YouTube'
  };
}

module.exports = { getYouTubeClient, validateYouTubeCredentials, whoAmI, postToYouTube, findToken, getRefreshTokenFromIdentifier };

// --- Uniform platform management endpoints (mounted via publisher or a new router if desired) ---
// For uniformity, we expose status/disconnect via a tiny router here to avoid duplicating clients.
const express = require('express');
const { requireAuth } = require('@clerk/express');
const youtubeRouter = express.Router();

// Status: connected if we have a refresh token in Clerk publicMetadata (frontend usually passes it) or env
youtubeRouter.get('/status', requireAuth(), async (req, res) => {
  try {
    const refreshToken = req.auth?.sessionClaims?.public_metadata?.youtubeRefreshToken || process.env.YT_TEST_REFRESH_TOKEN;
    if (!refreshToken) return res.json({ connected: false });
    try {
      // Light probe to confirm credentials (optional): list channels
      await whoAmI(refreshToken);
      return res.json({ connected: true });
    } catch {
      return res.json({ connected: false });
    }
  } catch (e) {
    console.error('[YouTube] Status error:', e.message);
    res.status(500).json({ error: 'Failed to get YouTube status' });
  }
});

// Disconnect: instruct client to clear user metadata or remove stored token server-side if you persist it
youtubeRouter.delete('/disconnect', requireAuth(), async (req, res) => {
  try {
    // This app doesn’t persist YouTube refresh tokens server-side.
    // If stored in Clerk publicMetadata, the frontend should clear it; here we just acknowledge.
    return res.json({ success: true, message: 'YouTube token should be cleared from user metadata' });
  } catch (e) {
    console.error('[YouTube] Disconnect error:', e.message);
    res.status(500).json({ error: 'Failed to disconnect YouTube account' });
  }
});

module.exports.youtubeRouter = youtubeRouter;

