const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const TikTokToken = require('../models/TikTokToken');
const TikTokService = require('../services/tiktokService');
const { requireAuth } = require('@clerk/express');
const User = require('../models/User');
const { abs } = require('../config/url');  // ✅ only abs needed

// Helpers
const STATE_HMAC_SECRET = process.env.STATE_HMAC_SECRET || 'change-me';
const TIKTOK_REDIRECT_URI = abs('api/auth/tiktok/callback');

// TikTok OAuth credentials
const TIKTOK_CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
const TIKTOK_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;

// ---- Boot-time env validation (non-fatal) ----
// TikTok credentials are now properly configured in SSM

function signState(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', STATE_HMAC_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}
function verifyState(signed) {
  const [data, sig] = (signed || '').split('.');
  if (!data || !sig) return null;
  const expected = crypto.createHmac('sha256', STATE_HMAC_SECRET).update(data).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return null;
  try {
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  } catch {
    return null;
  }
  try { return JSON.parse(Buffer.from(data, 'base64url').toString()); } catch { return null; }
}

function buildAuthorizeRedirect(state) {
  const params = new URLSearchParams({
    client_key: TIKTOK_CLIENT_KEY || '',
    // TikTok v2 expects space-separated scopes - request video scopes but fallback to basic if not approved
    scope: 'user.info.basic,video.upload,video.publish',
    response_type: 'code',
    redirect_uri: TIKTOK_REDIRECT_URI,
    state
  });
  return `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
}

// TikTok OAuth is now enabled with proper SSM configuration

// Start
router.get('/connect', requireAuth(), async (req, res) => {
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

    const state = signState({ userId: userId || null, email: email || null, ts: Date.now() });
    return res.redirect(buildAuthorizeRedirect(state));
  } catch (error) {
    return res.redirect(abs('app?error=tiktok_auth_failed'));
  }
});

// OAuth Start (for consistency with other platforms)
router.get('/oauth/start/tiktok', async (req, res) => {
  try {
    console.log('🔍 [TikTok OAuth Start] New user attempting TikTok OAuth');
    
    let userId = req.auth?.().userId;
    let email  = req.auth?.().email;

    console.log('🔍 [TikTok OAuth Start] Initial values:', {
      userId: userId || 'MISSING',
      email: email || 'MISSING',
      headers: {
        'x-clerk-user-id': req.headers['x-clerk-user-id'] || 'MISSING',
        'x-clerk-user-email': req.headers['x-clerk-user-email'] || 'MISSING'
      },
      query: {
        userId: req.query.userId || 'MISSING',
        email: req.query.email || 'MISSING'
      }
    });

    if (!userId && req.headers['x-clerk-user-id']) userId = String(req.headers['x-clerk-user-id']);
    if (!email  && req.headers['x-clerk-user-email']) email  = String(req.headers['x-clerk-user-email']);
    if (!userId && req.query.userId) userId = String(req.query.userId);
    if (!email  && req.query.email)  email  = String(req.query.email);

    console.log('🔍 [TikTok OAuth Start] After header/query extraction:', {
      userId: userId || 'MISSING',
      email: email || 'MISSING'
    });

    if (!email && userId) {
      try { const u = await User.findOne({ clerkUserId: userId }); if (u?.email) email = u.email; } catch {}
    }

    console.log('🔍 [TikTok OAuth Start] Final values:', {
      userId: userId || 'MISSING',
      email: email || 'MISSING'
    });

    const state = signState({ userId: userId || null, email: email || null, ts: Date.now() });
    console.log('🔍 [TikTok OAuth Start] Generated state, redirecting to TikTok...');
    return res.redirect(buildAuthorizeRedirect(state));
  } catch (error) {
    console.error('❌ [TikTok OAuth Start] Error:', error.message);
    return res.redirect(abs('app?error=tiktok_auth_failed'));
  }
});

// Callback
router.get('/callback', async (req, res) => {
  try {
    console.log('TikTok callback received:', { code: req.query.code ? 'PRESENT' : 'MISSING', state: req.query.state ? 'PRESENT' : 'MISSING' });
    
    const { code, state } = req.query;
    if (!code || !state) {
      console.log('TikTok callback failed: missing code or state');
      return res.redirect(abs('app?error=tiktok_auth_failed'));
    }

    const userInfo = verifyState(state);
    if (!userInfo) {
      console.log('TikTok callback failed: invalid state');
      return res.redirect(abs('app?error=tiktok_auth_failed'));
    }
    
    console.log('TikTok callback: state verified, proceeding with token exchange');

    const tiktokService = new TikTokService();
    const tokenResp = await tiktokService.exchangeCodeForToken(code);
    console.log('TikTok token exchange successful:', { 
      access_token: tokenResp.access_token ? 'SET' : 'MISSING',
      refresh_token: tokenResp.refresh_token ? 'SET' : 'MISSING',
      expires_in: tokenResp.expires_in
    });
    
    const clerkUserId = userInfo.userId || null; // came from state at /connect

    const tokenDoc = await TikTokToken.findOneAndUpdate(
      { clerkUserId, provider: 'tiktok' },
      {
        clerkUserId,
        email: userInfo.email || null,
        accessToken: tokenResp.access_token,
        refreshToken: tokenResp.refresh_token,
        tokenType: tokenResp.token_type || 'Bearer',
        scope: tokenResp.scope,
        expiresAt: tokenResp.expires_in ? new Date(Date.now() + (tokenResp.expires_in * 1000)) : null
      },
      { upsert: true, new: true }
    );
    console.log('TikTok token saved to database:', tokenDoc ? 'SUCCESS' : 'FAILED');

    // Fetch and store TikTok profile info so /status is populated
    try {
      // Node 18+ has global fetch; if not, this will throw and we silently skip
      const profileRes = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,username', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenResp.access_token}`
        }
      });
      if (profileRes.ok) {
        const profileJson = await profileRes.json();
        // Expected structure: { data: { user: { open_id, display_name, username } } }
        const u = profileJson?.data?.user || {};
        const display = typeof u.display_name === 'string' ? u.display_name : '';
        let first = null, last = null;
        if (display) {
          const parts = display.trim().split(/\s+/);
          first = parts[0] || null;
          last = parts.length > 1 ? parts.slice(1).join(' ') : null;
        }
        await TikTokToken.updateOne(
          { _id: tokenDoc._id },
          {
            $set: {
              tiktokUserOpenId: u.open_id || tokenDoc.tiktokUserOpenId || null,
              username: u.username || tokenDoc.username || null,
              firstName: first ?? tokenDoc.firstName ?? null,
              lastName:  last ?? tokenDoc.lastName  ?? null
            }
          }
         );
      } else {
        const errTxt = await profileRes.text().catch(() => '');
        console.warn('Failed to fetch TikTok profile info:', profileRes.status, errTxt);
      }
    } catch (pfErr) {
      console.warn('TikTok profile sync skipped/failed:', pfErr.message);
    }

    console.log('TikTok OAuth completed successfully, redirecting to app');
    return res.redirect(abs('app?connected=tiktok'));
  } catch (e) {
    console.error('TikTok OAuth callback error:', e.message);
    return res.redirect(abs('app?error=tiktok_auth_failed'));
  }
});

// Status
router.get('/status', requireAuth(), async (req, res) => {
  try {
    const clerkUserId = req.auth().userId;
    const token = await TikTokToken.findOne({ clerkUserId });
    if (!token || !token.accessToken) return res.json({ connected: false });

    return res.json({
      connected: true,
      oauthToken: token.accessToken,
      tiktokUserId: token.tiktokUserOpenId || null,
      firstName: token.firstName || null,
      lastName: token.lastName || null,
      handle: token.username || null,
      isActive: token.isActive ?? true
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to get TikTok status' });
  }
});

// Disconnect
router.delete('/disconnect', requireAuth(), async (req, res) => {
  try {
    const clerkUserId = req.auth().userId;
    const existing = await TikTokToken.findOne({ clerkUserId });
    if (!existing) return res.status(404).json({ error: 'TikTok account not found' });

    await TikTokToken.deleteOne({ _id: existing._id });
    return res.json({ success: true, message: 'TikTok account disconnected successfully' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to disconnect TikTok account' });
  }
});

module.exports = router;