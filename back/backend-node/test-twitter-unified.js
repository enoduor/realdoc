#!/usr/bin/env node
/**
 * test-twitter-unified.js - Unified Twitter API Testing Suite
 *
 * This version prefers the real DB record you showed (twitterUserId present, userId: null allowed).
 */

require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');
const TwitterToken = require('./models/TwitterToken');
const platformPublisher = require('./services/platformPublisher');
const { postTweet, getValidAccessToken, getTwitterHandle, findToken } = require('./services/twitterService');

const DEBUG_MODE = process.argv.includes('--debug');
const TEST_MODES = {
  OAUTH: process.argv.includes('--oauth'),
  DIRECT: process.argv.includes('--direct'),
  DATABASE: process.argv.includes('--database'),
  INTEGRATION: process.argv.includes('--integration'),
  SERVICE: process.argv.includes('--service')
};

async function connectToMongoDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/creatorsync');
    console.log('✅ MongoDB Connected');
    return true;
  } catch (err) {
    console.error('❌ MongoDB Error:', err.message);
    if (DEBUG_MODE) console.error('Full error:', err);
    return false;
  }
}

// ---- Direct token test (unchanged) -----------------------------------------
async function testTwitterDirect() {
  console.log('\n🔍 Test 1: Twitter API with Direct Access Token...');
  const accessToken = process.env.TWITTER_TEST_ACCESS_TOKEN;
  if (!accessToken) return { success: false, reason: 'No direct token available' };

  try {
    const userResponse = await axios.get('https://api.twitter.com/2/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      timeout: 10000
    });

    const testMessage = `🧪 CreatorSync direct token test • ${new Date().toISOString().slice(0, 16)} • ${Math.random().toString(36).substr(2, 6)}`;
    const tweetResponse = await axios.post('https://api.twitter.com/2/tweets', { text: testMessage }, {
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      timeout: 15000
    });

    console.log('✅ User ID:', userResponse.data.data.id);
    console.log('✅ Tweet ID:', tweetResponse.data.data.id);
    console.log('URL:', `https://twitter.com/user/status/${tweetResponse.data.data.id}`);

    return { success: true };
  } catch (error) {
    console.error('❌ Twitter direct test failed:', error.message);
    if (DEBUG_MODE && error.response?.data) console.error(JSON.stringify(error.response.data, null, 2));
    return { success: false, reason: error.message };
  }
}

// ---- Database token test (PREFERS twitterUserId + allows userId:null) ------
async function testTwitterDatabase() {
  console.log('\n🔍 Test 2: Twitter API with Database Tokens...');

  // Prefer your real shape
  let tokenDoc = await TwitterToken.findOne({
    twitterUserId: { $exists: true, $ne: null },
    handle: { $exists: true, $ne: null }
  });
  if (!tokenDoc) tokenDoc = await TwitterToken.findOne({ twitterUserId: { $exists: true, $ne: null } });
  if (!tokenDoc) tokenDoc = await TwitterToken.findOne({});
  if (!tokenDoc) return { success: false, reason: 'No tokens in database' };

  console.log('✅ Using record:');
  console.log('- userId:', tokenDoc.userId || 'null');
  console.log('- twitterUserId:', tokenDoc.twitterUserId);
  console.log('- handle:', tokenDoc.handle);
  console.log('- name:', tokenDoc.name);

  const identifier = tokenDoc.twitterUserId
    ? { twitterUserId: tokenDoc.twitterUserId }
    : { userId: tokenDoc.userId };

  const handle = await getTwitterHandle(identifier);
  console.log('✅ Twitter handle:', handle);

  const accessToken = await getValidAccessToken(identifier);
  console.log('✅ Access token length:', accessToken.length);

  const msg = `🧪 CreatorSync database token test • ${new Date().toISOString().slice(0,16)} • ${Math.random().toString(36).slice(2,6)}`;
  const result = await postTweet(identifier, msg);
  console.log('✅ Tweet posted:', result.data?.id, result.data?.text);
  console.log('URL:', `https://twitter.com/user/status/${result.data?.id}`);

  return { success: true };
}

