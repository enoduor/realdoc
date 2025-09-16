// routes/googleAuth.js
// npm i googleapis
const { google } = require('googleapis');
const express = require('express');
const crypto = require('crypto');
const { requireAuth } = require('@clerk/express');
const router = express.Router();
const User = require('../models/User');

// ⬇️ Use the correct exports from your base URL helper
//   utils/urlBase.js should export: { BASE, abs }
const { BASE: APP_URL, abs } = require('../config/url');

const STATE_HMAC_SECRET = process.env.STATE_HMAC_SECRET || 'change-me';

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_SCOPES
} = process.env;

// Construct redirect URI dynamically like LinkedIn does
const GOOGLE_REDIRECT_URI = abs('api/auth/youtube/oauth2/callback/google');

const oauth2 = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
);

function signState(obj) {
  const data = Buffer.from(JSON.stringify(obj)).toString('base64url');
  const sig = crypto.createHmac('sha256', STATE_HMAC_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}
function verifyState(signed) {
  const [data, sig] = (signed || '').split('.');
  if (!data || !sig) return null;
  const expected = crypto.createHmac('sha256', STATE_HMAC_SECRET).update(data).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try { return JSON.parse(Buffer.from(data, 'base64url').toString()); } catch { return null; }
}

// Start
router.get('/oauth2/start/google', async (req, res) => {
  try {
    console.log('🔍 [Google OAuth] Starting OAuth flow...');
    console.log('🔍 [Google OAuth] Redirect URI:', GOOGLE_REDIRECT_URI);
    
    let userId = req.auth?.().userId;
    let email  = req.auth?.().email;

    if (!userId && req.headers['x-clerk-user-id']) userId = String(req.headers['x-clerk-user-id']);
    if (!email  && req.headers['x-clerk-user-email']) email  = String(req.headers['x-clerk-user-email']);
    if (!userId && req.query.userId) userId = String(req.query.userId);
    if (!email  && req.query.email)  email  = String(req.query.email);

    if (!email && userId) {
      try {
        const u = await User.findOne({ clerkUserId: userId });
        if (u?.email) email = u.email;
      } catch {}
    }

    console.log('🔍 [Google OAuth] User ID:', userId, 'Email:', email);

    const state = signState({ userId: userId || null, email: email || null, ts: Date.now() });

    const url = oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: (GOOGLE_SCOPES || 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email').split(' '),
      state
    });

    console.log('🔍 [Google OAuth] Generated URL:', url);
    return res.redirect(url);
  } catch (error) {
    console.error('❌ [Google OAuth] Error:', error);
    return res.status(500).json({ error: 'Google authentication failed' });
  }
});

// Callback
router.get('/oauth2/callback/google', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (req.query.error) return res.redirect(abs('app?error=google_auth_failed'));
    if (!code || !state) return res.redirect(abs('app?error=google_auth_failed'));

    const userInfo = verifyState(state);
    if (!userInfo) return res.redirect(abs('app?error=google_auth_failed'));

    const { tokens } = await oauth2.getToken(code);

    const auth = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
    auth.setCredentials({ access_token: tokens.access_token });

    const yt = google.youtube({ version: 'v3', auth });
    const channelResponse = await yt.channels.list({ part: ['snippet', 'contentDetails', 'statistics'], mine: true });
    const channel = channelResponse.data.items?.[0];
    if (!channel) return res.redirect(abs('app?error=google_auth_failed'));

    const YouTubeToken = require('../models/YouTubeToken');
    await YouTubeToken.findOneAndUpdate(
      { channelId: channel.id },
      {
        clerkUserId: userInfo.userId || null,
        email: userInfo.email || null,
        channelId: channel.id,
        channelTitle: channel.snippet.title,
        channelDescription: channel.snippet.description,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + 3600000),
        scope: tokens.scope,
        provider: 'youtube',
        isActive: true,
        updatedAt: new Date()
      },
      { upsert: true, new: true }
    );

    return res.redirect(abs('app?connected=youtube'));
  } catch {
    return res.redirect(abs('app?error=google_auth_failed'));
  }
});

// Helper: returns a URL your frontend can open
router.get('/oauth/start/youtube', async (req, res) => {
  try {
    let userId = req.auth?.().userId;
    let email  = req.auth?.().email;
    if (!userId && req.headers['x-clerk-user-id']) userId = String(req.headers['x-clerk-user-id']);
    if (!email  && req.headers['x-clerk-user-email']) email  = String(req.headers['x-clerk-user-email']);
    if (!userId && req.query.userId) userId = String(req.query.userId);
    if (!email  && req.query.email)  email  = String(req.query.email);

    const url = abs(`api/auth/youtube/oauth2/start/google?userId=${encodeURIComponent(userId || '')}&email=${encodeURIComponent(email || '')}`);
    res.json({ url });
  } catch {
    res.status(500).json({ error: 'Failed to start YouTube OAuth' });
  }
});

// Status
router.get('/status', requireAuth(), async (req, res) => {
  try {
    const clerkUserId = req.auth().userId;
    const YouTubeToken = require('../models/YouTubeToken');
    const token = await YouTubeToken.findOne({ clerkUserId });
    if (!token || !token.accessToken) return res.json({ connected: false });

    return res.json({
      connected: true,
      oauthToken: token.accessToken,
      youtubeUserId: token.channelId || null,
      firstName: token.firstName || null,
      lastName: token.lastName || null,
      handle: token.channelTitle || null,
      isActive: token.isActive ?? true
    });
  } catch {
    res.status(500).json({ error: 'Failed to get YouTube status' });
  }
});

// Disconnect
router.delete('/disconnect', requireAuth(), async (req, res) => {
  try {
    const clerkUserId = req.auth().userId;
    const YouTubeToken = require('../models/YouTubeToken');
    await YouTubeToken.findOneAndDelete({ clerkUserId });
    res.json({ success: true, message: 'YouTube disconnected successfully' });
  } catch {
    res.status(500).json({ error: 'Failed to disconnect YouTube' });
  }
});

module.exports = router;