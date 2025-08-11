// npm i googleapis (if not already)
const { google } = require('googleapis');
const express = require('express');
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
router.get('/oauth2/start/google', (req, res) => {
  const url = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: (GOOGLE_SCOPES || '').split(' ')
  });
  
  // Sanity log the URL your app generates
  console.log('[Google OAuth] client_id:', process.env.GOOGLE_CLIENT_ID);
  console.log('[Google OAuth] redirect_uri:', process.env.GOOGLE_REDIRECT_URI);
  console.log('[Google OAuth] scopes:', (process.env.GOOGLE_SCOPES || '').split(' '));
  console.log('[Google OAuth] URL:', url);
  
  res.redirect(url);
});

// Handle callback & exchange code → tokens
router.get('/oauth2/callback/google', async (req, res) => {
  try {
    const { code } = req.query;
    const { tokens } = await oauth2.getToken(code);

    // TODO: Persist tokens.refresh_token securely for the current user
    // await db.saveRefreshToken(userId, tokens.refresh_token);

    res.status(200).send(`
      <pre>
Access Token (expires ~1h):
${tokens.access_token || '(not returned)'}

REFRESH TOKEN (save this in DB!):
${tokens.refresh_token || '(none - try removing existing app access and re-consent with prompt=consent)'}

Scopes:
${tokens.scope}

Expiry:
${tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : '(n/a)'}
      </pre>
    `);
  } catch (e) {
    console.error('Token exchange failed details:', e.response?.data || e.message);
    res.status(500).send('Token exchange failed');
  }
});

// Optional: quick "who am I" test using an access token you paste as ?access=...
router.get('/youtube/me', async (req, res) => {
  try {
    const access = req.query.access;
    if (!access) return res.status(400).json({ error: 'Pass ?access=ACCESS_TOKEN' });

    const auth = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
    );
    auth.setCredentials({ access_token: access });
    const yt = google.youtube({ version: 'v3', auth });
    const me = await yt.channels.list({ part: 'snippet,contentDetails,statistics', mine: true });
    res.json(me.data);
  } catch (e) {
    console.error(e.response?.data || e.message);
    res.status(500).json({ error: 'YouTube whoami failed' });
  }
});

module.exports = router;
