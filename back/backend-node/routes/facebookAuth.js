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

// Use APP_URL environment variable or fallback to localhost for development
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

// Facebook OAuth redirect URL - use environment variable like other platforms
const FACEBOOK_REDIRECT_URI = process.env.FACEBOOK_REDIRECT_URI;

// Helper function to get Facebook redirect URI
function getFacebookRedirectUri() {
  return FACEBOOK_REDIRECT_URI || 'http://localhost:4001/api/facebook/oauth/callback/facebook';
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
 * - Requires Clerk authentication for production security.
 */
router.get('/oauth/start/facebook', requireAuth(), async (req, res) => {
  try {
    // Get user info from Clerk token (more secure than query params)
    const userId = req.auth().userId;
    let email = req.auth().email;
    
    console.log('[Facebook OAuth] Secure route - Clerk auth data:', {
      userId: userId,
      email: email,
      hasEmail: !!email
    });
    
    if (!userId) {
      console.warn('[Facebook OAuth] No userId from Clerk token');
      return res.status(400).json({ error: 'User authentication required' });
    }

    // If email not available from Clerk, try to get it from database
    if (!email) {
      try {
        const User = require('../models/User');
        const user = await User.findOne({ clerkUserId: userId });
        if (user && user.email) {
          email = user.email;
          console.log('[Facebook OAuth] Got email from database:', email);
        }
      } catch (dbError) {
        console.warn('[Facebook OAuth] Could not fetch email from database:', dbError.message);
      }
    }

    // Create HMAC-signed state for security
    const state = signState({
      userId: userId,
      email: email || null,
      ts: Date.now() // Add timestamp for additional security
    });

    const redirectUri = getFacebookRedirectUri();

    const authUrl =
      `https://www.facebook.com/v18.0/dialog/oauth` +
      `?client_id=${FACEBOOK_APP_ID}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${encodeURIComponent(state)}` +
      `&scope=${encodeURIComponent('public_profile,email,pages_manage_posts,pages_read_engagement,pages_show_list')}`;

    console.log('[Facebook] Redirecting to OAuth:', authUrl);
    res.redirect(authUrl);
  } catch (error) {
    console.error('[Facebook] Auth error:', error);
    res.status(500).json({ error: 'Facebook authentication failed' });
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
      userId: userId,
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
    const userId = req.auth().userId;

    const result = await FacebookToken.findOneAndUpdate(
      { userId: userId, isActive: true },
      { isActive: false },
      { new: true }
    );

    if (!result) {
      return res.status(404).json({ error: 'Facebook account not found' });
    }

    console.log('[Facebook] Disconnected user:', userId);
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
    const userId = req.auth().userId;

    const token = await FacebookToken.findOne({
      userId: userId,
      isActive: true
    });

    if (!token) {
      return res.json({ connected: false });
    }

    res.json({
      connected: true,
      name: token.name,
      handle: token.handle,
      facebookUserId: token.facebookUserId
    });

  } catch (error) {
    console.error('[Facebook] Status error:', error);
    res.status(500).json({ error: 'Failed to get Facebook status' });
  }
});

module.exports = router;
