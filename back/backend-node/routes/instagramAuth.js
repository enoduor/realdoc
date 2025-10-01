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
const IG_REDIRECT_URI = abs('api/auth/instagram/callback');

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
      'pages_manage_metadata',
      'pages_manage_posts',
      'instagram_content_publish',
      'instagram_manage_comments'
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
router.get('/callback', async (req, res) => {
  try {
    console.log('🔍 [Instagram OAuth Callback] Starting callback processing...');
    const { code, state, error } = req.query;
    console.log('🔍 [Instagram OAuth Callback] Query params:', { code: code ? 'SET' : 'MISSING', state: state ? 'SET' : 'MISSING', error: error || 'NONE' });
    
    if (error) {
      console.error('❌ [Instagram OAuth Callback] Error in callback:', error);
      return res.redirect(abs('app?error=instagram_auth_failed'));
    }
    if (!code || !state) {
      console.error('❌ [Instagram OAuth Callback] Missing code or state');
      return res.redirect(abs('app?error=instagram_auth_failed'));
    }

    const decoded = verifyState(state);
    const userId = decoded.userId;
    const email  = decoded.email || null;
    console.log('🔍 [Instagram OAuth Callback] User info from state:', { userId: userId || 'MISSING', email: email || 'MISSING' });

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

    // Get user profile information first
    let firstName = null, lastName = null, handle = null;
    try {
      console.log('🔍 [Instagram OAuth] Fetching user profile...');
      const userResp = await axios.get(`${FACEBOOK_API_URL}/me`, {
        params: { access_token: longLived, fields: 'id,name,first_name,last_name,username' },
        timeout: 15000,
      });
      console.log('📄 [Instagram OAuth] User profile response:', userResp.data);
      const user = userResp.data;
      
      // Parse name information
      firstName = user.first_name || null;
      lastName = user.last_name || null;
      handle = user.username || null;
      
      // If Facebook doesn't provide first_name/last_name, parse from name
      if (!firstName && !lastName && user.name) {
        const parts = user.name.trim().split(/\s+/);
        firstName = parts[0] || null;
        lastName = parts.length > 1 ? parts.slice(1).join(' ') : null;
      }
      
      console.log('📄 [Instagram OAuth] User profile parsed:', { firstName, lastName, handle });
    } catch (error) {
      console.error('❌ [Instagram OAuth] Error fetching user profile:', error.response?.data || error.message);
    }

    // Check granted permissions
    let grantedPermissions = [];
    try {
      console.log('🔍 [Instagram OAuth] Checking granted permissions...');
      const permissionsResp = await axios.get(`${FACEBOOK_API_URL}/me/permissions`, {
        params: { access_token: longLived },
        timeout: 15000,
      });
      console.log('📄 [Instagram OAuth] Permissions response:', permissionsResp.data);
      const permissions = permissionsResp.data?.data || [];
      grantedPermissions = permissions
        .filter(p => p.status === 'granted')
        .map(p => p.permission);
      console.log('📄 [Instagram OAuth] Granted permissions:', grantedPermissions);
    } catch (error) {
      console.error('❌ [Instagram OAuth] Error fetching permissions:', error.response?.data || error.message);
    }

    // Resolve IG business account (optional)
    let pageId = null, pageName = null, igUserId = null, name = null;
    try {
      console.log('🔍 [Instagram OAuth] Fetching Facebook pages...');
      const pagesResp = await axios.get(`${FACEBOOK_API_URL}/me/accounts`, {
        params: { access_token: longLived, fields: 'id,name' }, timeout: 15000,
      });
      console.log('📄 [Instagram OAuth] Pages response:', pagesResp.data);
      const firstPage = pagesResp.data?.data?.[0];
      if (firstPage?.id) {
        pageId = firstPage.id; pageName = firstPage.name;
        console.log('📄 [Instagram OAuth] Found page:', { pageId, pageName });
        const igResp = await axios.get(`${FACEBOOK_API_URL}/${pageId}`, {
          params: { access_token: longLived, fields: 'instagram_business_account{name,username}' }, timeout: 15000,
        });
        console.log('📄 [Instagram OAuth] Instagram account response:', igResp.data);
        const igAccount = igResp.data?.instagram_business_account;
        igUserId = igAccount?.id || null;
        name = igAccount?.name || pageName || null;
        // Use Instagram username if available, otherwise keep existing handle
        if (igAccount?.username) {
          handle = igAccount.username;
        }
        console.log('📄 [Instagram OAuth] Instagram account info:', { igUserId, name, handle });
      } else {
        console.log('⚠️ [Instagram OAuth] No Facebook pages found');
      }
    } catch (error) {
      console.error('❌ [Instagram OAuth] Error fetching Instagram business account:', error.response?.data || error.message);
    }

    // Only save token if we have Instagram Business Account info
    if (!igUserId) {
      console.error('❌ [Instagram OAuth] No Instagram Business Account found. User must have Instagram Business/Creator account connected to Facebook Page.');
      return res.redirect(abs('app?error=instagram_business_account_required'));
    }

    console.log('🔍 [Instagram OAuth Callback] Attempting to save to database...');
    const savedToken = await InstagramToken.findOneAndUpdate(
      { clerkUserId: userId, provider: 'instagram' },
      { $set: {
          clerkUserId: userId,
          userId: userId,
          email,
          accessToken: longLived,
          firstName,
          lastName,
          handle,
          grantedPermissions,
          isActive: true,
          pageId, pageName, igUserId, name,
          provider: 'instagram',
        } },
      { upsert: true, new: true }
    );
    console.log('✅ [Instagram OAuth Callback] Token saved successfully:', {
      id: savedToken._id,
      clerkUserId: savedToken.clerkUserId,
      igUserId: savedToken.igUserId
    });

    return res.redirect(abs('app?connected=instagram'));
  } catch (e) {
    console.error('❌ [Instagram OAuth Callback] Error during callback:', {
      message: e.message,
      stack: e.stack,
      name: e.name
    });
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
      grantedPermissions: token.grantedPermissions || [],
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