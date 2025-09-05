/* back/backend-node/routes/tiktokAuth.js */
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const TikTokToken = require('../models/TikTokToken');
const { exchangeCodeForToken } = require('../services/tiktokService');
const { requireAuth } = require('@clerk/express'); // ✅ use Clerk like the rest
const User = require('../models/User');

// Use hardcoded production URLs like other platforms
const APP_URL = 'https://videograb-alb-1069883284.us-west-2.elb.amazonaws.com/repostly';
// const APP_URL = 'http://localhost:3000'; // For local development

// Helper function to get TikTok redirect URI
function getTikTokRedirectUri() {
  return 'https://videograb-alb-1069883284.us-west-2.elb.amazonaws.com/repostly/api/auth/tiktok/callback';
  // return 'http://localhost:4001/api/auth/tiktok/callback'; // For local development
}

// Simple HMAC signer to protect `state`
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

// Step A: Redirect user to TikTok OAuth authorize URL
router.get('/connect', async (req, res) => {
  try {
    // Get user identity from Clerk (if available), then from headers, then from query params
    let userId = null;
    let email = null;

    // Try to get from Clerk session first
    try {
      const auth = req.auth();
      if (auth && auth.userId) {
        userId = auth.userId;
        email = auth.sessionClaims?.email || null;
      }
    } catch (e) {
      // Clerk auth not available, continue with fallbacks
    }

    // Fallback to headers (for ALB scenarios)
    if (!userId) {
      userId = req.headers['x-clerk-user-id'] || null;
      email = req.headers['x-clerk-user-email'] || null;
    }

    // Fallback to query parameters
    if (!userId) {
      userId = req.query.userId || null;
      email = req.query.email || null;
    }

    console.log('[TikTok OAuth] attempting start with identity:', { userId, hasEmail: !!email });

    if (!userId) {
      console.log('[TikTok OAuth] Proceeding without userId — will link on callback if possible');
    }

    const state = signState({
      userId: userId || null,
      email: email || null,
      ts: Date.now()
    });

    const params = new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY,
      scope: 'user.info.basic video.upload video.list',
      response_type: 'code',
      redirect_uri: getTikTokRedirectUri(),
      state
    });

    console.log('[TikTok OAuth] Redirecting to OAuth:', `https://www.tiktok.com/auth/authorize/?${params.toString()}`);
    
    // For sandbox testing, use the sandbox authorization URL
    const authUrl = `https://www.tiktok.com/auth/authorize/?${params.toString()}`;
    return res.redirect(authUrl);
  } catch (error) {
    console.error('[TikTok OAuth] Start error:', error);
    return res.redirect(`${APP_URL}/app?error=tiktok_auth_failed`);
  }
});

// Step B: OAuth callback (⚠️ DO NOT protect with auth middleware)
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    console.log('[TikTok OAuth] Callback received:');
    console.log('[TikTok OAuth] code:', code ? 'present' : 'missing');
    console.log('[TikTok OAuth] state:', state ? 'present' : 'missing');
    
    if (!code || !state) {
      console.error('[TikTok OAuth] Missing code or state');
      return res.redirect(`${APP_URL}/app?error=tiktok_auth_failed`);
    }

    // Verify state & recover userId set in /connect
    const userInfo = verifyState(state);
    if (!userInfo) {
      console.error('[TikTok OAuth] State verification failed: Invalid state');
      return res.redirect(`${APP_URL}/app?error=tiktok_auth_failed`);
    }
    
    console.log('[TikTok OAuth] Verified state:', { userId: userInfo.userId, hasEmail: !!userInfo.email });

    const { userId, email } = userInfo;

    console.log('[TikTok OAuth] Exchanging code for token...');
    // Exchange authorization code for tokens
    const tokenResp = await exchangeCodeForToken(code);

    // Persist tokens for this user
    // Prefer Clerk user ID if available from session linkage
    let clerkUserId = null;
    try {
      const user = await User.findOne({ _id: userId });
      clerkUserId = user?.clerkUserId || null;
    } catch {}

    await TikTokToken.findOneAndUpdate(
      { $or: [ { clerkUserId }, { userId: userId } ], provider: 'tiktok' },
      {
        clerkUserId,
        userId: userId,
        email: email,
        accessToken: tokenResp.access_token,
        refreshToken: tokenResp.refresh_token,
        tokenType: tokenResp.token_type || 'Bearer',
        scope: tokenResp.scope,
        expiresAt: tokenResp.expiresAt
      },
      { upsert: true, new: true }
    );

    console.log('[TikTok OAuth] Connected successfully');
    // Redirect back to your frontend
    return res.redirect(`${APP_URL}/app?connected=tiktok`);
  } catch (e) {
    console.error('[TikTok OAuth] Callback error:', e?.response?.data || e);
    return res.redirect(`${APP_URL}/app?error=tiktok_auth_failed`);
  }
});

module.exports = router;

// --- Uniform platform management endpoints ---

// Status: is TikTok connected for this user?
router.get('/status', async (req, res) => {
  try {
    // Get user identity from Clerk (if available), then from headers, then from query params
    let clerkUserId = null;

    // Try to get from Clerk session first
    try {
      const auth = req.auth();
      if (auth && auth.userId) {
        clerkUserId = auth.userId;
      }
    } catch (e) {
      // Clerk auth not available, continue with fallbacks
    }

    // Fallback to headers (for ALB scenarios)
    if (!clerkUserId) {
      clerkUserId = req.headers['x-clerk-user-id'] || null;
    }

    // Fallback to query parameters
    if (!clerkUserId) {
      clerkUserId = req.query.userId || null;
    }

    if (!clerkUserId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const token = await TikTokToken.findOne({ clerkUserId });
    if (!token || !token.accessToken) return res.json({ connected: false });
    return res.json({
      connected: true,
      oauthToken: token.accessToken,
      tiktokUserId: token.tiktokUserOpenId || null,
      firstName: token.firstName || null,
      lastName: token.lastName || null,
      handle: token.username || null,
      isActive: token.isActive || true
    });
  } catch (e) {
    console.error('[TikTok] Status error:', e.message);
    res.status(500).json({ error: 'Failed to get TikTok status' });
  }
});

// Disconnect: remove stored TikTok tokens for this user
router.delete('/disconnect', async (req, res) => {
  try {
    // Get user identity from Clerk (if available), then from headers, then from query params
    let clerkUserId = null;

    // Try to get from Clerk session first
    try {
      const auth = req.auth();
      if (auth && auth.userId) {
        clerkUserId = auth.userId;
      }
    } catch (e) {
      // Clerk auth not available, continue with fallbacks
    }

    // Fallback to headers (for ALB scenarios)
    if (!clerkUserId) {
      clerkUserId = req.headers['x-clerk-user-id'] || null;
    }

    // Fallback to query parameters
    if (!clerkUserId) {
      clerkUserId = req.query.userId || null;
    }

    if (!clerkUserId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const user = await User.findOne({ clerkUserId });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const existing = await TikTokToken.findOne({ userId: user._id });
    if (!existing) return res.status(404).json({ error: 'TikTok account not found' });
    await TikTokToken.deleteOne({ _id: existing._id });
    return res.json({ success: true, message: 'TikTok account disconnected successfully' });
  } catch (e) {
    console.error('[TikTok] Disconnect error:', e.message);
    res.status(500).json({ error: 'Failed to disconnect TikTok account' });
  }
});