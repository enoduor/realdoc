const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { TwitterApi } = require('twitter-api-v2');
const TwitterToken = require('../models/TwitterToken');
const User = require('../models/User');

// Use hardcoded production URLs like other platforms
const APP_URL = 'https://videograb-alb-1069883284.us-west-2.elb.amazonaws.com/repostly';

// Helper function to get Twitter redirect URI
function getTwitterRedirectUri() {
  return 'https://videograb-alb-1069883284.us-west-2.elb.amazonaws.com/repostly/api/auth/twitter/oauth/callback/twitter';
}

// HMAC-signed state for security (like Instagram/Facebook/LinkedIn)
const STATE_HMAC_SECRET = process.env.STATE_HMAC_SECRET || 'fallback-secret-key';

function signState(data) {
  const payload = JSON.stringify(data);
  const signature = crypto.createHmac('sha256', STATE_HMAC_SECRET).update(payload).digest('hex');
  return Buffer.from(payload).toString('base64') + '.' + signature;
}

function verifyState(signedState) {
  try {
    const [payload, signature] = signedState.split('.');
    const expectedSignature = crypto.createHmac('sha256', STATE_HMAC_SECRET).update(payload).digest('hex');
    if (signature !== expectedSignature) {
      throw new Error('Invalid signature');
    }
    return JSON.parse(Buffer.from(payload, 'base64').toString());
  } catch (e) {
    throw new Error('Invalid state');
  }
}

// In-memory store (replace with Redis/DB in production)
const reqSecrets = new Map();

/**
 * START: /oauth/start/twitter
 * - Kicks off OAuth by redirecting to Twitter's authorization page.
 * - Does NOT require Clerk cookies (works on ALB DNS).
 *   We carry identity via HMAC-signed `state`.
 */
router.get('/oauth/start/twitter', async (req, res) => {
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

    console.log('[Twitter OAuth] attempting start with identity:', { userId, hasEmail: !!email });

    if (!userId) {
      // We still allow continuing: token will be saved with twitterUserId/email, and you can link later.
      console.warn('[Twitter OAuth] Proceeding without userId — will link on callback if possible');
    }

    // If email not available from Clerk, try DB
    if (!email && userId) {
      try {
        const userDoc = await User.findOne({ clerkUserId: userId });
        if (userDoc?.email) email = userDoc.email;
      } catch (e) {
        console.warn('[Twitter OAuth] DB lookup for email failed:', e.message);
      }
    }

    const appClient = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_SECRET,
    });

    const redirectUri = getTwitterRedirectUri();
    const { url, oauth_token, oauth_token_secret } =
      await appClient.generateAuthLink(redirectUri);

    // Store the secret with the user ID for later retrieval
    reqSecrets.set(oauth_token, {
      secret: oauth_token_secret,
      userId: userId || null,
      email: email || null
    });
    
    console.log('[Twitter OAuth] Generated auth link for userId:', userId);
    console.log('[Twitter OAuth] Redirecting to:', url);
    
    return res.redirect(url);
  } catch (e) {
    console.error('[Twitter OAuth] start error:', e);
    return res.redirect(`${APP_URL}/app?error=twitter_auth_failed`);
  }
});

/** CALLBACK: /oauth/callback/twitter */
router.get('/oauth/callback/twitter', async (req, res) => {
  try {
    const { oauth_token, oauth_verifier } = req.query;
    if (!oauth_token || !oauth_verifier) {
      return res.status(400).send('Missing oauth_token or oauth_verifier');
    }

    const storedData = reqSecrets.get(oauth_token);
    reqSecrets.delete(oauth_token);
    
    if (!storedData) {
      return res.status(400).send('Unknown or expired oauth_token');
    }

    // Build a temp client bound to the request token/secret
    const tempClient = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_SECRET,
      accessToken: oauth_token,
      accessSecret: storedData.secret,
    });

    // Exchange for permanent user tokens
    const { accessToken, accessSecret, userId, screenName } =
      await tempClient.login(oauth_verifier);

    console.log('[Twitter OAuth] Connected successfully:', { userId, screenName });

    // Save per your schema
    const TwitterToken = require('../models/TwitterToken');
    await TwitterToken.findOneAndUpdate(
      { twitterUserId: userId },
      {
        clerkUserId: storedData.userId, // Clerk userId (primary key)
        userId: storedData.userId, // Keep for backward compatibility
        email: storedData.email || null,
        twitterUserId: userId,
        handle: screenName,
        oauthToken: accessToken,
        oauthTokenSecret: accessSecret,
        provider: 'twitter',
        updatedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    console.log('[Twitter OAuth] Tokens saved to database');
    console.log('[Twitter OAuth] Connected successfully:', { twitterUserId: userId, handle: screenName });
    return res.redirect(`${APP_URL}/app?connected=twitter`);
  } catch (e) {
    console.error('[Twitter OAuth] callback error:', e?.data || e);
    return res.redirect(`${APP_URL}/app?error=twitter_auth_failed`);
  }
});

module.exports = router;

// --- Uniform platform management endpoints ---

// Status: is Twitter connected for this user?
router.get('/api/twitter/status', async (req, res) => {
  try {
    const clerkUserId = req.auth().userId;
    const token = await TwitterToken.findOne({ clerkUserId });
    if (!token || !token.oauthToken || !token.oauthTokenSecret) {
      return res.json({ connected: false });
    }
    return res.json({
      connected: true,
      oauthToken: token.oauthToken,
      twitterUserId: token.twitterUserId,
      firstName: token.firstName || null,
      lastName: token.lastName || null,
      handle: token.handle || null,
      isActive: token.isActive || true
    });
  } catch (e) {
    console.error('[Twitter] Status error:', e.message);
    res.status(500).json({ error: 'Failed to get Twitter status' });
  }
});

// Disconnect: remove stored Twitter tokens for this user
router.delete('/api/twitter/disconnect', async (req, res) => {
  try {
    const clerkUserId = req.auth().userId;
    const existing = await TwitterToken.findOne({ clerkUserId });
    if (!existing) {
      return res.status(404).json({ error: 'Twitter account not found' });
    }
    await TwitterToken.deleteOne({ _id: existing._id });
    return res.json({ success: true, message: 'Twitter account disconnected successfully' });
  } catch (e) {
    console.error('[Twitter] Disconnect error:', e.message);
    res.status(500).json({ error: 'Failed to disconnect Twitter account' });
  }
});