/* back/backend-node/routes/tiktokAuth.js */
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const TikTokToken = require('../models/TikTokToken');
const { exchangeCodeForToken } = require('../services/tiktokService');
const { requireAuth } = require('@clerk/express'); // ✅ use Clerk like the rest
const User = require('../models/User');

// Simple HMAC signer to protect `state`
function signState(payload) {
  const secret = process.env.STATE_HMAC_SECRET || 'change-me';
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}
function verifyState(signed) {
  const secret = process.env.STATE_HMAC_SECRET || 'change-me';
  const [data, sig] = (signed || '').split('.');
  if (!data || !sig) return null;
  const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try { return JSON.parse(Buffer.from(data, 'base64url').toString()); } catch { return null; }
}

// Step A: Redirect user to TikTok OAuth authorize URL
router.get('/connect', async (req, res) => {
  // For testing without auth, use a test user ID
  const userId = 'test-user-id';

  const state = signState({
    userId, // legacy
    ts: Date.now()
  });

  const params = new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY,
    scope: 'user.info.basic video.upload video.list',
    response_type: 'code',
    redirect_uri: process.env.TIKTOK_REDIRECT_URI, // MUST exactly match TikTok app settings
    state
  });

  // For sandbox testing, use the sandbox authorization URL
  const authUrl = `https://www.tiktok.com/auth/authorize/?${params.toString()}`;
  return res.redirect(authUrl);
});

// Step B: OAuth callback (⚠️ DO NOT protect with auth middleware)
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) throw new Error('Missing code/state');

    // Verify state & recover userId set in /connect
    const decoded = verifyState(state);
    if (!decoded) throw new Error('Invalid state');

    // Exchange authorization code for tokens
    const tokenResp = await exchangeCodeForToken(code);

    // Persist tokens for this user
    // Prefer Clerk user ID if available from session linkage
    let clerkUserId = null;
    try {
      const user = await User.findOne({ _id: decoded.userId });
      clerkUserId = user?.clerkUserId || null;
    } catch {}

    await TikTokToken.findOneAndUpdate(
      { $or: [ { clerkUserId }, { userId: decoded.userId } ], provider: 'tiktok' },
      {
        clerkUserId,
        accessToken: tokenResp.access_token,
        refreshToken: tokenResp.refresh_token,
        tokenType: tokenResp.token_type || 'Bearer',
        scope: tokenResp.scope,
        expiresAt: tokenResp.expiresAt
      },
      { upsert: true, new: true }
    );

    // Redirect back to your frontend
    return res.redirect(`${process.env.APP_URL}/integrations?connected=tiktok`);
  } catch (e) {
    console.error('TikTok callback error:', e?.response?.data || e);
    return res.redirect(`${process.env.APP_URL}/integrations?error=tiktok_auth_failed`);
  }
});

module.exports = router;

// --- Uniform platform management endpoints ---

// Status: is TikTok connected for this user?
router.get('/status', requireAuth(), async (req, res) => {
  try {
    const clerkUserId = req.auth.userId;
    const user = await User.findOne({ clerkUserId });
    if (!user) return res.json({ connected: false });
    const token = await TikTokToken.findOne({ userId: user._id });
    if (!token || !token.accessToken) return res.json({ connected: false });
    return res.json({
      connected: true,
      tiktokUserOpenId: token.tiktokUserOpenId || null,
      username: token.username || null,
    });
  } catch (e) {
    console.error('[TikTok] Status error:', e.message);
    res.status(500).json({ error: 'Failed to get TikTok status' });
  }
});

// Disconnect: remove stored TikTok tokens for this user
router.delete('/disconnect', requireAuth(), async (req, res) => {
  try {
    const clerkUserId = req.auth.userId;
    const user = await User.findOne({ clerkUserId });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const existing = await TikTokToken.findOne({ userId: user._id });
    if (!existing) return res.status(404).json({ error: 'TikTok account not found' });
    await TikTokToken.deleteOne({ _id: existing._id });
    return res.json({ success: true, message: 'TikTok account disconnected successfully' });
  } catch (e) {
    console.error('[TikTok] Disconnect error:', e.message);
    res.status(500).json({ error: 'Failed to disconnect TikTok account' });
  }
});