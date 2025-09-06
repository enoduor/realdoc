/* eslint-disable no-console */
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { requireAuth } = require('@clerk/express');
const InstagramToken = require('../models/InstagramToken');
const User = require('../models/User');
const { abs } = require('../config/url');  // ✅ only abs needed

const router = express.Router();

const FACEBOOK_API_URL = process.env.FACEBOOK_API_URL || 'https://graph.facebook.com/v18.0';
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;
const STATE_HMAC_SECRET = process.env.STATE_HMAC_SECRET || 'dev_state_secret';

// APP_URL is already imported as BASE from config/url
const IG_REDIRECT_URI = abs('api/auth/instagram/oauth/callback/instagram');

function signState(obj) {
  const payload = Buffer.from(JSON.stringify(obj)).toString('base64url');
  const sig = crypto.createHmac('sha256', STATE_HMAC_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}
function verifyState(state) {
  const [payload, sig] = String(state || '').split('.');
  if (!payload || !sig) throw new Error('Invalid state');
  const expected = crypto.createHmac('sha256', STATE_HMAC_SECRET).update(payload).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) throw new Error('State signature mismatch');
  return JSON.parse(Buffer.from(payload, 'base64url').toString());
}

// Start
router.get('/oauth/start/instagram', async (req, res) => {
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

    const scopes = [
      'public_profile',
      'email',
      'pages_show_list',
      'pages_read_engagement',
      'instagram_basic',
      'instagram_content_publish'
    ].join(',');

    const authUrl = `https://www.facebook.com/v18.0/dialog/oauth` +
      `?client_id=${FACEBOOK_APP_ID}` +
      `&redirect_uri=${encodeURIComponent(IG_REDIRECT_URI)}` +
      `&state=${encodeURIComponent(state)}` +
      `&scope=${encodeURIComponent(scopes)}`;

    return res.redirect(authUrl);
  } catch (e) {
    return res.status(500).json({ error: 'Failed to start Instagram OAuth' });
  }
});

// Callback
router.get('/oauth/callback/instagram', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    if (error) return res.redirect(abs('app?error=instagram_auth_failed'));
    if (!code || !state) return res.redirect(abs('app?error=instagram_auth_failed'));

    const decoded = verifyState(state);
    const userId = decoded.userId;
    const email  = decoded.email || null;

    const tokenResp = await axios.get(`${FACEBOOK_API_URL}/oauth/access_token`, {
      params: { client_id: FACEBOOK_APP_ID, client_secret: FACEBOOK_APP_SECRET, redirect_uri: IG_REDIRECT_URI, code },
      timeout: 15000,
    });
    const shortLived = tokenResp.data?.access_token;
    if (!shortLived) throw new Error('No short-lived token');

    const longResp = await axios.get(`${FACEBOOK_API_URL}/oauth/access_token`, {
      params: { grant_type: 'fb_exchange_token', client_id: FACEBOOK_APP_ID, client_secret: FACEBOOK_APP_SECRET, fb_exchange_token: shortLived },
      timeout: 15000,
    });
    const longLived = longResp.data?.access_token;
    if (!longLived) throw new Error('No long-lived token');

    // Resolve IG business account (optional)
    let pageId = null, pageName = null, igUserId = null, name = null;
    try {
      const pagesResp = await axios.get(`${FACEBOOK_API_URL}/me/accounts`, {
        params: { access_token: longLived, fields: 'id,name' }, timeout: 15000,
      });
      const firstPage = pagesResp.data?.data?.[0];
      if (firstPage?.id) {
        pageId = firstPage.id; pageName = firstPage.name;
        const igResp = await axios.get(`${FACEBOOK_API_URL}/${pageId}`, {
          params: { access_token: longLived, fields: 'instagram_business_account{name}' }, timeout: 15000,
        });
        igUserId = igResp.data?.instagram_business_account?.id || null;
        name = igResp.data?.instagram_business_account?.name || pageName || null;
      }
    } catch {}

    await InstagramToken.findOneAndUpdate(
      { clerkUserId: userId },
      { $set: {
          clerkUserId: userId,
          userId: userId,
          email,
          accessToken: longLived,
          isActive: true,
          pageId, pageName, igUserId, name,
        } },
      { upsert: true, new: true }
    );

    return res.redirect(abs('app?connected=instagram'));
  } catch (e) {
    return res.redirect(abs('app?error=instagram_auth_failed'));
  }
});

// Status
router.get('/status', requireAuth(), async (req, res) => {
  try {
    const clerkUserId = req.auth().userId;
    const token = await InstagramToken.findOne({ clerkUserId, isActive: true });
    if (!token) return res.json({ connected: false });
    return res.json({
      connected: true,
      oauthToken: token.accessToken,
      instagramUserId: token.igUserId || null,
      firstName: token.firstName || null,
      lastName: token.lastName || null,
      handle: token.handle || null,
      isActive: token.isActive ?? true
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to get Instagram status' });
  }
});

// Disconnect
router.delete('/disconnect', requireAuth(), async (req, res) => {
  try {
    const clerkUserId = req.auth().userId;
    const result = await InstagramToken.findOneAndUpdate(
      { clerkUserId, isActive: true },
      { isActive: false },
      { new: true }
    );
    if (!result) return res.status(404).json({ error: 'Instagram account not found' });
    return res.json({ success: true, message: 'Instagram account disconnected successfully' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to disconnect Instagram account' });
  }
});

module.exports = router;