const express = require('express');
const router = express.Router();
const { TwitterApi } = require('twitter-api-v2');
const { requireAuth } = require('@clerk/express');
const TwitterToken = require('../models/TwitterToken');
const User = require('../models/User');
const { abs } = require('../config/url');  // ✅ only abs needed

const reqSecrets = new Map(); // temp in-memory
const TWITTER_CALLBACK = abs('api/auth/twitter/oauth/callback/twitter');  // ✅ clean and consistent

// Start
router.get('/oauth/start/twitter', async (req, res) => {
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

    const appClient = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_SECRET,
    });

    const { url, oauth_token, oauth_token_secret } = await appClient.generateAuthLink(TWITTER_CALLBACK);

    reqSecrets.set(oauth_token, { secret: oauth_token_secret, userId: userId || null, email: email || null });

    return res.redirect(url);
  } catch (e) {
    return res.redirect(abs('app?error=twitter_auth_failed'));
  }
});

// Callback
router.get('/oauth/callback/twitter', async (req, res) => {
  try {
    const { oauth_token, oauth_verifier } = req.query;
    if (!oauth_token || !oauth_verifier) return res.status(400).send('Missing params');

    const stored = reqSecrets.get(oauth_token);
    reqSecrets.delete(oauth_token);
    if (!stored) return res.status(400).send('Unknown or expired oauth_token');

    const tempClient = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_SECRET,
      accessToken: oauth_token,
      accessSecret: stored.secret,
    });

    const { accessToken, accessSecret, userId, screenName } = await tempClient.login(oauth_verifier);

    await TwitterToken.findOneAndUpdate(
      { twitterUserId: userId },
      {
        clerkUserId: stored.userId,
        userId: stored.userId,
        email: stored.email || null,
        twitterUserId: userId,
        handle: screenName,
        oauthToken: accessToken,
        oauthTokenSecret: accessSecret,
        provider: 'twitter',
        updatedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    return res.redirect(abs('app?connected=twitter'));
  } catch (e) {
    return res.redirect(abs('app?error=twitter_auth_failed'));
  }
});

// Status
router.get('/status', requireAuth(), async (req, res) => {
  try {
    const clerkUserId = req.auth().userId;
    const token = await TwitterToken.findOne({ clerkUserId });
    if (!token || !token.oauthToken || !token.oauthTokenSecret) return res.json({ connected: false });

    return res.json({
      connected: true,
      oauthToken: token.oauthToken,
      twitterUserId: token.twitterUserId,
      firstName: token.firstName || null,
      lastName: token.lastName || null,
      handle: token.handle || null,
      isActive: token.isActive ?? true
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to get Twitter status' });
  }
});

// Disconnect
router.delete('/disconnect', requireAuth(), async (req, res) => {
  try {
    const clerkUserId = req.auth().userId;
    const existing = await TwitterToken.findOne({ clerkUserId });
    if (!existing) return res.status(404).json({ error: 'Twitter account not found' });

    await TwitterToken.deleteOne({ _id: existing._id });
    return res.json({ success: true, message: 'Twitter account disconnected successfully' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to disconnect Twitter account' });
  }
});

module.exports = router;