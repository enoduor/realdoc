// npm i googleapis (if not already)
const { google } = require('googleapis');
const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const User = require('../models/User');

// Use hardcoded production URLs like other platforms
const APP_URL = 'https://videograb-alb-1069883284.us-west-2.elb.amazonaws.com/repostly';
// const APP_URL = 'http://localhost:3000'; // For local development

// Helper function to get Google redirect URI
function getGoogleRedirectUri() {
  return 'https://videograb-alb-1069883284.us-west-2.elb.amazonaws.com/repostly/api/auth/youtube/oauth2/callback/google';
  // return 'http://localhost:4001/api/auth/youtube/oauth2/callback/google'; // For local development
}

// HMAC-signed state for security (same pattern as other platforms)
const STATE_HMAC_SECRET = process.env.STATE_HMAC_SECRET || 'change-me';

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

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_SCOPES
} = process.env;

const oauth2 = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  getGoogleRedirectUri()
);

/**
 * START: /oauth2/start/google
 * - Kicks off OAuth by redirecting to Google's authorization page.
 * - Does NOT require Clerk cookies (works on ALB DNS).
 *   We carry identity via HMAC-signed `state`.
 */
router.get('/oauth2/start/google', async (req, res) => {
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

    console.log('[Google OAuth] attempting start with identity:', { userId, hasEmail: !!email });

    if (!userId) {
      // We still allow continuing: token will be saved with googleUserId/email, and you can link later.
      console.warn('[Google OAuth] Proceeding without userId — will link on callback if possible');
    }

    // If email not available from Clerk, try DB
    if (!email && userId) {
      try {
        const userDoc = await User.findOne({ clerkUserId: userId });
        if (userDoc?.email) email = userDoc.email;
      } catch (e) {
        console.warn('[Google OAuth] DB lookup for email failed:', e.message);
      }
    }

    const state = signState({ userId: userId || null, email: email || null, ts: Date.now() });

    const url = oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: (GOOGLE_SCOPES || 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email').split(' '),
      state: state
    });
    
    console.log('[Google OAuth] Redirecting to OAuth:', url);
    return res.redirect(url);
  } catch (error) {
    console.error('[Google OAuth] Auth error:', error);
    return res.status(500).json({ error: 'Google authentication failed' });
  }
});

/**
 * CALLBACK: /oauth2/callback/google
 * - This path MUST match the Google app's "Authorized redirect URI".
 * - Exchanges `code` -> access_token, then stores it.
 */
router.get('/oauth2/callback/google', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    console.log('[Google OAuth] Callback received:');
    console.log('[Google OAuth] code:', code ? 'present' : 'missing');
    console.log('[Google OAuth] state:', state ? 'present' : 'missing');

    // Check for OAuth errors first
    if (req.query.error) {
      console.error('[Google OAuth] OAuth error:', req.query.error);
      console.error('[Google OAuth] Error description:', req.query.error_description);
      return res.redirect(`${APP_URL}/app?error=google_auth_failed`);
    }

    if (!code || !state) {
      console.error('[Google OAuth] Missing code or state');
      return res.redirect(`${APP_URL}/app?error=google_auth_failed`);
    }

    // Verify HMAC-signed state
    const userInfo = verifyState(state);
    if (!userInfo) {
      console.error('[Google OAuth] State verification failed: Invalid state');
      return res.redirect(`${APP_URL}/app?error=google_auth_failed`);
    }
    console.log('[Google OAuth] Verified state:', { userId: userInfo.userId, hasEmail: !!userInfo.email });

    const { userId, email } = userInfo;

    console.log('[Google OAuth] Exchanging code for token...');
    const { tokens } = await oauth2.getToken(code);

    // Get YouTube channel info
    const auth = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, getGoogleRedirectUri()
    );
    auth.setCredentials({ access_token: tokens.access_token });
    const yt = google.youtube({ version: 'v3', auth });
    
    const channelResponse = await yt.channels.list({
      part: ['snippet', 'contentDetails', 'statistics'],
      mine: true
    });

    const channel = channelResponse.data.items?.[0];
    if (!channel) {
      console.error('[Google OAuth] No YouTube channel found for this account');
      return res.redirect(`${APP_URL}/app?error=google_auth_failed`);
    }

    // Save token to database
    const YouTubeToken = require('../models/YouTubeToken');
    await YouTubeToken.findOneAndUpdate(
      { channelId: channel.id },
      {
        clerkUserId: userId || null,
        email: email || null,
        channelId: channel.id,
        channelTitle: channel.snippet.title,
        channelDescription: channel.snippet.description,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + 3600000),
        scope: tokens.scope,
        provider: 'youtube',
        isActive: true,
        updatedAt: new Date()
      },
      { upsert: true, new: true }
    );

    console.log('[Google OAuth] Connected successfully:', { channelId: channel.id, channelTitle: channel.snippet.title });
    return res.redirect(`${APP_URL}/app?connected=youtube`);
  } catch (e) {
    console.error('[Google OAuth] Callback error:', e.response?.data || e.message);
    return res.redirect(`${APP_URL}/app?error=google_auth_failed`);
  }
});

