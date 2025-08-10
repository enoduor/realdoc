/* eslint-disable no-console */
const fetch = require('node-fetch');     // used for GET /v2/userinfo
const axios = require('axios');          // used for POST /rest/posts
const crypto = require('crypto');

// ---------- Config ----------
const PRIMARY_VERSION = '202503';           // proven working in your tenant
const FALLBACK_VERSIONS = ['202502'];       // next best; extend if needed

// ---------- Helpers ----------
function normalizeVersion(v) {
  if (!v) return null;
  if (/^\d{6}$/.test(v)) return v;          // YYYYMM
  if (/^\d{6}\.\d{2}$/.test(v)) return v;   // YYYYMM.RR
  return null;
}

function looksLikeVersionError(status, text = '') {
  if (status === 400 || status === 426) {
    return /NONEXISTENT_VERSION|INVALID_VERSION|VERSION_MISSING|not active|date format/i.test(text);
  }
  return false;
}

function uniqueCommentary(base) {
  const stamp = new Date().toISOString(); // ISO second precision
  const rand  = crypto.randomBytes(3).toString('hex'); // extra entropy
  return `${base} • ${stamp} • ${rand}`;
}

async function safeJson(res) {
  try { return await res.json(); } catch { return await res.text(); }
}

// ---------- LinkedIn API ----------
async function getOpenIdUserinfo(token, apiV2) {
  const r = await fetch(`${apiV2}/userinfo`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const body = await safeJson(r);
  if (!r.ok) throw new Error(`userinfo failed: ${r.status} ${JSON.stringify(body)}`);
  return body; // { sub, ... }
}

/**
 * POST with strict version negotiation using Axios:
 *  - Try PRIMARY_VERSION, then each FALLBACK_VERSION
 *  - No "no-version" attempt (your tenant requires the header)
 */
async function postWithVersionNegotiation(token, apiRest, payload) {
  const attempt = async (version) => {
    const headers = {
      Authorization: `Bearer ${token}`,
      'X-Restli-Protocol-Version': '2.0.0',
      'Content-Type': 'application/json',
    };
    if (version) headers['LinkedIn-Version'] = version;

    const res = await axios.post(`${apiRest}/posts`, payload, {
      headers,
      validateStatus: () => true, // we handle non-2xx manually
    });

    const ok = res.status >= 200 && res.status < 300;
    const body = res.data;
    return { ok, status: res.status, body, headers: res.headers, version };
  };

  // 1) Primary
  {
    const r = await attempt(PRIMARY_VERSION);
    if (r.ok) return r;
    const msg = typeof r.body === 'string' ? r.body : JSON.stringify(r.body);
    if (!looksLikeVersionError(r.status, msg)) {
      throw new Error(`POST /rest/posts ${r.status}: ${msg}`);
    }
  }

  // 2) Fallbacks
  for (const v of FALLBACK_VERSIONS) {
    const r = await attempt(v);
    if (r.ok) return r;
    const msg = typeof r.body === 'string' ? r.body : JSON.stringify(r.body);
    if (!looksLikeVersionError(r.status, msg)) {
      throw new Error(`POST /rest/posts ${r.status}: ${msg}`);
    }
  }

  throw new Error(
    `POST /rest/posts failed: no active LinkedIn-Version among [${PRIMARY_VERSION}, ${FALLBACK_VERSIONS.join(', ')}]`
  );
}

class LinkedInService {
  constructor(opts = {}) {
    this.apiV2   = process.env.LINKEDIN_V2_URL   || 'https://api.linkedin.com/v2';
    this.apiRest = process.env.LINKEDIN_REST_URL || 'https://api.linkedin.com/rest';
    this.accessToken   = opts.accessToken || process.env.LINKEDIN_ACCESS_TOKEN;
    this.authorOverride = opts.author     || process.env.LINKEDIN_AUTHOR || null;

    if (!this.accessToken) throw new Error('LINKEDIN_ACCESS_TOKEN not set');

    const envVersion = normalizeVersion(process.env.LINKEDIN_VERSION);
    this.primaryVersion   = envVersion || PRIMARY_VERSION;
    this.fallbackVersions = FALLBACK_VERSIONS.slice();
  }

  async getAuthorUrn() {
    if (this.authorOverride) return this.authorOverride;
    const userInfo = await getOpenIdUserinfo(this.accessToken, this.apiV2);
    if (!userInfo.sub) throw new Error('userinfo missing "sub"; ensure token has openid profile');
    return `urn:li:person:${userInfo.sub}`;
  }

  /**
   * Return shape kept for compatibility with existing test script:
   * { connected, user:{id, authorUrn}, permissions:[], canPost, details? }
   */
  async testConnection() {
    try {
      const userInfo  = await getOpenIdUserinfo(this.accessToken, this.apiV2);
      const authorUrn = await this.getAuthorUrn();

      // Probe with unique message (avoid 422 duplicates)
      const message = uniqueCommentary('🧪 CreatorSync probe');
      const payload = {
        author: authorUrn,
        commentary: message,
        visibility: 'PUBLIC',
        lifecycleState: 'PUBLISHED',
        distribution: { feedDistribution: 'MAIN_FEED' }
      };

      try {
        const r = await postWithVersionNegotiation(this.accessToken, this.apiRest, payload);
        const restliId = r.headers['x-restli-id'] || (typeof r.body === 'object' && r.body.id) || null;

        return {
          connected: true,
          user: { id: userInfo.sub, authorUrn },
          permissions: [],
          canPost: true,
          details: { versionUsed: r.version, restliId }
        };
      } catch (e) {
        // Duplicate content is a healthy pipeline signal for probes
        const msg = String(e.message || '');
        const isDup = /422/.test(msg) && /duplicate|already exists/i.test(msg);
        if (isDup) {
          return {
            connected: true,
            user: { id: userInfo.sub, authorUrn },
            permissions: [],
            canPost: true,
            details: { versionUsed: this.primaryVersion, note: 'Duplicate content detected' }
          };
        }
        return {
          connected: true,
          user: { id: userInfo.sub, authorUrn },
          permissions: [],
          canPost: false,
          details: { error: e.message }
        };
      }
    } catch (err) {
      return { connected: false, error: err.message };
    }
  }

  async postText(message) {
    const authorUrn = await this.getAuthorUrn();
    const payload = {
      author: authorUrn,
      commentary: message,
      visibility: 'PUBLIC',
      lifecycleState: 'PUBLISHED',
      distribution: { feedDistribution: 'MAIN_FEED' }
    };

    const r = await postWithVersionNegotiation(this.accessToken, this.apiRest, payload);
    const restliId = r.headers['x-restli-id'] || (typeof r.body === 'object' && r.body.id) || null;
    return { id: restliId, versionUsed: r.version, success: true };
  }

  /**
   * Publishes content; by default ensures uniqueness to avoid DUPLICATE_POST (422).
   * Pass { ensureUnique: false } to post exact text (not recommended).
   */
  async createPost(content, mediaUrl = null, { ensureUnique = true } = {}) {
    try {
      let postText = content;

      if (mediaUrl) {
        // Placeholder for future media upload flow; reference media in text for now.
        postText += `\n\nMedia: ${mediaUrl}`;
      }

      if (ensureUnique) {
        postText = uniqueCommentary(postText);
      }

      const result = await this.postText(postText);
      return {
        success: true,
        postId: result.id,
        version: result.versionUsed,
        message: 'Post published successfully'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = LinkedInService;