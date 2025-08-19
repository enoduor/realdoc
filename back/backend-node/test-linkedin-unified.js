#!/usr/bin/env node
/**
 * test-linkedin-unified.js
 * Unified LinkedIn testing script that combines:
 * - Version negotiation (from test-linkedin.js)
 * - Service integration (from test-linkedin-direct.js)
 * - Simple API testing (from test-linkedin-simple.js)
 * - Connection validation
 * - Post creation testing
 *
 * Required env:
 *   LINKEDIN_ACCESS_TOKEN=...   (token with w_member_social openid profile)
 * Optional env:
 *   LINKEDIN_AUTHOR=urn:li:person:XXXX (skip userinfo if provided)
 *   LINKEDIN_VERSION=YYYYMM or YYYYMM.RR (overrides default 202503)
 */

require('dotenv').config();
const crypto = require('crypto');
const fetch = require('node-fetch');
const LinkedInService = require('./services/linkedinService');

// ---- Config -----------------------------------------------------------------
process.env.LINKEDIN_VERSION = process.env.LINKEDIN_VERSION || '202503';

const TOKEN = process.env.LINKEDIN_ACCESS_TOKEN;
const AUTHOR_OVERRIDE = process.env.LINKEDIN_AUTHOR || '';

if (!TOKEN) {
  console.error('❌ Missing LINKEDIN_ACCESS_TOKEN in env');
  process.exit(1);
}

// ---- Helpers ----------------------------------------------------------------
function normalizeVersion(v) {
  if (!v) return null;
  if (/^\d{6}$/.test(v)) return v;          // YYYYMM
  if (/^\d{6}\.\d{2}$/.test(v)) return v;   // YYYYMM.RR
  return null;
}

const PRIMARY_VERSION = normalizeVersion(process.env.LINKEDIN_VERSION) || '202503';
const FALLBACK_VERSIONS = ['202502']; // extend if you find more working versions

function makeHeaders(token, version) {
  const h = {
    Authorization: `Bearer ${token}`,
    'X-Restli-Protocol-Version': '2.0.0',
    'Content-Type': 'application/json',
  };
  if (version) h['LinkedIn-Version'] = version;
  return h;
}

function looksLikeVersionError(status, text = '') {
  if (status === 400 || status === 426) {
    return /NONEXISTENT_VERSION|INVALID_VERSION|VERSION_MISSING|not active|date format/i.test(text);
  }
  return false;
}

async function safeJson(res) {
  try { return await res.json(); } catch { return await res.text(); }
}

function uniqueCommentary(base) {
  const stamp = new Date().toISOString().slice(0, 16); // e.g. 2025-08-09T23:12
  const digest = crypto.createHash('md5').update(base + stamp).digest('hex').slice(0, 6);
  return `${base} • ${stamp} • ${digest}`;
}

// ---- LinkedIn API calls -----------------------------------------------------
async function getOpenIdUserinfo(token) {
  const r = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const body = await safeJson(r);
  if (!r.ok) throw new Error(`userinfo failed: ${r.status} ${JSON.stringify(body)}`);
  return body; // { sub, ... }
}

async function getAuthorUrn(token) {
  if (AUTHOR_OVERRIDE) return AUTHOR_OVERRIDE;
  const u = await getOpenIdUserinfo(token);
  if (!u.sub) throw new Error('userinfo missing "sub"; ensure token has openid profile');
  return `urn:li:person:${u.sub}`;
}

