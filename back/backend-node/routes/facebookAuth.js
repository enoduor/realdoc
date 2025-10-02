// routes/facebookAuth.js
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { requireAuth } = require('@clerk/express');
const FacebookToken = require('../models/FacebookToken');
const User = require('../models/User');
const { abs } = require('../config/url');  // ✅ only import abs()

const router = express.Router();

// Facebook Graph API constants
const FB_GRAPH_VERSION = 'v23.0'; // stop using v18; it's auto-upgraded anyway
const FB_GRAPH = `https://graph.facebook.com/${FB_GRAPH_VERSION}`;
const FACEBOOK_API_URL = process.env.FACEBOOK_API_URL || FB_GRAPH;
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;
const STATE_HMAC_SECRET = process.env.STATE_HMAC_SECRET || 'change-me';

console.log('🔍 [Facebook Auth] Environment check:', {
  FACEBOOK_APP_ID: FACEBOOK_APP_ID ? 'SET' : 'MISSING',
  FACEBOOK_APP_SECRET: FACEBOOK_APP_SECRET ? 'SET' : 'MISSING',
  FACEBOOK_API_URL: FACEBOOK_API_URL
});

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
    console.log('🔍 [Facebook OAuth Start] Starting Facebook OAuth process...');
    let userId = req.auth?.().userId;
    let email  = req.auth?.().email;
    console.log('🔍 [Facebook OAuth Start] Initial values:', { userId: userId || 'MISSING', email: email || 'MISSING' });

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
      `&scope=${encodeURIComponent('public_profile,email,pages_manage_metadata,pages_manage_posts,instagram_content_publish')}` +
      `&response_type=code` +
      `&state=${encodeURIComponent(state)}`;

    console.log('🔍 [Facebook OAuth Start] Generated auth URL:', authUrl);
    console.log('🔍 [Facebook OAuth Start] Redirecting to Facebook...');
    return res.redirect(authUrl);
  } catch (error) {
    return res.redirect(abs('app?error=facebook_auth_failed'));
  }
});

