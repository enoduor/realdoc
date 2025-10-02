const express = require('express');
const axios = require('axios');
const router = express.Router();

const FB_APP_ID = process.env.FACEBOOK_APP_ID;
const FB_APP_SECRET = process.env.FACEBOOK_APP_SECRET;
const APP_BASE_URL = process.env.APP_BASE_URL || 'https://reelpostly.com';

const abs = (p) => `${APP_BASE_URL.replace(/\/+$/, '')}/${p.replace(/^\/+/, '')}`;
const buildState = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const parseState = (s) => { try { return JSON.parse(Buffer.from(s, 'base64url').toString('utf8')); } catch { return {}; } };

/**
 * START: /api/auth/facebook/oauth/start
 * Initiates Facebook OAuth flow with required permissions
 */
router.get('/oauth/start', (req, res) => {
  const { userId, email } = req.query;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  const state = buildState({ userId, email: email || null, ts: Date.now() });

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
  ];

  const params = new URLSearchParams({
    client_id: FB_APP_ID,
    redirect_uri: abs('/api/auth/facebook/callback'),
    scope: scopes.join(','),
    response_type: 'code',
    state,
  });

  const authUrl = `https://www.facebook.com/v23.0/dialog/oauth?${params.toString()}`;
  return res.redirect(302, authUrl);
});

/**
 * START: /api/auth/facebook/oauth/start/facebook
 * Dashboard compatibility route
 */
router.get('/oauth/start/facebook', (req, res) => {
  const { userId, email } = req.query;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  const state = buildState({ userId, email: email || null, ts: Date.now() });

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
  ];

  const params = new URLSearchParams({
    client_id: FB_APP_ID,
    redirect_uri: abs('/api/auth/facebook/callback'),
    scope: scopes.join(','),
    response_type: 'code',
    state,
  });

  const authUrl = `https://www.facebook.com/v23.0/dialog/oauth?${params.toString()}`;
  return res.redirect(302, authUrl);
});

// ---- Page fetching function ----
async function hydrateFacebookPages({ clerkUserId, userAccessToken }) {
  // 1) Get pages
  const { data: pagesResp } = await axios.get(
    'https://graph.facebook.com/v23.0/me/accounts',
    { params: { access_token: userAccessToken, fields: 'id,name,access_token' } }
  );

  const pages = pagesResp.data || [];
  if (!pages.length) {
    console.warn('[FB OAuth] No pages returned from /me/accounts');
    return null;
  }

  // 2) Pick a page (or present choices to the user in UI)
  const page = pages[0]; // or find by name/id
  const pageId = page.id;
  const pageName = page.name;
  const pageAccessToken = page.access_token;

  // 3) Optional: get Instagram Business Account ID
  let igBusinessId = null;
  try {
    const { data: igResp } = await axios.get(
      `https://graph.facebook.com/v23.0/${pageId}`,
      { params: { fields: 'instagram_business_account', access_token: pageAccessToken } }
    );
    igBusinessId = igResp?.instagram_business_account?.id || null;
  } catch (e) {
    console.warn('[FB OAuth] No instagram_business_account linked to this page.');
  }

  console.log('✅ [FB OAuth] Found page data:', { pageId, pageName, igBusinessId: igBusinessId || 'none' });
  return { pageId, pageName, pageAccessToken, igBusinessId };
}

// ---- Database persistence ----
async function upsertFacebookToken({
  clerkUserId,
  facebookUserId,
  name,
  email,
  userAccessToken,
  userTokenType,
  grantedPermissions,
  pageId,
  pageName,
  pageAccessToken,
  instagramBusinessAccountId
}) {
  const FacebookToken = require('../models/FacebookToken');
  
  const doc = await FacebookToken.findOneAndUpdate(
    { clerkUserId, provider: 'facebook' },
    {
      provider: 'facebook',
      clerkUserId,
      userId: clerkUserId,
      facebookUserId,
      name,
      email,
      accessToken: userAccessToken,
      tokenType: 'user',
      grantedPermissions,
      isActive: true,
      pageId: pageId || undefined,
      pageName: pageName || undefined,
      pageAccessToken: pageAccessToken || undefined,
      instagramBusinessAccountId: instagramBusinessAccountId || undefined
    },
    { upsert: true, new: true }
  );
  return doc;
}

