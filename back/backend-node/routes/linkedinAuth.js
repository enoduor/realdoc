const express = require('express');
const router = express.Router();
const LinkedInToken = require('../models/LinkedInToken');

// Simple in-memory storage for OAuth state (in production, use Redis/database)
const oauthState = new Map();

const {
  LINKEDIN_CLIENT_ID,
  LINKEDIN_CLIENT_SECRET,
  LINKEDIN_REDIRECT_URI
} = process.env;

/**
 * START: /oauth2/start/linkedin
 * - Kicks off OAuth by redirecting to LinkedIn's authorization page.
 * - Uses LINKEDIN_REDIRECT_URI as the callback URL (must be the *callback*, not the start).
 */
router.get('/oauth2/start/linkedin', (req, res) => {
  const { userId } = req.query;
  if (!userId) {
    console.warn('[LinkedIn OAuth] starting without app userId (will save null)');
  }

  // Generate a single state value and reuse it (don’t call Date.now() twice)
  const state = String(Date.now());

  // Store OAuth state with userId
  oauthState.set(state, { userId: userId || null });

  // Request scopes that are authorized for your LinkedIn app
  const scope = 'openid profile w_member_social email';

  // LinkedIn OAuth 2.0 authorization URL
  const authUrl =
    'https://www.linkedin.com/oauth/v2/authorization?' +
    `response_type=code&` +
    `client_id=${encodeURIComponent(LINKEDIN_CLIENT_ID)}&` +
    `redirect_uri=${encodeURIComponent(LINKEDIN_REDIRECT_URI)}&` + // MUST be the callback URL
    `scope=${encodeURIComponent(scope)}&` +
    `state=${encodeURIComponent(state)}`;

  console.log('[LinkedIn OAuth] client_id:', LINKEDIN_CLIENT_ID);
  console.log('[LinkedIn OAuth] redirect_uri (callback):', LINKEDIN_REDIRECT_URI);
  console.log('[LinkedIn OAuth] state:', state);
  console.log('[LinkedIn OAuth] URL:', authUrl);
  console.log('[LinkedIn OAuth] app userId:', userId || 'null');

  res.redirect(authUrl);
});

/**
 * CALLBACK: /oauth2/callback/linkedin
 * - This path MUST match the LinkedIn app's “Authorized redirect URL”.
 * - Exchanges `code` -> access_token, then stores it.
 */