// Callback
router.get('/callback', async (req, res) => {
  try {
    console.log('🔍 [Facebook OAuth Callback] Starting callback processing...');
    const { code, state } = req.query;
    console.log('🔍 [Facebook OAuth Callback] Query params:', { code: code ? 'SET' : 'MISSING', state: state ? 'SET' : 'MISSING' });
    
    if (!code || !state) {
      console.error('❌ [Facebook OAuth Callback] Missing code or state');
      return res.redirect(abs('app?error=facebook_auth_failed'));
    }

    const userInfo = verifyState(state);
    console.log('🔍 [Facebook OAuth Callback] User info from state:', { userId: userInfo?.userId || 'MISSING', email: userInfo?.email || 'MISSING' });
    
    if (!userInfo?.userId) {
      console.error('❌ [Facebook OAuth Callback] No userId in state');
      return res.redirect(abs('app?error=facebook_auth_failed'));
    }

    const tokenResp = await axios.get(`${FB_GRAPH}/oauth/access_token`, {
      params: {
        client_id: FACEBOOK_APP_ID,
        client_secret: FACEBOOK_APP_SECRET,
        redirect_uri: 'https://reelpostly.com/api/auth/facebook/callback',
        code
      },
      timeout: 15000
    });
    console.log('🔍 [Facebook OAuth] Token exchange response:', tokenResp.data);
    const { access_token, token_type, expires_in } = tokenResp.data || {};
    if (!access_token) throw new Error('No access token from Facebook');

    const exchangeResp = await axios.get(`${FB_GRAPH}/oauth/access_token`, {
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

    const profile = await axios.get(`${FB_GRAPH}/me`, {
      params: {
        access_token: longLived,
        // DO NOT ask for 'username' on the user object
        fields: 'id,name,email' // email returns only if permission granted and email exists
      },
      timeout: 10000
    });
    const facebookUser = profile.data;

    let pageId, pageName, pageAccessToken;
    try {
      console.log('Facebook: Fetching user pages...');
      const accounts = await axios.get(`${FB_GRAPH}/me/accounts`, {
        params: {
          access_token: longLived,
          fields: 'id,name,access_token,instagram_business_account{id,username}' // page/IGB username is OK
        },
        timeout: 10000
      });
      console.log('Facebook: Pages response:', JSON.stringify(accounts.data, null, 2));
      const pages = accounts.data?.data || [];
      console.log('Facebook: Found', pages.length, 'pages');
      
      if (pages.length > 0) {
        const firstPage = pages[0];
        if (firstPage?.access_token) {
          pageId = firstPage.id;
          pageName = firstPage.name;
          pageAccessToken = firstPage.access_token;
          console.log('Facebook: Using page:', pageName, 'ID:', pageId);
        } else {
          console.warn('Facebook: First page has no access token');
        }
      } else {
        console.warn('Facebook: No pages found for user');
      }
    } catch (pageError) {
      console.error('Facebook: Failed to fetch pages:', pageError.message);
    }

    // Check granted permissions
    let grantedPermissions = [];
    try {
      console.log('Facebook: Checking granted permissions...');
      const permissionsResp = await axios.get(`${FB_GRAPH}/me/permissions`, {
        params: { access_token: longLived },
        timeout: 10000,
      });
      console.log('Facebook: Permissions response:', JSON.stringify(permissionsResp.data, null, 2));
      const permissions = permissionsResp.data?.data || [];
      grantedPermissions = permissions
        .filter(p => p.status === 'granted')
        .map(p => p.permission);
      console.log('Facebook: Granted permissions:', grantedPermissions);
    } catch (permError) {
      console.error('Facebook: Failed to fetch permissions:', permError.message);
    }

    // Parse name into first/last
    const displayName = facebookUser.name || '';
    let firstName = facebookUser.first_name || null;
    let lastName = facebookUser.last_name || null;
    
    // If Facebook doesn't provide first_name/last_name, parse from name
    if (!firstName && !lastName && displayName) {
      const parts = displayName.trim().split(/\s+/);
      firstName = parts[0] || null;
      lastName = parts.length > 1 ? parts.slice(1).join(' ') : null;
    }

    const tokenData = {
      clerkUserId: userInfo.userId,
      userId: userInfo.userId,
      email: userInfo.email || null,
      facebookUserId: facebookUser.id,
      accessToken: longLived,
      name: facebookUser.name,
      firstName: firstName,
      lastName: lastName,
      handle: null, // username field deprecated in Facebook API v2.0+
      grantedPermissions: grantedPermissions,
      isActive: true,
      expiresAt,
      provider: 'facebook',
      ...(pageId && { pageId, pageName, pageAccessToken }),
    };
    
    console.log('Facebook: Saving token data:', {
      clerkUserId: tokenData.clerkUserId,
      facebookUserId: tokenData.facebookUserId,
      hasPageId: !!tokenData.pageId,
      hasPageAccessToken: !!tokenData.pageAccessToken,
      pageName: tokenData.pageName
    });
    
    console.log('🔍 [Facebook OAuth Callback] Attempting to save to database...');
    const savedToken = await FacebookToken.findOneAndUpdate(
      { clerkUserId: userInfo.userId, provider: 'facebook' },
      tokenData,
      { upsert: true, new: true }
    );
    console.log('✅ [Facebook OAuth Callback] Token saved successfully:', {
      id: savedToken._id,
      clerkUserId: savedToken.clerkUserId,
      facebookUserId: savedToken.facebookUserId
    });

    return res.redirect(abs('app?connected=facebook'));
  } catch (error) {
    console.error('❌ [Facebook OAuth Callback] Error during callback:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // Log detailed Facebook API error if available
    if (error.response) {
      console.error('🚨 [Facebook OAuth Callback] Facebook API Error Response:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        headers: error.response.headers
      });
    }
    
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
      facebookUserId: token.facebookUserId,
      pageId: token.pageId || null,
      pageName: token.pageName || null,
      firstName: token.firstName || null,
      lastName: token.lastName || null,
      handle: token.handle || null,
      grantedPermissions: token.grantedPermissions || [],
      isActive: token.isActive ?? true
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get Facebook status' });
  }
});

module.exports = router;