// Simple test page to connect YouTube account
router.get('test-connect', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Connect YouTube Account</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
        .button { background: #ff0000; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; }
        .info { background: #f0f0f0; padding: 15px; border-radius: 5px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <h1>🔗 Connect Your YouTube Account</h1>
      
      <div class="info">
        <h3>What this does:</h3>
        <ul>
          <li>Opens Google OAuth consent screen</li>
          <li>Requests permission to upload videos to your YouTube channel</li>
          <li>Saves your YouTube credentials securely</li>
          <li>Enables YouTube publishing in Repostly</li>
        </ul>
      </div>

      <h3>Step 1: Click the button below</h3>
      <a href="/oauth2/start/google?userId=user_317vIukeHneALOkPCrpufgWA8DJ" class="button">
        🔗 Connect YouTube Account
      </a>

      <h3>Step 2: Complete the OAuth flow</h3>
      <ol>
        <li>You'll be redirected to Google's consent screen</li>
        <li>Sign in with your Google account (if not already signed in)</li>
        <li>Review and accept the permissions</li>
        <li>You'll be redirected back with a success message</li>
      </ol>

      <h3>Step 3: Return to Repostly</h3>
      <p>After successful connection, close this tab and return to Repostly to test YouTube publishing.</p>

      <div class="info">
        <strong>Note:</strong> This uses the test user ID. In production, this would use your actual Clerk user ID.
      </div>
    </body>
    </html>
  `);
});

// YouTube OAuth start (does NOT require authentication - works on ALB DNS)
router.get('/oauth/start/youtube', async (req, res) => {
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

    const url = `${APP_URL}/api/auth/google/oauth2/start/google?userId=${userId || ''}&email=${email || ''}`;
    res.json({ url });
  } catch (error) {
    console.error('YouTube OAuth start error:', error);
    res.status(500).json({ error: 'Failed to start YouTube OAuth' });
  }
});

// YouTube connection status
router.get('/status', async (req, res) => {
  try {
    // 1) Try Clerk (if available) — e.g., if Authorization: Bearer <token> was sent
    let clerkUserId = req.auth?.().userId;

    // 2) Fallbacks when running behind ALB DNS where Clerk cookies aren't sent:
    //    a) Accept explicit headers if your frontend sends them
    if (!clerkUserId && req.headers['x-clerk-user-id']) clerkUserId = String(req.headers['x-clerk-user-id']);
    //    b) Accept query params as a last resort (only from your signed-in UI)
    if (!clerkUserId && req.query.userId) clerkUserId = String(req.query.userId);

    if (!clerkUserId) {
      return res.status(400).json({ error: 'Missing user ID' });
    }

    const YouTubeToken = require('../models/YouTubeToken');
    const token = await YouTubeToken.findOne({ clerkUserId });
    
    if (!token || !token.accessToken) {
      return res.json({ connected: false });
    }
    
    return res.json({
      connected: true,
      oauthToken: token.accessToken,
      youtubeUserId: token.channelId || null,
      firstName: token.firstName || null,
      lastName: token.lastName || null,
      handle: token.channelTitle || null,
      isActive: token.isActive || true
    });
  } catch (error) {
    console.error('YouTube status error:', error);
    res.status(500).json({ error: 'Failed to get YouTube status' });
  }
});

// YouTube disconnect
router.delete('/disconnect', async (req, res) => {
  try {
    // 1) Try Clerk (if available) — e.g., if Authorization: Bearer <token> was sent
    let userId = req.auth?.().userId;

    // 2) Fallbacks when running behind ALB DNS where Clerk cookies aren't sent:
    //    a) Accept explicit headers if your frontend sends them
    if (!userId && req.headers['x-clerk-user-id']) userId = String(req.headers['x-clerk-user-id']);
    //    b) Accept query params as a last resort (only from your signed-in UI)
    if (!userId && req.query.userId) userId = String(req.query.userId);

    if (!userId) {
      return res.status(400).json({ error: 'Missing user ID' });
    }

    const YouTubeToken = require('../models/YouTubeToken');
    await YouTubeToken.findOneAndDelete({ clerkUserId: userId });
    
    res.json({ success: true, message: 'YouTube disconnected successfully' });
  } catch (error) {
    console.error('YouTube disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect YouTube' });
  }
});

// Optional: quick "who am I" test using an access token you paste as ?access=...
// REMOVED - causing authentication conflicts with YouTube publisher routes
// router.get('/youtube/me', async (req, res) => {
//   try {
//     const access = req.query.access;
//     if (!access) return res.status(400).json({ error: 'Pass ?access=ACCESS_TOKEN' });

//     const auth = new google.auth.OAuth2(
//       GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
//     );
//     auth.setCredentials({ access_token: access });
//     const yt = google.youtube({ version: 'v3', auth });
//     const me = await yt.channels.list({ part: 'snippet,contentDetails,statistics', mine: true });
//     res.json(me.data);
//   } catch (e) {
//     console.error(e.response?.data || e.message);
//     res.status(500).json({ error: 'YouTube whoami failed' });
//   }
// });

module.exports = router;
