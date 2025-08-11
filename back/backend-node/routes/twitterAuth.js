const { TwitterApi } = require('twitter-api-v2');
const express = require('express');
const router = express.Router();

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
  const { url, codeVerifier, state } = client.generateOAuth2AuthLink(
    TWITTER_REDIRECT_URI,
    { scope: ['tweet.read', 'tweet.write', 'users.read'] }
  );

  // Store OAuth state in memory (in production, use Redis/database)
  oauthState.set(state, { codeVerifier, state });

  // Sanity log the URL your app generates
  console.log('[Twitter OAuth] client_id:', process.env.TWITTER_CLIENT_ID);
  console.log('[Twitter OAuth] redirect_uri:', process.env.TWITTER_REDIRECT_URI);
  console.log('[Twitter OAuth] URL:', url);
  
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

    const { codeVerifier } = storedState;

    // Exchange code for tokens
    const { accessToken, refreshToken, expiresIn } = await client.loginWithOAuth2({
      code,
      codeVerifier,
      redirectUri: TWITTER_REDIRECT_URI,
    });

    // Clean up stored state
    oauthState.delete(state);

    // TODO: Persist tokens securely for the current user
    // await db.saveTwitterTokens(userId, { accessToken, refreshToken, expiresIn });

    res.status(200).send(`
      <pre>
      Access Token (expires in ${expiresIn}s): ${accessToken || '(not returned)'}
      REFRESH TOKEN (save this in DB!): ${refreshToken || '(none)'}
      State: ${state}
      </pre>
    `);
  } catch (e) {
    console.error('Twitter token exchange failed details:', e.response?.data || e.message);
    res.status(500).send('Token exchange failed');
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
