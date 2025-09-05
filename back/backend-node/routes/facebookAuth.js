const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const FacebookToken = require('../models/FacebookToken');
const { requireAuth } = require('@clerk/express');

const router = express.Router();

const {
  FACEBOOK_APP_ID,
  FACEBOOK_APP_SECRET,
  FACEBOOK_API_URL,
  CLERK_FRONTEND_URL
} = process.env;

// Use APP_URL environment variable or fallback to production URL
// const APP_URL = process.env.APP_URL || 'https://videograb-alb-1069883284.us-west-2.elb.amazonaws.com/repostly';
const APP_URL = 'https://videograb-alb-1069883284.us-west-2.elb.amazonaws.com/repostly';
// const APP_URL = process.env.APP_URL || 'http://localhost:3000'; // For local development

// Facebook OAuth redirect URL - use environment variable like other platforms
const FACEBOOK_REDIRECT_URI = process.env.FACEBOOK_REDIRECT_URI;

// Helper function to get Facebook redirect URI
function getFacebookRedirectUri() {
  return 'https://videograb-alb-1069883284.us-west-2.elb.amazonaws.com/repostly/api/auth/facebook/oauth/callback/facebook';
  // return FACEBOOK_REDIRECT_URI || 'http://localhost:4001/api/auth/facebook/oauth/callback/facebook'; // For local development
}

// HMAC signer to protect state (same approach as TikTok)
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

/**
 * START: /oauth/start/facebook
 * - Kicks off OAuth by redirecting to Facebook's authorization page.
 * - Does NOT require Clerk cookies (works on ALB DNS).
 *   We carry identity via HMAC-signed `state`.
 */
router.get('/oauth/start/facebook', async (req, res) => {
  try {
    // 1) Try Clerk (if available) — e.g., if Authorization: Bearer <token> was sent
    let userId = req.auth?.().userId;
    let email  = req.auth?.().email;

    // 2) Fallbacks when running behind ALB DNS where Clerk cookies aren't sent:
    //    a) Accept explicit headers if your frontend sends them
    if (!userId && req.headers['x-clerk-user-id']) userId = String(req.headers['x-clerk-user-id']);
    if (!email && req.headers['x-clerk-user-email']) email = String(req.headers['x-clerk-user-email']);
    //    b) Accept query params as a last resort (only from your signed-in UI)
    if (!userId && req.query.userId) userId = String(req.query.userId);
    if (!email  && req.query.email)  email  = String(req.query.email);

    console.log('[Facebook OAuth] attempting start with identity:', { userId, hasEmail: !!email });

    if (!userId) {
      // We still allow continuing: token will be saved with facebookUserId/email, and you can link later.
      console.warn('[Facebook OAuth] Proceeding without userId — will link on callback if possible');
    }

    // If email not available from Clerk, try DB
    if (!email && userId) {
      try {
        const User = require('../models/User');
        const u = await User.findOne({ clerkUserId: userId });
        if (u?.email) email = u.email;
      } catch (e) {
        console.warn('[Facebook OAuth] DB lookup for email failed:', e.message);
      }
    }

    const state = signState({ userId: userId || null, email: email || null, ts: Date.now() });
    const redirectUri = getFacebookRedirectUri();

    const authUrl =
      `https://www.facebook.com/v18.0/dialog/oauth` +
      `?client_id=${FACEBOOK_APP_ID}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${encodeURIComponent(state)}` +
      `&scope=${encodeURIComponent('public_profile,email,pages_manage_posts,pages_read_engagement,pages_show_list')}`;

    console.log('[Facebook] Redirecting to OAuth:', authUrl);
    return res.redirect(authUrl);
  } catch (error) {
    console.error('[Facebook] Auth error:', error);
    return res.status(500).json({ error: 'Facebook authentication failed' });
  }
});

/**
 * START: /oauth/start/facebook/test (for development/testing)
 * - Same as above but without Clerk auth for testing
 * - Remove this in production
 */
router.get('/oauth/start/facebook/test', async (req, res) => {
  try {
    const { userId, email } = req.query;
    
    // Use a default test user ID if none provided
    const testUserId = userId || 'test_user_123';
    const testEmail = email || 'test@example.com';
    
    console.log('[Facebook OAuth] Test OAuth with userId:', testUserId, 'email:', testEmail);

    // Create HMAC-signed state for security
    const state = signState({
      userId: testUserId,
      email: testEmail,
      ts: Date.now()
    });

    const redirectUri = getFacebookRedirectUri();

    const authUrl =
      `https://www.facebook.com/v18.0/dialog/oauth` +
      `?client_id=${FACEBOOK_APP_ID}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${encodeURIComponent(state)}` +
      `&scope=${encodeURIComponent('public_profile,email,pages_manage_posts,pages_read_engagement,pages_show_list')}`;

    console.log('[Facebook] Redirecting to OAuth (test):', authUrl);
    res.redirect(authUrl);
  } catch (error) {
    console.error('[Facebook] Auth error:', error);
    res.status(500).json({ error: 'Facebook authentication failed' });
  }
});

