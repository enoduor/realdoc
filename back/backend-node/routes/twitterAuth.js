const express = require('express');
const router = express.Router();
const { TwitterApi } = require('twitter-api-v2');
const { requireAuth } = require('@clerk/express');

const CALLBACK_URL = 'http://localhost:4001/oauth/callback/twitter';

// In-memory store (replace with Redis/DB in production)
const reqSecrets = new Map();

/** START: /oauth/start/twitter */
router.get('/oauth/start/twitter', requireAuth(), async (req, res) => {
  try {
    const appClient = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_SECRET,
    });

    const { url, oauth_token, oauth_token_secret } =
      await appClient.generateAuthLink(CALLBACK_URL);

    // Store the secret with the user ID for later retrieval
    reqSecrets.set(oauth_token, {
      secret: oauth_token_secret,
      userId: req.auth.userId
    });
    
    console.log('[Twitter OAuth] Generated auth link for userId:', req.auth.userId);
    console.log('[Twitter OAuth] Redirecting to:', url);
    
    return res.redirect(url);
  } catch (e) {
    console.error('[Twitter OAuth] start error:', e);
    res.status(500).send('Twitter OAuth start failed');
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
      { twitterUserId: userId }, // Use twitterUserId as primary key since it's unique
      {
        userId: storedData.userId,
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
    return res.redirect('http://localhost:3000/app?connected=twitter');
  } catch (e) {
    console.error('[Twitter OAuth] callback error:', e?.data || e);
    return res.redirect('http://localhost:3000/app?error=twitter_auth_failed');
  }
});

module.exports = router;