/**
 * CALLBACK: /api/auth/facebook/callback
 * - exchange code → user access token (then long-lived)
 * - fetch profile + granted permissions
 * - fetch pages (w/ access_token, IG business linkage)
 * - choose a publishable page (if any)
 * - save to DB
 */
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code) return res.redirect('/app?error=facebook_auth_failed');

    const meta = parseState(state || '');
    const clerkUserId = meta.userId;
    if (!clerkUserId) return res.redirect('/app?error=missing_user');

    console.log('🔍 [Facebook OAuth Callback] Starting. Clerk user:', clerkUserId);

    // 1) short-lived user token
    const tokenParams = new URLSearchParams({
      client_id: FB_APP_ID,
      client_secret: FB_APP_SECRET,
      redirect_uri: abs('/api/auth/facebook/callback'),
      code,
    });
    const tokenUrl = `https://graph.facebook.com/v23.0/oauth/access_token?${tokenParams.toString()}`;
    const shortResp = await axios.get(tokenUrl);
    const shortToken = shortResp.data?.access_token;
    if (!shortToken) throw new Error('No short-lived access_token from Facebook');
    console.log('✅ [FB OAuth] Got short-lived user token.');

    // 2) long-lived user token
    const llParams = new URLSearchParams({
        grant_type: 'fb_exchange_token',
      client_id: FB_APP_ID,
      client_secret: FB_APP_SECRET,
      fb_exchange_token: shortToken,
    });
    const llUrl = `https://graph.facebook.com/v23.0/oauth/access_token?${llParams.toString()}`;
    const longResp = await axios.get(llUrl);
    const userAccessToken = longResp.data?.access_token || shortToken; // fallback
    console.log('✅ [FB OAuth] Got long-lived user token.');

    // 3) user profile
    const meResp = await axios.get(
      `https://graph.facebook.com/v23.0/me`,
      { params: { fields: 'id,name,email', access_token: userAccessToken } }
    );
    const me = meResp.data || {};
    console.log('👤 [FB OAuth] Profile:', me);

    // 4) granted permissions
    const permsResp = await axios.get(
      `https://graph.facebook.com/v23.0/me/permissions`,
      { params: { access_token: userAccessToken } }
    );
    const grantedPermissions = (permsResp.data?.data || [])
      .filter(p => p.status === 'granted')
      .map(p => p.permission);
    console.log('🔑 [FB OAuth] Granted permissions:', grantedPermissions);

    // 5) pages (include IG business linkage + page tokens)
    //    Request the fields we need in one call
    // Use the new hydrateFacebookPages function
    const pageData = await hydrateFacebookPages({ 
      clerkUserId: clerkUserId, 
      userAccessToken 
    });
    let pageId, pageName, pageAccessToken, instagramBusinessAccountId;
    if (pageData) {
      pageId = pageData.pageId;
      pageName = pageData.pageName;
      pageAccessToken = pageData.pageAccessToken;
      instagramBusinessAccountId = pageData.igBusinessId;

      console.log('✅ [FB OAuth] Selected page:', {
        pageId, pageName,
        hasPageAccessToken: !!pageAccessToken,
        instagramBusinessAccountId
      });
    } else {
      console.warn('⚠️ [FB OAuth] No pages found for this user.');
      // Still save the user token for personal profile posting
      const tokenData = await upsertFacebookToken({
        clerkUserId: clerkUserId,
        facebookUserId: me.id,
        name: me.name,
        email: me.email,
        userAccessToken,
        userTokenType: 'user',
        grantedPermissions,
        pageId: null,
        pageName: null,
        pageAccessToken: null,
        instagramBusinessAccountId: null
      });
      
      console.log('💾 [FB OAuth] Saved token record:', tokenData);
      return res.redirect(abs('app?warning=no_pages'));
    }

    // 6) persist
    const saved = await upsertFacebookToken({
      clerkUserId: clerkUserId,
      facebookUserId: me.id,
      name: me.name,
      email: me.email,
      userAccessToken,
      userTokenType: 'user',
      grantedPermissions,
      pageId,
      pageName,
      pageAccessToken,
      instagramBusinessAccountId
    });
    console.log('💾 [FB OAuth] Saved token record:', saved);

    // 7) redirect with context
    if (!pageId) {
      return res.redirect('/app?connected=facebook&warning=no_pages');
    }
    if (pageId && !pageAccessToken) {
      return res.redirect('/app?connected=facebook&warning=no_page_token');
    }
    return res.redirect('/app?connected=facebook');
  } catch (err) {
    if (err.response) {
      console.error('🚨 [Facebook OAuth Callback] Facebook API Error Response:', {
        status: err.response.status,
        statusText: err.response.statusText,
        data: err.response.data,
        headers: err.response.headers,
      });
    } else {
      console.error('❌ [Facebook OAuth Callback] Error during callback:', err);
    }
    return res.redirect('/app?error=facebook_auth_failed');
  }
});

module.exports = router;