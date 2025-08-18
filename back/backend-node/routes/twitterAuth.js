const { TwitterApi } = require('twitter-api-v2');
const express = require('express');
const router = express.Router();
const TwitterToken = require('../models/TwitterToken');

// Simple in-memory storage for OAuth state (in production, use Redis/database)
const oauthState = new Map();

const {
  TWITTER_CLIENT_ID,
  TWITTER_CLIENT_SECRET,
  TWITTER_REDIRECT_URI
} = process.env;

// Create Twitter client for OAuth
const client = new TwitterApi({
  clientId: TWITTER_CLIENT_ID,
  clientSecret: TWITTER_CLIENT_SECRET,
});

// Kick off OAuth
router.get('/oauth2/start/twitter', (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    // We’ll still allow null userId in your stored doc, but keep param required if you prefer.
    // Return 400 if you want it strictly required:
    // return res.status(400).json({ error: 'userId parameter is required' });
    console.warn('[Twitter OAuth] starting without app userId (will save null)');
  }

  const { url, codeVerifier, state } = client.generateOAuth2AuthLink(
    TWITTER_REDIRECT_URI,
    { scope: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'] }
  );

  // Store OAuth state with userId (can be null)
  oauthState.set(state, { codeVerifier, state, userId: userId || null });

  // Sanity log
  console.log('[Twitter OAuth] client_id:', process.env.TWITTER_CLIENT_ID);
  console.log('[Twitter OAuth] redirect_uri:', process.env.TWITTER_REDIRECT_URI);
  console.log('[Twitter OAuth] URL:', url);
  console.log('[Twitter OAuth] userId:', userId || 'null');

  res.redirect(url);
});

// Handle callback & exchange code → tokens
router.get('/oauth2/callback/twitter', async (req, res) => {
  try {
    const { code, state } = req.query;
    const storedState = oauthState.get(state);

    if (!code || !state || !storedState) {
      throw new Error('Missing required OAuth parameters');
    }

    const { codeVerifier, userId } = storedState;

    console.log('[Twitter OAuth] Exchanging code for tokens...');
    console.log('[Twitter OAuth] userId:', userId);

    // Exchange code for tokens
    const { accessToken, refreshToken, expiresIn } = await client.loginWithOAuth2({
      code,
      codeVerifier,
      redirectUri: TWITTER_REDIRECT_URI,
    });

    // Clean up stored state
    oauthState.delete(state);

    if (!accessToken || !refreshToken) {
      throw new Error('Failed to obtain access and refresh tokens');
    }

    console.log('[Twitter OAuth] Tokens obtained successfully');
    console.log('[Twitter OAuth] Access token length:', accessToken.length);
    console.log('[Twitter OAuth] Refresh token length:', refreshToken.length);

    // Get user information using the access token
    console.log('[Twitter OAuth] Fetching user information...');
    const userClient = new TwitterApi(accessToken);
    const me = await userClient.v2.me();

    const userData = me.data;
    console.log('[Twitter OAuth] User data:', {
      id: userData.id,
      username: userData.username,
      name: userData.name
    });

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + (expiresIn * 1000));

    // Save or update tokens in database
    console.log('[Twitter OAuth] Saving tokens to database...');
    const tokenData = {
      userId: userId || null,              // allow null (matches your record)
      twitterUserId: userData.id,          // unique join key
      handle: userData.username,
      name: userData.name,

      accessToken,
      refreshToken,
      tokenType: 'bearer',
      scope: 'tweet.write users.read tweet.read offline.access',
      provider: 'twitter',
      expiresAt,
    };

    // IMPORTANT CHANGE: upsert by twitterUserId (not userId) so userId can be null
    const result = await TwitterToken.findOneAndUpdate(
      { twitterUserId: userData.id },
      { $set: tokenData },
      { upsert: true, new: true }
    );

    console.log('[Twitter OAuth] Tokens saved successfully');
    console.log('[Twitter OAuth] Database record ID:', result._id);

    // Return success response
    res.status(200).send(`
      <html>
        <head>
          <title>Twitter OAuth Success</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .success { color: green; }
            .info { background: #f0f0f0; padding: 20px; border-radius: 5px; margin: 20px 0; }
            .error { color: red; }
          </style>
        </head>
        <body>
          <h1 class="success">✅ Twitter OAuth Successful!</h1>

          <div class="info">
            <h3>Account Information:</h3>
            <p><strong>Twitter User ID:</strong> ${userData.id}</p>
            <p><strong>Username:</strong> @${userData.username}</p>
            <p><strong>Display Name:</strong> ${userData.name}</p>
            <p><strong>App User ID:</strong> ${userId ?? 'null'}</p>
          </div>

          <div class="info">
            <h3>Token Information:</h3>
            <p><strong>Access Token:</strong> ${accessToken.substring(0, 20)}...</p>
            <p><strong>Refresh Token:</strong> ${refreshToken.substring(0, 20)}...</p>
            <p><strong>Expires In:</strong> ${expiresIn} seconds</p>
            <p><strong>Expires At:</strong> ${expiresAt.toISOString()}</p>
          </div>

          <div class="info">
            <h3>Next Steps:</h3>
            <p>✅ Tokens have been saved to the database</p>
            <p>✅ You can now post tweets through the CreatorSync app</p>
            <p>🔗 <a href="http://localhost:3000/app">Go to CreatorSync App</a></p>
          </div>

          <script>
            setTimeout(() => { window.location.href = 'http://localhost:3000/app'; }, 3000);
          </script>
        </body>
      </html>
    `);

  } catch (e) {
    console.error('Twitter token exchange failed:', e.message);
    if (e.response?.data) {
      console.error('API Error details:', e.response.data);
    }

    res.status(500).send(`
      <html>
        <head>
          <title>Twitter OAuth Error</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .error { color: red; }
            .info { background: #f0f0f0; padding: 20px; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <h1 class="error">❌ Twitter OAuth Failed</h1>
          <div class="info">
            <h3>Error Details:</h3>
            <p><strong>Message:</strong> ${e.message}</p>
            ${e.response?.data ? `<p><strong>API Error:</strong> ${JSON.stringify(e.response.data, null, 2)}</p>` : ''}
          </div>
          <p><a href="http://localhost:3000/app">Return to CreatorSync App</a></p>
        </body>
      </html>
    `);
  }
});

// Optional: quick "who am I" test using an access token
router.get('/twitter/me', async (req, res) => {
  try {
    const access = req.query.access;
    if (!access) return res.status(400).json({ error: 'Pass ?access=ACCESS_TOKEN' });

    const userClient = new TwitterApi(access);
    const me = await userClient.v2.me();

    res.json(me.data);
  } catch (e) {
    console.error(e.response?.data || e.message);
    res.status(500).json({ error: 'Twitter whoami failed' });
  }
});

module.exports = router;