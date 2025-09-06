const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const TikTokToken = require('../models/TikTokToken');
const { exchangeCodeForToken } = require('../services/tiktokService');
const { requireAuth } = require('@clerk/express');
const User = require('../models/User');
const { abs } = require('../config/url');  // ✅ only abs needed

// Helpers
const STATE_HMAC_SECRET = process.env.STATE_HMAC_SECRET || 'change-me';
const TIKTOK_REDIRECT_URI = abs('api/auth/tiktok/callback');  // stays the same

function signState(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
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
router.get('/connect', async (req, res) => {
  try {
    let userId = req.auth?.().userId;
    let email  = req.auth?.().email;

    if (!userId && req.headers['x-clerk-user-id']) userId = String(req.headers['x-clerk-user-id']);
    if (!email  && req.headers['x-clerk-user-email']) email  = String(req.headers['x-clerk-user-email']);
    if (!userId && req.query.userId) userId = String(req.query.userId);
    if (!email  && req.query.email)  email  = String(req.query.email);

    if (!email && userId) {
      try { const u = await User.findOne({ clerkUserId: userId }); if (u?.email) email = u.email; } catch {}
    }

    const state = signState({ userId: userId || null, email: email || null, ts: Date.now() });
    const params = new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY,
      scope: 'user.info.basic video.upload video.list',
      response_type: 'code',
      redirect_uri: TIKTOK_REDIRECT_URI,
      state
    });

    return res.redirect(`https://www.tiktok.com/auth/authorize/?${params.toString()}`);
  } catch (error) {
    return res.redirect(abs('app?error=tiktok_auth_failed'));
  }
});

// Callback
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) return res.redirect(abs('app?error=tiktok_auth_failed'));

    const userInfo = verifyState(state);
    if (!userInfo) return res.redirect(abs('app?error=tiktok_auth_failed'));

    const tokenResp = await exchangeCodeForToken(code);

    let clerkUserId = null;
    try { const user = await User.findOne({ _id: userInfo.userId }); clerkUserId = user?.clerkUserId || null; } catch {}

    await TikTokToken.findOneAndUpdate(
      { $or: [{ clerkUserId }, { userId: userInfo.userId }], provider: 'tiktok' },
      {
        clerkUserId,
        userId: userInfo.userId,
        email: userInfo.email || null,
        accessToken: tokenResp.access_token,
        refreshToken: tokenResp.refresh_token,
        tokenType: tokenResp.token_type || 'Bearer',
        scope: tokenResp.scope,
        expiresAt: tokenResp.expiresAt
      },
      { upsert: true, new: true }
    );

    return res.redirect(abs('app?connected=tiktok'));
  } catch (e) {
    return res.redirect(abs('app?error=tiktok_auth_failed'));
  }
});

// Status
router.get('/status', async (req, res) => {
  try {
    let clerkUserId = req.auth?.().userId;
    if (!clerkUserId && req.headers['x-clerk-user-id']) clerkUserId = String(req.headers['x-clerk-user-id']);
    if (!clerkUserId && req.query.userId) clerkUserId = String(req.query.userId);

    if (!clerkUserId) return res.status(401).json({ error: 'User not authenticated' });

    const token = await TikTokToken.findOne({ clerkUserId });
    if (!token || !token.accessToken) return res.json({ connected: false });

    return res.json({
      connected: true,
      oauthToken: token.accessToken,
      tiktokUserId: token.tiktokUserOpenId || null,
      firstName: token.firstName || null,
      lastName: token.lastName || null,
      handle: token.username || null,
      isActive: token.isActive ?? true
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to get TikTok status' });
  }
});

// Disconnect
router.delete('/disconnect', async (req, res) => {
  try {
    let clerkUserId = req.auth?.().userId;
    if (!clerkUserId && req.headers['x-clerk-user-id']) clerkUserId = String(req.headers['x-clerk-user-id']);
    if (!clerkUserId && req.query.userId) clerkUserId = String(req.query.userId);

    if (!clerkUserId) return res.status(401).json({ error: 'User not authenticated' });

    const user = await User.findOne({ clerkUserId });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const existing = await TikTokToken.findOne({ userId: user._id });
    if (!existing) return res.status(404).json({ error: 'TikTok account not found' });

    await TikTokToken.deleteOne({ _id: existing._id });
    return res.json({ success: true, message: 'TikTok account disconnected successfully' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to disconnect TikTok account' });
  }
});

module.exports = router;