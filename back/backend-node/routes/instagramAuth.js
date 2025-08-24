/* eslint-disable no-console */
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { requireAuth } = require('@clerk/express');
const InstagramToken = require('../models/InstagramToken');
const User = require('../models/User');

const router = express.Router();

const FACEBOOK_API_URL = process.env.FACEBOOK_API_URL || 'https://graph.facebook.com/v18.0';
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;
const STATE_HMAC_SECRET = process.env.STATE_HMAC_SECRET || 'dev_state_secret';
const INSTAGRAM_REDIRECT_URI = process.env.INSTAGRAM_REDIRECT_URI || 'http://localhost:4001/api/instagram/oauth/callback/instagram';

const APP_URL = process.env.APP_URL || 'http://localhost:3000';

function signState(obj) {
  const payload = Buffer.from(JSON.stringify(obj)).toString('base64url');
  const sig = crypto.createHmac('sha256', STATE_HMAC_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}
function verifyState(state) {
  if (!state || typeof state !== 'string' || !state.includes('.')) throw new Error('Invalid state');
  const [payload, sig] = state.split('.');
  const expected = crypto.createHmac('sha256', STATE_HMAC_SECRET).update(payload).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) throw new Error('State signature mismatch');
  return JSON.parse(Buffer.from(payload, 'base64url').toString());
}

function getInstagramRedirectUri() {
  return process.env.INSTAGRAM_REDIRECT_URI || 'http://localhost:4001/api/instagram/oauth/callback/instagram';
}

// Secure start
router.get('/oauth/start/instagram', requireAuth(), async (req, res) => {
  try {
    const userId = req.auth.userId;
    const userDoc = await User.findOne({ clerkUserId: userId });
    const email = req.auth.email || userDoc?.email || null;
    const state = signState({ userId, email, ts: Date.now() });

    const scopes = [
      'public_profile',
      'email',
      'pages_show_list',
      'pages_read_engagement',
      'instagram_basic',
      'instagram_content_publish'
    ].join(',');

    const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${FACEBOOK_APP_ID}` +
      `&redirect_uri=${encodeURIComponent(getInstagramRedirectUri())}` +
      `&state=${encodeURIComponent(state)}` +
      `&scope=${encodeURIComponent(scopes)}`;

    console.log('[Instagram] Redirecting to OAuth:', authUrl);
    return res.redirect(authUrl);
  } catch (e) {
    console.error('[Instagram OAuth] start error:', e.message);
    return res.status(500).json({ error: 'Failed to start Instagram OAuth' });
  }
});

// Callback
router.get('/oauth/callback/instagram', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    if (error) {
      console.warn('[Instagram OAuth] Error:', error);
      return res.redirect(`${APP_URL}/app?error=instagram_auth_failed`);
    }
    if (!code || !state) {
      console.warn('[Instagram OAuth] No authorization code or state received');
      return res.redirect(`${APP_URL}/app?error=instagram_auth_failed`);
    }

    const decoded = verifyState(state);
    const userId = decoded.userId;
    const email = decoded.email || null;

    console.log('[Instagram] Exchanging code for token for user:', userId);
    const tokenResp = await axios.get(`${FACEBOOK_API_URL}/oauth/access_token`, {
      params: {
        client_id: FACEBOOK_APP_ID,
        client_secret: FACEBOOK_APP_SECRET,
        redirect_uri: getInstagramRedirectUri(),
        code,
      },
      timeout: 15000,
    });
    const shortLived = tokenResp.data?.access_token;
    if (!shortLived) throw new Error('No short-lived token');

    console.log('[Instagram] Got short-lived token, exchanging for long-lived token...');
    const longResp = await axios.get(`${FACEBOOK_API_URL}/oauth/access_token`, {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: FACEBOOK_APP_ID,
        client_secret: FACEBOOK_APP_SECRET,
        fb_exchange_token: shortLived,
      },
      timeout: 15000,
    });
    const longLived = longResp.data?.access_token;
    if (!longLived) throw new Error('No long-lived token');

    console.log('[Instagram] Fetching /me/accounts to resolve Page...');
    let pageId = null, pageName = null, igUserId = null, name = null;
    try {
      const pagesResp = await axios.get(`${FACEBOOK_API_URL}/me/accounts`, {
        params: { access_token: longLived, fields: 'id,name' },
        timeout: 15000,
      });
      const firstPage = pagesResp.data?.data?.[0];
      if (firstPage?.id) {
        pageId = firstPage.id; pageName = firstPage.name;
        const igResp = await axios.get(`${FACEBOOK_API_URL}/${pageId}`, {
          params: { access_token: longLived, fields: 'instagram_business_account{name}' },
          timeout: 15000,
        });
        igUserId = igResp.data?.instagram_business_account?.id || null;
        name = igResp.data?.instagram_business_account?.name || pageName || null;
      }
    } catch (e) {
      console.warn('[Instagram] Could not resolve IG business account:', e.response?.data || e.message);
    }

    const tokenData = {
      userId: userId || null,
      email: email || null,
      accessToken: longLived,
      isActive: true,
      pageId, pageName, igUserId, name,
    };

    await InstagramToken.findOneAndUpdate(
      { userId: userId },
      { $set: tokenData },
      { upsert: true, new: true }
    );
    console.log('[Instagram] Token saved for user:', userId);

    return res.redirect(`${APP_URL}/app?connected=instagram`);
  } catch (e) {
    console.error('[Instagram OAuth] Callback error:', e.response?.data || e.message);
    return res.redirect(`${APP_URL}/app?error=instagram_auth_failed`);
  }
});

module.exports = router;

// --- Uniform platform management endpoints ---

// Status: is Instagram connected for this user?
router.get('/status', requireAuth(), async (req, res) => {
  try {
    const userId = req.auth.userId;
    const token = await InstagramToken.findOne({ userId, isActive: true });
    if (!token) return res.json({ connected: false });
    return res.json({
      connected: true,
      name: token.name || token.pageName || null,
      igUserId: token.igUserId || null,
      pageId: token.pageId || null
    });
  } catch (e) {
    console.error('[Instagram] Status error:', e.message);
    res.status(500).json({ error: 'Failed to get Instagram status' });
  }
});

// Disconnect: mark Instagram token inactive
router.delete('/disconnect', requireAuth(), async (req, res) => {
  try {
    const userId = req.auth.userId;
    const result = await InstagramToken.findOneAndUpdate(
      { userId, isActive: true },
      { isActive: false },
      { new: true }
    );
    if (!result) return res.status(404).json({ error: 'Instagram account not found' });
    return res.json({ success: true, message: 'Instagram account disconnected successfully' });
  } catch (e) {
    console.error('[Instagram] Disconnect error:', e.message);
    res.status(500).json({ error: 'Failed to disconnect Instagram account' });
  }
});


