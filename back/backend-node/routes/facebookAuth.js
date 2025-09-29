// routes/facebookAuth.js
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { requireAuth } = require('@clerk/express');
const FacebookToken = require('../models/FacebookToken');
const User = require('../models/User');
const { abs } = require('../config/url');  // ✅ only import abs()

const router = express.Router();

const FACEBOOK_API_URL = process.env.FACEBOOK_API_URL || 'https://graph.facebook.com/v18.0';
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;
const STATE_HMAC_SECRET = process.env.STATE_HMAC_SECRET || 'change-me';

// APP_URL is already imported as BASE from config/url
const FACEBOOK_REDIRECT_URI = abs('api/auth/facebook/callback');

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
router.get('/oauth/start/facebook', async (req, res) => {
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

    const authUrl =
      `https://www.facebook.com/v18.0/dialog/oauth` +
      `?client_id=${FACEBOOK_APP_ID}` +
      `&redirect_uri=${encodeURIComponent(FACEBOOK_REDIRECT_URI)}` +
      `&scope=${encodeURIComponent('public_profile,email,pages_manage_posts,pages_read_engagement,pages_show_list')}` +
      `&response_type=code` +
      `&state=${encodeURIComponent(state)}`;

    return res.redirect(authUrl);
  } catch (error) {
    return res.redirect(abs('app?error=facebook_auth_failed'));
  }
});

// Callback
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) return res.redirect(abs('app?error=facebook_auth_failed'));

    const userInfo = verifyState(state);
    if (!userInfo?.userId) return res.redirect(abs('app?error=facebook_auth_failed'));

    const tokenResponse = await axios.get(`${FACEBOOK_API_URL}/oauth/access_token`, {
      params: {
        client_id: FACEBOOK_APP_ID,
        client_secret: FACEBOOK_APP_SECRET,
        redirect_uri: FACEBOOK_REDIRECT_URI,
        code
      },
      timeout: 15000
    });

    const { access_token } = tokenResponse.data;
    if (!access_token) throw new Error('No access token from Facebook');

    const exchangeResp = await axios.get(`${FACEBOOK_API_URL}/oauth/access_token`, {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: FACEBOOK_APP_ID,
        client_secret: FACEBOOK_APP_SECRET,
        fb_exchange_token: access_token,
      },
      timeout: 15000,
    });
    const longLived = exchangeResp.data?.access_token || access_token;
    const ttlSecs = exchangeResp.data?.expires_in;
    const expiresAt = ttlSecs ? new Date(Date.now() + ttlSecs * 1000) : undefined;

    const userResponse = await axios.get(`${FACEBOOK_API_URL}/me`, {
      params: { access_token: longLived, fields: 'id,name,email' }
    });
    const facebookUser = userResponse.data;

    let pageId, pageName, pageAccessToken;
    try {
      const pagesResp = await axios.get(`${FACEBOOK_API_URL}/me/accounts`, {
        params: { access_token: longLived, fields: 'id,name,access_token' },
        timeout: 15000,
      });
      const firstPage = pagesResp.data?.data?.[0];
      if (firstPage?.access_token) {
        pageId = firstPage.id;
        pageName = firstPage.name;
        pageAccessToken = firstPage.access_token;
      }
    } catch {}

    await FacebookToken.findOneAndUpdate(
      { clerkUserId: userInfo.userId, provider: 'facebook' },
      {
        clerkUserId: userInfo.userId,
        userId: userInfo.userId,
        email: userInfo.email || null,
        facebookUserId: facebookUser.id,
        accessToken: longLived,
        name: facebookUser.name,
        isActive: true,
        expiresAt,
        provider: 'facebook',
        ...(pageId && { pageId, pageName, pageAccessToken }),
      },
      { upsert: true, new: true }
    );

    return res.redirect(abs('app?connected=facebook'));
  } catch (error) {
    return res.redirect(abs('app?error=facebook_auth_failed'));
  }
});

// Disconnect
router.delete('/disconnect', requireAuth(), async (req, res) => {
  try {
    const clerkUserId = req.auth().userId;
    const result = await FacebookToken.findOneAndUpdate(
      { clerkUserId, isActive: true },
      { isActive: false },
      { new: true }
    );
    if (!result) return res.status(404).json({ error: 'Facebook account not found' });
    res.json({ message: 'Facebook account disconnected successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to disconnect Facebook account' });
  }
});

// Status
router.get('/status', requireAuth(), async (req, res) => {
  try {
    const clerkUserId = req.auth().userId;
    const token = await FacebookToken.findOne({ clerkUserId, isActive: true });
    if (!token) return res.json({ connected: false });
    res.json({
      connected: true,
      oauthToken: token.accessToken,
      facebookUserId: token.facebookUserId,
      firstName: token.firstName || null,
      lastName: token.lastName || null,
      handle: token.handle || null,
      isActive: token.isActive ?? true
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get Facebook status' });
  }
});

module.exports = router;