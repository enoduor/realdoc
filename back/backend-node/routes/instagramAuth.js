/* eslint-disable no-console */
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { requireAuth } = require('@clerk/express');
const InstagramToken = require('../models/InstagramToken');
const User = require('../models/User');
const { abs } = require('../config/url');  // ✅ only abs needed

const router = express.Router();

// Facebook Graph API constants
const FB_GRAPH_VERSION = 'v23.0'; // stop using v18; it's auto-upgraded anyway
const FB_GRAPH = `https://graph.facebook.com/${FB_GRAPH_VERSION}`;
const FACEBOOK_API_URL = process.env.FACEBOOK_API_URL || FB_GRAPH;
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

// ---- Instagram page fetching function ----
async function hydrateInstagramPages({ clerkUserId, userAccessToken }) {
  // 1) Get pages
  const { data: pagesResp } = await axios.get(
    'https://graph.facebook.com/v23.0/me/accounts',
    { params: { access_token: userAccessToken, fields: 'id,name,access_token,instagram_business_account{id,name}' } }
  );

  const pages = pagesResp.data || [];
  if (!pages.length) {
    console.warn('[IG OAuth] No pages returned from /me/accounts');
    return null;
  }

  // 2) Pick a page with Instagram Business Account
  let selectedPage = null;
  for (const page of pages) {
    if (page.instagram_business_account?.id) {
      selectedPage = page;
      break;
    }
  }

  if (!selectedPage) {
    console.warn('[IG OAuth] No pages with Instagram Business Account found');
    return null;
  }

  const pageId = selectedPage.id;
  const pageName = selectedPage.name;
  const pageAccessToken = selectedPage.access_token;
  const igBusinessId = selectedPage.instagram_business_account.id;
  const igBusinessName = selectedPage.instagram_business_account.name;

  console.log('✅ [IG OAuth] Found Instagram page data:', { 
    pageId, 
    pageName, 
    igBusinessId, 
    igBusinessName: igBusinessName || 'none' 
  });
  
  return { pageId, pageName, pageAccessToken, igBusinessId, igBusinessName };
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
      'pages_read_user_content',
      'pages_manage_posts',
      'pages_manage_metadata',
      'instagram_basic',
      'instagram_content_publish',
      'instagram_manage_comments',
      'instagram_manage_insights',
      'publish_video',
      'ads_management',
      'business_management',
    ].join(',');

    const authUrl = `https://www.facebook.com/v23.0/dialog/oauth` +
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

    const tokenResp = await axios.get(`${FB_GRAPH}/oauth/access_token`, {
      params: {
        client_id: FACEBOOK_APP_ID,
        client_secret: FACEBOOK_APP_SECRET,
        redirect_uri: 'https://reelpostly.com/api/auth/instagram/callback',
        code
      },
      timeout: 15000
    });
    console.log('🔍 [Instagram OAuth] Token exchange response:', tokenResp.data);
    const { access_token: shortLived, token_type, expires_in } = tokenResp.data || {};
    if (!shortLived) throw new Error('No short-lived token');

    const longResp = await axios.get(`${FB_GRAPH}/oauth/access_token`, {
      params: { grant_type: 'fb_exchange_token', client_id: FACEBOOK_APP_ID, client_secret: FACEBOOK_APP_SECRET, fb_exchange_token: shortLived },
      timeout: 15000,
    });
    const longLived = longResp.data?.access_token;
    if (!longLived) throw new Error('No long-lived token');

    // Get user profile information first
    let firstName = null, lastName = null, handle = null;
    try {
      console.log('🔍 [Instagram OAuth] Fetching user profile...');
      const profile = await axios.get(`${FB_GRAPH}/me`, {
        params: {
          access_token: longLived,
          // DO NOT ask for 'username' on the user object
          fields: 'id,name,email' // email returns only if permission granted and email exists
        },
        timeout: 10000
      });
      console.log('📄 [Instagram OAuth] User profile response:', profile.data);
      const user = profile.data;
      
      // Parse name information
      firstName = user.first_name || null;
      lastName = user.last_name || null;
      handle = null; // username field deprecated in Facebook API v2.0+
      
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
      const permissionsResp = await axios.get(`${FB_GRAPH}/me/permissions`, {
        params: { access_token: longLived },
        timeout: 10000,
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

    // Fetch Instagram pages using the new function
    const pageData = await hydrateInstagramPages({ 
      clerkUserId: userId, 
      userAccessToken: longLived 
    });

    let pageId, pageName, igUserId, name;
    if (pageData) {
      pageId = pageData.pageId;
      pageName = pageData.pageName;
      igUserId = pageData.igBusinessId;
      name = pageData.igBusinessName;

      console.log('✅ [Instagram OAuth] Selected Instagram page:', {
        pageId, pageName,
        igUserId, name
      });
    } else {
      console.warn('⚠️ [Instagram OAuth] No Instagram Business Account found.');
    }

    // Only save token if we have Instagram Business Account info
    if (!igUserId) {
      console.error('❌ [Instagram OAuth] No Instagram Business Account found. User must have Instagram Business/Creator account connected to Facebook Page.');
      return res.redirect(abs('app?error=instagram_business_account_required'));
    }

    console.log('🔍 [Instagram OAuth Callback] Attempting to save to database...');
    
    // First check if a record with this igUserId exists
    let existingDoc = await InstagramToken.findOne({ igUserId });
    
    if (existingDoc) {
      // Update existing document
      existingDoc.clerkUserId = userId;
      existingDoc.userId = userId;
      existingDoc.email = email;
      existingDoc.accessToken = longLived;
      existingDoc.firstName = firstName;
      existingDoc.lastName = lastName;
      existingDoc.handle = handle;
      existingDoc.grantedPermissions = grantedPermissions;
      existingDoc.isActive = true;
      existingDoc.pageId = pageId;
      existingDoc.pageName = pageName;
      existingDoc.pageAccessToken = pageData?.pageAccessToken || null;
      existingDoc.name = name;
      existingDoc.provider = 'instagram';
      await existingDoc.save();
      console.log('✅ [Instagram OAuth Callback] Updated existing token doc:', {
        id: existingDoc._id,
        clerkUserId: existingDoc.clerkUserId,
        igUserId: existingDoc.igUserId
      });
      return res.redirect(abs('app?connected=instagram'));
    }
    
    // Create new document if none exists
    const newDoc = new InstagramToken({
      clerkUserId: userId,
      userId: userId,
      email,
      accessToken: longLived,
      firstName,
      lastName,
      handle,
      grantedPermissions,
      isActive: true,
      pageId,
      pageName,
      pageAccessToken: pageData?.pageAccessToken || null,
      igUserId,
      name,
      provider: 'instagram'
    });
    await newDoc.save();
    console.log('✅ [Instagram OAuth Callback] Saved new token doc:', {
      id: newDoc._id,
      clerkUserId: newDoc.clerkUserId,
      igUserId: newDoc.igUserId
    });

    return res.redirect(abs('app?connected=instagram'));
  } catch (e) {
    console.error('❌ [Instagram OAuth Callback] Error during callback:', {
      message: e.message,
      stack: e.stack,
      name: e.name
    });
    
    // Log detailed Facebook API error if available
    if (e.response) {
      console.error('🚨 [Instagram OAuth Callback] Facebook API Error Response:', {
        status: e.response.status,
        statusText: e.response.statusText,
        data: e.response.data,
        headers: e.response.headers
      });
    }
    
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