async function testSimpleMe(token) {
  console.log('🧪 Test 1: GET /me (simple)');
  try {
    const r = await fetch('https://api.linkedin.com/v2/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await safeJson(r);
    if (r.ok) {
      console.log('✅ /me successful:', data);
      return data;
    } else {
      console.log('❌ /me failed:', r.status, data);
      return null;
    }
  } catch (error) {
    console.log('❌ /me error:', error.message);
    return null;
  }
}

async function postWithVersionNegotiation(token, payload) {
  // 1) Try primary pinned version
  {
    const headers = makeHeaders(token, PRIMARY_VERSION);
    console.log('🧭 Attempt #1 — LinkedIn-Version:', PRIMARY_VERSION);
    const res = await fetch('https://api.linkedin.com/rest/posts', {
      method: 'POST', headers, body: JSON.stringify(payload)
    });
    const txt = await safeJson(res);
    if (res.ok) return { res, txt, versionUsed: PRIMARY_VERSION };
    const msg = typeof txt === 'string' ? txt : JSON.stringify(txt);
    if (!looksLikeVersionError(res.status, msg)) {
      throw new Error(`POST /rest/posts ${res.status}: ${msg}`);
    }
  }

  // 2) Try fallbacks
  for (const v of FALLBACK_VERSIONS) {
    const headers = makeHeaders(token, v);
    console.log('🧭 Attempt fallback — LinkedIn-Version:', v);
    const res = await fetch('https://api.linkedin.com/rest/posts', {
      method: 'POST', headers, body: JSON.stringify(payload)
    });
    const txt = await safeJson(res);
    if (res.ok) return { res, txt, versionUsed: v };
    const msg = typeof txt === 'string' ? txt : JSON.stringify(txt);
    if (!looksLikeVersionError(res.status, msg)) {
      throw new Error(`POST /rest/posts ${res.status}: ${msg}`);
    }
  }

  // 3) Final attempt with no version header
  {
    const headers = makeHeaders(token, null);
    console.log('🧭 Attempt final — no LinkedIn-Version header');
    const res = await fetch('https://api.linkedin.com/rest/posts', {
      method: 'POST', headers, body: JSON.stringify(payload)
    });
    const txt = await safeJson(res);
    if (res.ok) return { res, txt, versionUsed: '(default)' };
    throw new Error(`POST /rest/posts ${res.status}: ${JSON.stringify(txt)}`);
  }
}

async function testLinkedInService() {
  console.log('\n🔧 Test 2: LinkedIn Service Integration');
  try {
    const linkedinService = new LinkedInService();
    
    console.log('📋 LinkedIn Service Configuration:');
    console.log(`   API URL: ${linkedinService.apiRest}`);
    console.log(`   Access Token: ${linkedinService.accessToken ? '✅ Present' : '❌ Missing'}`);
    
    if (!linkedinService.accessToken) {
      console.log('❌ No LinkedIn access token found in service');
      return false;
    }
    
    // Test connection
    console.log('🔍 Testing LinkedIn service connection...');
    const connection = await linkedinService.testConnection();
    console.log('Connection result:', connection);
    
    if (!connection.connected) {
      console.log('❌ LinkedIn service connection failed:', connection.error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.log('❌ LinkedIn service test failed:', error.message);
    return false;
  }
}

// ---- Main flow --------------------------------------------------------------
(async () => {
  console.log('🚀 LinkedIn Unified Test Suite');
  console.log('================================');
  console.log('- LinkedIn-Version (primary):', PRIMARY_VERSION);
  if (AUTHOR_OVERRIDE) console.log('- Using LINKEDIN_AUTHOR override:', AUTHOR_OVERRIDE);
  console.log('');

  try {
    // Test 1: Simple API calls
    console.log('📋 Test 1: Basic API Connectivity');
    const meData = await testSimpleMe(TOKEN);
    
    // Test 2: Service integration
    const serviceWorks = await testLinkedInService();
    
    // Test 3: Direct API posting
    console.log('\n📋 Test 3: Direct API Posting');
    const userinfo = await getOpenIdUserinfo(TOKEN);
    const authorUrn = await getAuthorUrn(TOKEN);
    console.log('✅ Connected as:', { id: userinfo.sub, authorUrn });

    // Unique message to avoid duplicate guard
    const message = uniqueCommentary('🧪 CreatorSync unified test');
    console.log('📤 Posting:', message);

    const payload = {
      author: authorUrn,
      commentary: message,
      visibility: 'PUBLIC',
      lifecycleState: 'PUBLISHED',
      distribution: { feedDistribution: 'MAIN_FEED' }
    };

    const { res, txt, versionUsed } = await postWithVersionNegotiation(TOKEN, payload);
    const restliId = res.headers.get('x-restli-id') || (typeof txt === 'object' && txt.id) || null;
    console.log('✅ Post created', { id: restliId, versionUsed });

    // Summary
    console.log('\n📊 Test Summary:');
    console.log('✅ Basic API connectivity:', meData ? 'Working' : 'Failed');
    console.log('✅ Service integration:', serviceWorks ? 'Working' : 'Failed');
    console.log('✅ Direct posting:', 'Working');
    console.log('✅ Version negotiation:', versionUsed);

  } catch (e) {
    // If it's a duplicate-content 422, treat as healthy pipeline
    const msg = String(e.message || '');
    const isDup = /422/.test(msg) && /duplicate|already exists/i.test(msg);
    if (isDup) {
      console.log('ℹ️ Duplicate-content 422 — pipeline OK (message repeated).');
      process.exit(0);
    }
    console.error('💥 Test failed:', e.message);
    process.exit(1);
  }
})();
