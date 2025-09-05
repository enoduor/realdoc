const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const LinkedInToken = require('../models/LinkedInToken');
const User = require('../models/User');

// Simple in-memory storage for OAuth state (in production, use Redis/database)
const oauthState = new Map();

const {
  LINKEDIN_CLIENT_ID,
  LINKEDIN_CLIENT_SECRET
} = process.env;

// Use hardcoded production URLs like Instagram and Facebook
const APP_URL = 'https://videograb-alb-1069883284.us-west-2.elb.amazonaws.com/repostly';
const STATE_HMAC_SECRET = process.env.STATE_HMAC_SECRET || 'dev_state_secret';

// Helper function to get LinkedIn redirect URI
function getLinkedInRedirectUri() {
  return 'https://videograb-alb-1069883284.us-west-2.elb.amazonaws.com/repostly/api/auth/linkedin/oauth2/callback/linkedin';
}

// HMAC signer to protect state (same approach as Instagram/Facebook)
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

/**
 * START: /oauth2/start/linkedin
 * - Kicks off OAuth by redirecting to LinkedIn's authorization page.
 * - Does NOT require Clerk cookies (works on ALB DNS).
 *   We carry identity via HMAC-signed `state`.
 */
router.get('/oauth2/start/linkedin', async (req, res) => {
  try {
    // 1) Try Clerk (if available) — e.g., if Authorization: Bearer <token> was sent
    let userId = req.auth?.().userId;
    let email = req.auth?.().email;

    // 2) Fallbacks when running behind ALB DNS where Clerk cookies aren't sent:
    //    a) Accept explicit headers if your frontend sends them
    if (!userId && req.headers['x-clerk-user-id']) userId = String(req.headers['x-clerk-user-id']);
    if (!email && req.headers['x-clerk-user-email']) email = String(req.headers['x-clerk-user-email']);
    //    b) Accept query params as a last resort (only from your signed-in UI)
    if (!userId && req.query.userId) userId = String(req.query.userId);
    if (!email && req.query.email) email = String(req.query.email);

    console.log('[LinkedIn OAuth] attempting start with identity:', { userId, hasEmail: !!email });

    if (!userId) {
      // We still allow continuing: token will be saved with linkedinUserId/email, and you can link later.
      console.warn('[LinkedIn OAuth] Proceeding without userId — will link on callback if possible');
    }

    // If email not available from Clerk, try DB
    if (!email && userId) {
      try {
        const userDoc = await User.findOne({ clerkUserId: userId });
        if (userDoc?.email) email = userDoc.email;
      } catch (e) {
        console.warn('[LinkedIn OAuth] DB lookup for email failed:', e.message);
      }
    }

    const state = signState({ userId: userId || null, email: email || null, ts: Date.now() });
    const redirectUri = getLinkedInRedirectUri();

    // Request scopes that are authorized for your LinkedIn app
    const scope = 'openid profile w_member_social email';

    // LinkedIn OAuth 2.0 authorization URL
    const authUrl =
      'https://www.linkedin.com/oauth/v2/authorization?' +
      `response_type=code&` +
      `client_id=${encodeURIComponent(LINKEDIN_CLIENT_ID)}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(scope)}&` +
      `state=${encodeURIComponent(state)}`;

    console.log('[LinkedIn OAuth] client_id:', LINKEDIN_CLIENT_ID);
    console.log('[LinkedIn OAuth] redirect_uri (callback):', redirectUri);
    console.log('[LinkedIn OAuth] state:', state);
    console.log('[LinkedIn OAuth] URL:', authUrl);
    console.log('[LinkedIn OAuth] app userId:', userId || 'null');

    res.redirect(authUrl);
  } catch (error) {
    console.error('[LinkedIn] Auth error:', error);
    return res.status(500).json({ error: 'LinkedIn authentication failed' });
  }
});

/**
 * CALLBACK: /oauth2/callback/linkedin
 * - This path MUST match the LinkedIn app's "Authorized redirect URL".
 * - Exchanges `code` -> access_token, then stores it.
 */