/**
 * CALLBACK: /oauth/callback/facebook
 * - This path MUST match the Facebook app's "Authorized redirect URL".
 * - Exchanges `code` -> access_token, then stores it.
 */
router.get('/oauth/callback/facebook', async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code) {
      console.error('[Facebook OAuth] No authorization code received');
      return res.redirect(`${APP_URL}/app?error=facebook_auth_failed`);
    }

    // Verify HMAC-signed state to get user info
    const userInfo = verifyState(state);
    if (!userInfo?.userId) {
      console.error('[Facebook OAuth] Invalid or tampered state parameter');
      return res.redirect(`${APP_URL}/app?error=facebook_auth_failed`);
    }
    const { userId, email } = userInfo;

    console.log('[Facebook] Exchanging code for token for user:', userId);

    // Exchange code for access token
    const redirectUri = getFacebookRedirectUri();

    const tokenResponse = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
      params: {
        client_id: FACEBOOK_APP_ID,
        client_secret: FACEBOOK_APP_SECRET,
        redirect_uri: redirectUri,         // must match exactly
        code
      },
      timeout: 15000
    });

    const { access_token } = tokenResponse.data;

    if (!access_token) {
      throw new Error('No access token received from Facebook');
    }

    console.log('[Facebook] Got short-lived token, exchanging for long-lived token...');

    // Exchange short-lived token for long-lived user token
    const exchangeResp = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: FACEBOOK_APP_ID,
        client_secret: FACEBOOK_APP_SECRET,
        fb_exchange_token: access_token,
      },
      timeout: 15000,
    });

    const longLived = exchangeResp.data?.access_token || access_token;
    const ttlSecs = exchangeResp.data?.expires_in; // often ~60 days
    const expiresAt = ttlSecs ? new Date(Date.now() + ttlSecs * 1000) : undefined;

    console.log('[Facebook] Got long-lived token, fetching user info...');

    // Get user info from Facebook
    const userResponse = await axios.get('https://graph.facebook.com/v18.0/me', {
      params: {
        access_token: longLived,
        fields: 'id,name,email'
      }
    });

    const facebookUser = userResponse.data;
    console.log('[Facebook] User info:', facebookUser);

    // Fetch user pages (optional)
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
    } catch (e) {
      console.warn('[Facebook] Could not fetch pages (non-fatal):', e.response?.data || e.message);
    }

    // Save or update token in database
    const tokenData = {
      clerkUserId: userId, // Clerk userId (primary key)
      userId: userId, // Keep for backward compatibility
      email: email,
      facebookUserId: facebookUser.id,
      accessToken: longLived,
      name: facebookUser.name,
      isActive: true,
      expiresAt, // <-- store if present
      ...(pageId && { pageId, pageName, pageAccessToken }), // include only if present
    };

    await FacebookToken.findOneAndUpdate(
      { facebookUserId: facebookUser.id },
      tokenData,
      { upsert: true, new: true }
    );

    console.log('[Facebook] Token saved for user:', userId);

    console.log('[Facebook OAuth] Connected successfully:', { facebookUserId: facebookUser.id, name: facebookUser.name });
    return res.redirect(`${APP_URL}/app?connected=facebook`);

  } catch (error) {
    console.error('[Facebook] Callback error:', error);
    console.error('[Facebook OAuth] callback error:', error);
    return res.redirect(`${APP_URL}/app?error=facebook_auth_failed`);
  }
});

/**
 * Disconnect Facebook account
 */
router.delete('/disconnect', requireAuth(), async (req, res) => {
  try {
    const clerkUserId = req.auth().userId;

    const result = await FacebookToken.findOneAndUpdate(
      { clerkUserId: clerkUserId, isActive: true },
      { isActive: false },
      { new: true }
    );

    if (!result) {
      return res.status(404).json({ error: 'Facebook account not found' });
    }

    console.log('[Facebook] Disconnected user:', clerkUserId);
    res.json({ message: 'Facebook account disconnected successfully' });

  } catch (error) {
    console.error('[Facebook] Disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect Facebook account' });
  }
});

/**
 * Get Facebook connection status
 */
router.get('/status', requireAuth(), async (req, res) => {
  try {
    const clerkUserId = req.auth().userId;

    const token = await FacebookToken.findOne({
      clerkUserId: clerkUserId,
      isActive: true
    });

    if (!token) {
      return res.json({ connected: false });
    }

    res.json({
      connected: true,
      oauthToken: token.accessToken,
      facebookUserId: token.facebookUserId,
      firstName: token.firstName || null,
      lastName: token.lastName || null,
      handle: token.handle || null,
      isActive: token.isActive || true
    });

  } catch (error) {
    console.error('[Facebook] Status error:', error);
    res.status(500).json({ error: 'Failed to get Facebook status' });
  }
});

module.exports = router;
