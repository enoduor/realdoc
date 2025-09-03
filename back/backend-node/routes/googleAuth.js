// npm i googleapis (if not already)
const { google } = require('googleapis');
const express = require('express');
const { requireAuth } = require('@clerk/express');
const router = express.Router();

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
  GOOGLE_SCOPES
} = process.env;

const oauth2 = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
);

// Kick off OAuth
router.get('oauth2/start/google', (req, res) => {
  const { userId } = req.query;
  
  if (!userId) {
    return res.status(400).json({ error: 'Missing userId parameter' });
  }

  const url = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: (GOOGLE_SCOPES || '').split(' '),
    state: userId // Pass user ID in state parameter
  });
  
  // Sanity log the URL your app generates
  console.log('[Google OAuth] client_id:', process.env.GOOGLE_CLIENT_ID);
  console.log('[Google OAuth] redirect_uri:', process.env.GOOGLE_REDIRECT_URI);
  console.log('[Google OAuth] scopes:', (process.env.GOOGLE_SCOPES || '').split(' '));
  console.log('[Google OAuth] URL:', url);
  console.log('[Google OAuth] userId:', userId);
  
  res.redirect(url);
});

// Handle callback & exchange code → tokens
router.get('oauth2/callback/google', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    // Get user ID from state parameter (passed from OAuth start)
    const userId = state;
    
    if (!userId) {
      return res.status(400).send('Missing user ID in OAuth callback');
    }

    const { tokens } = await oauth2.getToken(code);

    // Get YouTube channel info
    const auth = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
    );
    auth.setCredentials({ access_token: tokens.access_token });
    const yt = google.youtube({ version: 'v3', auth });
    
    const channelResponse = await yt.channels.list({
      part: ['snippet', 'contentDetails', 'statistics'],
      mine: true
    });

    const channel = channelResponse.data.items?.[0];
    if (!channel) {
      return res.status(400).send('No YouTube channel found for this account');
    }

    // Save token to database using the token utilities
    const { createOrUpdatePlatformToken } = require('../utils/tokenUtils');
    
    await createOrUpdatePlatformToken('youtube', userId, {
      channelId: channel.id,
      channelTitle: channel.snippet.title,
      channelDescription: channel.snippet.description,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + 3600000), // 1 hour from now
      scope: tokens.scope
    });

    console.log(`✅ YouTube token saved for user: ${userId}, channel: ${channel.snippet.title}`);

    res.status(200).send(`
      <h2>✅ YouTube Connected Successfully!</h2>
      <p><strong>Channel:</strong> ${channel.snippet.title}</p>
      <p><strong>Channel ID:</strong> ${channel.id}</p>
      <p><strong>Subscribers:</strong> ${channel.statistics?.subscriberCount || 'Hidden'}</p>
      <p><strong>Videos:</strong> ${channel.statistics?.videoCount || 'Unknown'}</p>
      <br>
      <p>You can now close this window and return to Repostly.</p>
      <script>
        setTimeout(() => {
          window.close();
        }, 3000);
      </script>
    `);
  } catch (e) {
    console.error('YouTube OAuth callback failed:', e.response?.data || e.message);
    res.status(500).send(`
      <h2>❌ YouTube Connection Failed</h2>
      <p>Error: ${e.message}</p>
      <p>Please try again or contact support.</p>
    `);
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

// YouTube OAuth start (requires authentication)
router.get('/oauth/start/youtube', requireAuth(), async (req, res) => {
  try {
    const userId = req.auth().userId;
    const url = `${req.protocol}://${req.get('host')}/oauth2/start/google?userId=${userId}`;
    res.json({ url });
  } catch (error) {
    console.error('YouTube OAuth start error:', error);
    res.status(500).json({ error: 'Failed to start YouTube OAuth' });
  }
});

// YouTube connection status
router.get('/status', requireAuth(), async (req, res) => {
  try {
    const clerkUserId = req.auth().userId;
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
router.delete('disconnect', requireAuth(), async (req, res) => {
  try {
    const userId = req.auth().userId;
    const { deletePlatformToken } = require('../utils/tokenUtils');
    await deletePlatformToken('youtube', userId);
    
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