router.get('/oauth2/callback/linkedin', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    console.log('[LinkedIn OAuth] Callback received:');
    console.log('[LinkedIn OAuth] code:', code ? 'present' : 'missing');
    console.log('[LinkedIn OAuth] state:', state ? 'present' : 'missing');
    console.log('[LinkedIn OAuth] all query params:', JSON.stringify(req.query, null, 2));

    // Check for OAuth errors first
    if (error) {
      console.error('[LinkedIn OAuth] OAuth error:', error);
      console.error('[LinkedIn OAuth] Error description:', req.query.error_description);
      return res.redirect(`${APP_URL}/app?error=linkedin_auth_failed`);
    }

    if (!code || !state) {
      console.error('[LinkedIn OAuth] Missing parameters - code:', !!code, 'state:', !!state);
      return res.redirect(`${APP_URL}/app?error=linkedin_auth_failed`);
    }

    // Verify HMAC-signed state to get user info
    const userInfo = verifyState(state);
    if (!userInfo?.userId) {
      console.error('[LinkedIn OAuth] Invalid or tampered state parameter');
      return res.redirect(`${APP_URL}/app?error=linkedin_auth_failed`);
    }
    const { userId, email } = userInfo;

    console.log('[LinkedIn OAuth] Exchanging code for tokens...');
    console.log('[LinkedIn OAuth] app userId:', userId);

    // Exchange code for access token
    const redirectUri = getLinkedInRedirectUri();
    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: LINKEDIN_CLIENT_ID,
        client_secret: LINKEDIN_CLIENT_SECRET,
        redirect_uri: redirectUri, // MUST equal the redirect_uri used above
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error('[LinkedIn OAuth] Token exchange error payload:', tokenData);
      throw new Error('Failed to obtain access token');
    }

    console.log('[LinkedIn OAuth] Access token obtained');

    // Extract user info from the token or use OpenID Connect userinfo endpoint
    let profileData = {};
    
    try {
      // Try OpenID Connect userinfo endpoint first
      const userinfoResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      });
      
      if (userinfoResponse.ok) {
        profileData = await userinfoResponse.json();
        console.log('[LinkedIn OAuth] Userinfo response:', profileData);
      } else {
        // Fallback: extract from token or use a default approach
        console.log('[LinkedIn OAuth] Userinfo failed, using fallback approach');
        profileData = {
          id: `user_${Date.now()}`, // Generate a temporary ID
          firstName: 'LinkedIn',
          lastName: 'User',
        };
      }
    } catch (profileError) {
      console.warn('[LinkedIn OAuth] Profile fetch error, using fallback:', profileError.message);
      profileData = {
        id: `user_${Date.now()}`, // Generate a temporary ID
        firstName: 'LinkedIn',
        lastName: 'User',
      };
    }

    // Generate a proper linkedinUserId if not provided
    const linkedinUserId = profileData.id || profileData.sub || `user_${Date.now()}`;
    
    console.log('[LinkedIn OAuth] User profile:', {
      id: linkedinUserId,
      firstName: profileData.firstName || profileData.given_name,
      lastName: profileData.lastName || profileData.family_name,
    });

    // Save/upsert tokens in DB
    const tokenInfo = {
      clerkUserId: userId || null, // Clerk userId (primary key)
      userId: userId || null, // Keep for backward compatibility
      email: email || null,
      linkedinUserId: linkedinUserId,
      firstName: profileData.firstName || profileData.given_name,
      lastName: profileData.lastName || profileData.family_name,
      accessToken: tokenData.access_token,
      expiresAt: new Date(Date.now() + (Number(tokenData.expires_in || 0) * 1000)),
      scope: tokenData.scope || 'openid profile w_member_social email',
      provider: 'linkedin',
      isActive: true,
      updatedAt: new Date(),
    };

    const result = await LinkedInToken.findOneAndUpdate(
      { linkedinUserId: profileData.id },
      { $set: tokenInfo, $setOnInsert: { createdAt: new Date() } },
      { upsert: true, new: true }
    );

    console.log('[LinkedIn OAuth] Tokens saved. Doc ID:', result._id);

    console.log('[LinkedIn OAuth] Connected successfully:', { linkedinUserId: linkedinUserId, name: `${profileData.firstName || profileData.given_name} ${profileData.lastName || profileData.family_name}` });
    return res.redirect(`${APP_URL}/app?connected=linkedin`);
  } catch (e) {
    console.error('LinkedIn token exchange failed:', e.message);
    return res.redirect(`${APP_URL}/app?error=linkedin_auth_failed`);
  }
});


module.exports = router;

// --- Uniform platform management endpoints ---
const { requireAuth } = require('@clerk/express');

// Status: is LinkedIn connected for this user?
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
      isActive: token.isActive || true
    });
  } catch (e) {
    console.error('[LinkedIn] Status error:', e.message);
    res.status(500).json({ error: 'Failed to get LinkedIn status' });
  }
});

// Disconnect: remove LinkedIn linkage for this user (preserve by linkedinUserId if you prefer)
router.delete('/disconnect', requireAuth(), async (req, res) => {
  try {
    const userId = req.auth().userId;
    const existing = await LinkedInToken.findOne({ userId });
    if (!existing) return res.status(404).json({ error: 'LinkedIn account not found' });
    await LinkedInToken.deleteOne({ _id: existing._id });
    return res.json({ success: true, message: 'LinkedIn account disconnected successfully' });
  } catch (e) {
    console.error('[LinkedIn] Disconnect error:', e.message);
    res.status(500).json({ error: 'Failed to disconnect LinkedIn account' });
  }
});