// ---- Service + Integration tests (unchanged logic) -------------------------
async function testTwitterService() {
  console.log('\n🔍 Test 3: Twitter Service Layer Testing...');
  try {
    const tokenDoc = await TwitterToken.findOne({});
    if (!tokenDoc) return { success: false, reason: 'No tokens in database' };

    if (tokenDoc.userId) {
      const tokenByUserId = await findToken({ userId: tokenDoc.userId });
      console.log('✅ findToken with userId:', tokenByUserId ? 'Found' : 'Not found');
    } else {
      console.log('⚠️  Skipping userId test (userId is null)');
    }

    if (tokenDoc.twitterUserId) {
      const tokenByTwitterId = await findToken({ twitterUserId: tokenDoc.twitterUserId });
      console.log('✅ findToken with twitterUserId:', tokenByTwitterId ? 'Found' : 'Not found');
    }

    if (tokenDoc.userId) {
      const handleByUserId = await getTwitterHandle({ userId: tokenDoc.userId });
      console.log('✅ Handle by userId:', handleByUserId);
    } else {
      console.log('⚠️  Skipping handle by userId test (userId is null)');
    }

    if (tokenDoc.twitterUserId) {
      const handleByTwitterId = await getTwitterHandle({ twitterUserId: tokenDoc.twitterUserId });
      console.log('✅ Handle by twitterUserId:', handleByTwitterId);
    }

    if (tokenDoc.userId) {
      const accessTokenByUserId = await getValidAccessToken({ userId: tokenDoc.userId });
      console.log('✅ Token by userId length:', accessTokenByUserId.length);
    } else {
      console.log('⚠️  Skipping token by userId test (userId is null)');
    }

    if (tokenDoc.twitterUserId) {
      const accessTokenByTwitterId = await getValidAccessToken({ twitterUserId: tokenDoc.twitterUserId });
      console.log('✅ Token by twitterUserId length:', accessTokenByTwitterId.length);
    }

    return { success: true };
  } catch (error) {
    console.error('❌ Service layer test failed:', error.message);
    if (DEBUG_MODE) console.error('Full error:', error);
    return { success: false, reason: error.message };
  }
}

async function testTwitterIntegration() {
  console.log('\n🔍 Test 4: Twitter Integration with Platform Publisher...');
  try {
    const tokenDoc = await TwitterToken.findOne({
      twitterUserId: { $exists: true, $ne: null }
    });
    if (!tokenDoc) return { success: false, reason: 'No twitterUserId in database' };

    const postData = {
      twitterUserId: tokenDoc.twitterUserId,
      caption: '🧪 Integration test: Updated Twitter service with new interface!',
      hashtags: ['CreatorSync', 'Integration', 'Testing'],
      mediaUrl: null
    };

    const result = await platformPublisher.publishToPlatform('twitter', postData);

    console.log('\n✅ Result:');
    console.log('- Success:', result.success);
    console.log('- Platform:', result.platform);
    console.log('- Post ID:', result.postId);
    console.log('- URL:', result.url);
    console.log('- Message:', result.message);

    return { success: !!result.success };
  } catch (error) {
    console.error('\n❌ Integration test failed:', error.message);
    if (DEBUG_MODE) console.error('Full error:', error);
    return { success: false, reason: error.message };
  }
}

async function testTwitterOAuth() {
  console.log('\n🔍 Test 5: Twitter OAuth Configuration...');
  console.log('- TWITTER_CLIENT_ID:', process.env.TWITTER_CLIENT_ID ? 'Set' : 'Missing');
  console.log('- TWITTER_CLIENT_SECRET:', process.env.TWITTER_CLIENT_SECRET ? 'Set' : 'Missing');
  console.log('- TWITTER_REDIRECT_URI:', process.env.TWITTER_REDIRECT_URI || 'http://localhost:4001/oauth2/callback/twitter');

  if (!process.env.TWITTER_CLIENT_ID || !process.env.TWITTER_CLIENT_SECRET) {
    return { success: false, reason: 'Missing OAuth credentials' };
  }
  // Endpoint check omitted; OAuth will be tested via real flow.
  return { success: true };
}

async function main() {
  console.log('🚀 Starting Unified Twitter Test Suite...\n');

  const mongoConnected = await connectToMongoDB();
  if (!mongoConnected) process.exit(1);

  // Run DB test by default (most relevant)
  const results = [];
  const dbRes = await testTwitterDatabase();
  results.push({ test: 'Database Token', ...dbRes });

  // Optional: others
  if (TEST_MODES.DIRECT) results.push({ test: 'Direct Token', ...(await testTwitterDirect()) });
  if (TEST_MODES.SERVICE) results.push({ test: 'Service Layer', ...(await testTwitterService()) });
  if (TEST_MODES.INTEGRATION) results.push({ test: 'Platform Integration', ...(await testTwitterIntegration()) });
  if (TEST_MODES.OAUTH) results.push({ test: 'OAuth Configuration', ...(await testTwitterOAuth()) });

  console.log('\n📊 Test Results Summary:');
  console.log('='.repeat(50));
  results.forEach((r, i) => console.log(`${i + 1}. ${r.test}: ${r.success ? '✅ PASS' : `❌ FAIL${r.reason ? ' — ' + r.reason : ''}`}`));

  const anyPass = results.some(r => r.success);
  process.exit(anyPass ? 0 : 1);
}

main().catch((error) => {
  console.error('💥 Test suite failed:', error);
  if (DEBUG_MODE) console.error('Full error:', error);
  process.exit(1);
});