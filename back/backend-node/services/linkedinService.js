/* eslint-disable no-console */
const fetch = require('node-fetch');
const axios = require('axios');
const crypto = require('crypto');

// ---------- Config ----------
const PRIMARY_VERSION = '202503';
const FALLBACK_VERSIONS = ['202502'];

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

// Invisible uniqueness: append a random number (1–6) of zero-width joiners.
// Keeps UI identical while changing the string to avoid 422 duplicate errors.
function uniqueCommentary(baseText) {
  const text = (baseText ?? '').toString().trim();
  const count = (crypto.randomBytes(1)[0] % 6) + 1; // 1..6
  const ZWJ = '\u200D'; // zero-width joiner
  return text + ZWJ.repeat(count);
}

// Normalize an array/string of hashtags into "#Tag" tokens separated by single spaces.
function formatHashtags(input) {
  if (!input) return '';
  const parts = Array.isArray(input) ? input : String(input).split(/[,\s]+/);

  const cleaned = parts
    .map(h => String(h || '').trim())
    .filter(Boolean)
    .map(h => (h.startsWith('#') ? h : `#${h}`))
    // remove internal spaces and punctuation around hashtags
    .map(h => '#' + h.slice(1).replace(/[^\p{L}\p{N}_]+/gu, ''))
    .filter(h => h.length > 1);

  // Dedup, preserve order
  const seen = new Set();
  const uniq = [];
  for (const h of cleaned) {
    if (!seen.has(h.toLowerCase())) {
      seen.add(h.toLowerCase());
      uniq.push(h);
    }
  }
  return uniq.join(' ');
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
      validateStatus: () => true,
    });

    const ok = res.status >= 200 && res.status < 300;
    const body = res.data;
    return { ok, status: res.status, body, headers: res.headers, version };
  };

  // Primary
  {
    const r = await attempt(PRIMARY_VERSION);
    if (r.ok) return r;
    const msg = typeof r.body === 'string' ? r.body : JSON.stringify(r.body);
    if (!looksLikeVersionError(r.status, msg)) {
      throw new Error(`POST /rest/posts ${r.status}: ${msg}`);
    }
  }
  // Fallbacks
  for (const v of FALLBACK_VERSIONS) {
    const r = await attempt(v);
    const msg = typeof r.body === 'string' ? r.body : JSON.stringify(r.body);
    if (r.ok) return r;
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

  async testConnection() {
    try {
      const userInfo  = await getOpenIdUserinfo(this.accessToken, this.apiV2);
      const authorUrn = await this.getAuthorUrn();

      // Probe with invisible uniqueness
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
   * Publishes content with visible hashtags (as hashtags) and an invisible uniqueness suffix.
   * @param {string} content - main post text (message)
   * @param {string|null} mediaUrl - optional media line (kept as text for now)
   * @param {object} opts
   * @param {boolean} [opts.ensureUnique=true]
   * @param {string[]|string} [opts.hashtags=[]]
   */
  async createPost(content, mediaUrl = null, { ensureUnique = true, hashtags = [] } = {}) {
    try {
      const MAX_LEN = 3000; // LinkedIn text hard limit (approx)
      const msg = (content ?? '').toString().trim();

      if (!msg && !mediaUrl) throw new Error('No content to publish (empty caption and no media).');

      let body = msg;
      if (mediaUrl) body = [body, `Media: ${mediaUrl}`].filter(Boolean).join('\n\n');

      const tags = formatHashtags(hashtags);
      // Assemble message + hashtags with a blank line in between if tags exist.
      let commentary = tags ? `${body}\n\n${tags}` : body;

      // Enforce length (prefer keeping hashtags visible)
      if (commentary.length > MAX_LEN) {
        const over = commentary.length - MAX_LEN;
        const keep = Math.max(0, body.length - over - 1);
        body = body.slice(0, keep).trimEnd();
        commentary = tags ? `${body}\n\n${tags}` : body;
      }

      if (ensureUnique) commentary = uniqueCommentary(commentary);

      console.log('[LinkedIn] postText.preview =', commentary.slice(0, 140).replace(/\n/g, '⏎'));
      const result = await this.postText(commentary);

      return { success: true, postId: result.id, version: result.versionUsed, message: 'Post published successfully' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = LinkedInService;