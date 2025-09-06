// back/backend-node/routes/linkedinAuth.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const LinkedInToken = require('../models/LinkedInToken');
const User = require('../models/User');
const { requireAuth } = require('@clerk/express');
const { abs } = require('../config/url');  // ✅ only abs needed

const {
  LINKEDIN_CLIENT_ID,
  LINKEDIN_CLIENT_SECRET,
} = process.env;

const STATE_HMAC_SECRET = process.env.STATE_HMAC_SECRET || 'dev_state_secret';

// Unified base + redirect
// APP_URL is already imported as BASE from config/url
const LINKEDIN_REDIRECT_URI = abs('api/auth/linkedin/oauth2/callback/linkedin');

// --- HMAC state helpers ---
function signState(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', STATE_HMAC_SECRET)
    .update(data)
    .digest('base64url');
  return `${data}.${sig}`;
}
function verifyState(signed) {
  const [data, sig] = (signed || '').split('.');
  if (!data || !sig) return null;
  const expected = crypto.createHmac('sha256', STATE_HMAC_SECRET)
    .update(data)
    .digest('base64url');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try { return JSON.parse(Buffer.from(data, 'base64url').toString()); } catch { return null; }
}

/**
 * START: /oauth2/start/linkedin
 * Kicks off OAuth by redirecting to LinkedIn's authorization page.
 * Does NOT require Clerk cookies (identity is carried via signed `state`).
 */
router.get('/oauth2/start/linkedin', async (req, res) => {
  try {
    // Try Clerk first (if available), then fallbacks
    let userId = req.auth?.().userId;
    let email  = req.auth?.().email;

    if (!userId && req.headers['x-clerk-user-id'])   userId = String(req.headers['x-clerk-user-id']);
    if (!email  && req.headers['x-clerk-user-email']) email = String(req.headers['x-clerk-user-email']);
    if (!userId && req.query.userId)                  userId = String(req.query.userId);
    if (!email  && req.query.email)                   email  = String(req.query.email);

    // If we have a Clerk id but no email, try DB
    if (!email && userId) {
      try {
        const u = await User.findOne({ clerkUserId: userId });
        if (u?.email) email = u.email;
      } catch {}
    }

    const state = signState({ userId: userId || null, email: email || null, ts: Date.now() });

    const scope = 'openid profile w_member_social email';
    const authUrl =
      'https://www.linkedin.com/oauth/v2/authorization?' +
      `response_type=code&` +
      `client_id=${encodeURIComponent(LINKEDIN_CLIENT_ID)}&` +
      `redirect_uri=${encodeURIComponent(LINKEDIN_REDIRECT_URI)}&` +
      `scope=${encodeURIComponent(scope)}&` +
      `state=${encodeURIComponent(state)}`;

    return res.redirect(authUrl);
  } catch (error) {
    console.error('[LinkedIn] start error:', error);
    return res.status(500).json({ error: 'LinkedIn authentication failed' });
  }
});

/**
 * CALLBACK: /oauth2/callback/linkedin
 * This must match the app's authorized redirect URL.
 */
router.get('/oauth2/callback/linkedin', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      console.error('[LinkedIn OAuth] error:', error, req.query.error_description);
      return res.redirect(abs('app?error=linkedin_auth_failed'));
    }
    if (!code || !state) {
      console.error('[LinkedIn OAuth] missing code or state');
      return res.redirect(abs('app?error=linkedin_auth_failed'));
    }

    const userInfo = verifyState(state);
    if (!userInfo?.userId) {
      console.error('[LinkedIn OAuth] invalid/tampered state');
      return res.redirect(abs('app?error=linkedin_auth_failed'));
    }
    const { userId, email } = userInfo;

    // Exchange code -> access token
    const tokenResp = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: LINKEDIN_CLIENT_ID,
        client_secret: LINKEDIN_CLIENT_SECRET,
        redirect_uri: LINKEDIN_REDIRECT_URI,
      }),
    });
    const tokenData = await tokenResp.json();
    if (!tokenResp.ok || !tokenData.access_token) {
      console.error('[LinkedIn OAuth] token exchange failed:', tokenData);
      return res.redirect(abs('app?error=linkedin_auth_failed'));
    }

    // Try OpenID Connect userinfo
    let profile = {};
    try {
      const me = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (me.ok) profile = await me.json();
    } catch {}

    const linkedinUserId =
      profile.id || profile.sub || `li_${Date.now()}`;
    const firstName = profile.firstName || profile.given_name || null;
    const lastName  = profile.lastName  || profile.family_name || null;

    // Persist
    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + Number(tokenData.expires_in) * 1000)
      : undefined;

    const doc = await LinkedInToken.findOneAndUpdate(
      { linkedinUserId },
      {
        clerkUserId: userId || null,
        userId: userId || null,
        email: email || null,
        linkedinUserId,
        firstName,
        lastName,
        accessToken: tokenData.access_token,
        expiresAt,
        scope: tokenData.scope || 'openid profile w_member_social email',
        provider: 'linkedin',
        isActive: true,
        updatedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    console.log('[LinkedIn OAuth] saved token doc:', doc?._id);
    return res.redirect(abs('app?connected=linkedin'));
  } catch (e) {
    console.error('[LinkedIn OAuth] callback error:', e);
    return res.redirect(abs('app?error=linkedin_auth_failed'));
  }
});

// --- Uniform platform management endpoints ---

// Status
router.get('/status', requireAuth(), async (req, res) => {
  try {
    const clerkUserId = req.auth().userId;
    const token = await LinkedInToken.findOne({ clerkUserId });
    if (!token || !token.accessToken) return res.json({ connected: false });
    return res.json({
      connected: true,
      oauthToken: token.accessToken,
      linkedinUserId: token.linkedinUserId,
      firstName: token.firstName || null,
      lastName: token.lastName || null,
      handle: token.handle || null,
      isActive: token.isActive ?? true
    });
  } catch (e) {
    console.error('[LinkedIn] status error:', e.message);
    res.status(500).json({ error: 'Failed to get LinkedIn status' });
  }
});

// Disconnect
router.delete('/disconnect', requireAuth(), async (req, res) => {
  try {
    const clerkUserId = req.auth().userId;
    const existing = await LinkedInToken.findOne({ clerkUserId });
    if (!existing) return res.status(404).json({ error: 'LinkedIn account not found' });
    await LinkedInToken.deleteOne({ _id: existing._id });
    return res.json({ success: true, message: 'LinkedIn account disconnected successfully' });
  } catch (e) {
    console.error('[LinkedIn] disconnect error:', e.message);
    res.status(500).json({ error: 'Failed to disconnect LinkedIn account' });
  }
});

module.exports = router;