router.get('/oauth2/callback/linkedin', async (req, res) => {
  try {
    const { code, state } = req.query;
    const storedState = oauthState.get(state);

    console.log('[LinkedIn OAuth] Callback received:');
    console.log('[LinkedIn OAuth] code:', code ? 'present' : 'missing');
    console.log('[LinkedIn OAuth] state:', state ? 'present' : 'missing');
    console.log('[LinkedIn OAuth] storedState:', storedState ? 'found' : 'not found');
    console.log('[LinkedIn OAuth] all query params:', JSON.stringify(req.query, null, 2));

    // Check for OAuth errors first
    if (req.query.error) {
      console.error('[LinkedIn OAuth] OAuth error:', req.query.error);
      console.error('[LinkedIn OAuth] Error description:', req.query.error_description);
      throw new Error(`LinkedIn OAuth error: ${req.query.error} - ${req.query.error_description || 'No description'}`);
    }

    if (!code || !state || !storedState) {
      console.error('[LinkedIn OAuth] Missing parameters - code:', !!code, 'state:', !!state, 'storedState:', !!storedState);
      throw new Error('Missing or invalid OAuth parameters (code/state).');
    }

    const { userId } = storedState;
    console.log('[LinkedIn OAuth] Exchanging code for tokens...');
    console.log('[LinkedIn OAuth] app userId:', userId);

    // Exchange code for access token
    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: LINKEDIN_CLIENT_ID,
        client_secret: LINKEDIN_CLIENT_SECRET,
        redirect_uri: LINKEDIN_REDIRECT_URI, // MUST equal the redirect_uri used above
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error('[LinkedIn OAuth] Token exchange error payload:', tokenData);
      throw new Error('Failed to obtain access token');
    }

    // Clean up stored state
    oauthState.delete(state);

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
      userId: userId || null, // Clerk userId when provided
      linkedinUserId: linkedinUserId,
      firstName: profileData.firstName || profileData.given_name,
      lastName: profileData.lastName || profileData.family_name,
      accessToken: tokenData.access_token,
      expiresAt: new Date(Date.now() + (Number(tokenData.expires_in || 0) * 1000)),
      scope: tokenData.scope || 'openid profile w_member_social email',
      provider: 'linkedin',
      updatedAt: new Date(),
    };

    const result = await LinkedInToken.findOneAndUpdate(
      { linkedinUserId: profileData.id },
      { $set: tokenInfo, $setOnInsert: { createdAt: new Date() } },
      { upsert: true, new: true }
    );

    console.log('[LinkedIn OAuth] Tokens saved. Doc ID:', result._id);

    // Success page
    res.status(200).send(`
      <html>
        <head>
          <title>LinkedIn OAuth Success</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .success { color: green; }
            .info { background: #f0f0f0; padding: 20px; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <h1 class="success">✅ LinkedIn OAuth Successful!</h1>
          <div class="info">
            <h3>Account</h3>
            <p><strong>LinkedIn User ID:</strong> ${linkedinUserId}</p>
            <p><strong>Name:</strong> ${profileData.firstName || profileData.given_name} ${profileData.lastName || profileData.family_name}</p>
            <p><strong>App User ID:</strong> ${userId ?? 'null'}</p>
          </div>
          <div class="info">
            <h3>Token</h3>
            <p><strong>Access Token:</strong> ${tokenData.access_token.substring(0, 20)}...</p>
            <p><strong>Expires In:</strong> ${tokenData.expires_in} seconds</p>
            <p><strong>Scope:</strong> ${tokenInfo.scope}</p>
          </div>
          <p>Redirecting back to app…</p>
          <script>setTimeout(() => { window.location.href = 'http://localhost:3000/app'; }, 2000);</script>
        </body>
      </html>
    `);
  } catch (e) {
    console.error('LinkedIn token exchange failed:', e.message);
    res.status(500).send(`
      <html>
        <head>
          <title>LinkedIn OAuth Error</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .error { color: red; }
            .info { background: #f0f0f0; padding: 20px; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <h1 class="error">❌ LinkedIn OAuth Failed</h1>
          <div class="info">
            <h3>Error Details:</h3>
            <p><strong>Message:</strong> ${e.message}</p>
          </div>
          <p><a href="http://localhost:3000/app">Return to CreatorSync App</a></p>
        </body>
      </html>
    `);
  }
});

module.exports = router;

// --- Uniform platform management endpoints ---
const { requireAuth } = require('@clerk/express');

// Status: is LinkedIn connected for this user?
router.get('/status', requireAuth(), async (req, res) => {
  try {
    const userId = req.auth.userId;
    const token = await LinkedInToken.findOne({ userId });
    if (!token || !token.accessToken) return res.json({ connected: false });
    return res.json({
      connected: true,
      linkedinUserId: token.linkedinUserId,
      name: [token.firstName, token.lastName].filter(Boolean).join(' ') || null
    });
  } catch (e) {
    console.error('[LinkedIn] Status error:', e.message);
    res.status(500).json({ error: 'Failed to get LinkedIn status' });
  }
});

// Disconnect: remove LinkedIn linkage for this user (preserve by linkedinUserId if you prefer)
router.delete('/disconnect', requireAuth(), async (req, res) => {
  try {
    const userId = req.auth.userId;
    const existing = await LinkedInToken.findOne({ userId });
    if (!existing) return res.status(404).json({ error: 'LinkedIn account not found' });
    await LinkedInToken.deleteOne({ _id: existing._id });
    return res.json({ success: true, message: 'LinkedIn account disconnected successfully' });
  } catch (e) {
    console.error('[LinkedIn] Disconnect error:', e.message);
    res.status(500).json({ error: 'Failed to disconnect LinkedIn account' });
  }
});