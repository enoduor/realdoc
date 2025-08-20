/* back/backend-node/routes/tiktokAuth.js */
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const TikTokToken = require('../models/TikTokToken');
const { exchangeCodeForToken } = require('../services/tiktokService');
const { requireAuth } = require('@clerk/express'); // ✅ use Clerk like the rest

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
    userId,
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
    if (!decoded?.userId) throw new Error('Invalid state');

    // Exchange authorization code for tokens
    const tokenResp = await exchangeCodeForToken(code);

    // Persist tokens for this user
    await TikTokToken.findOneAndUpdate(
      { userId: decoded.userId, provider: 'tiktok' },
      {
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