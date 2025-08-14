#!/usr/bin/env node
/**
 * test-twitter.js - Comprehensive Twitter API Testing
 * 
 * This script tests Twitter functionality in multiple ways:
 * 1. Direct access token testing (if TWITTER_TEST_ACCESS_TOKEN is set)
 * 2. OAuth flow testing (if no direct token)
 * 3. Database token testing (if tokens exist in database)
 * 
 * Usage:
 *   node test-twitter.js                    # Test with available tokens
 *   node test-twitter.js --oauth           # Force OAuth flow
 *   node test-twitter.js --direct          # Force direct token test
 */

require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');
const TwitterToken = require('./models/TwitterToken');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => {
    console.error('❌ MongoDB Error:', err);
    process.exit(1);
  });

async function testTwitterDirect() {
  console.log('🔍 Testing Twitter API with Direct Access Token...');
  
  const accessToken = process.env.TWITTER_TEST_ACCESS_TOKEN;
  
  if (!accessToken) {
    console.log('❌ No TWITTER_TEST_ACCESS_TOKEN found');
    return false;
  }
  
  console.log('📋 Configuration:');
  console.log('- TWITTER_TEST_ACCESS_TOKEN: Set');
  console.log('- Token length:', accessToken.length);
  
  try {
    // Test 1: Get user info
    console.log('\n🧪 Test 1: Getting user info...');
    const userResponse = await axios.get('https://api.twitter.com/2/users/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('✅ User info retrieved successfully');
    console.log('- User ID:', userResponse.data.data.id);
    console.log('- Username:', userResponse.data.data.username);
    console.log('- Name:', userResponse.data.data.name);
    
    // Test 2: Post a tweet
    console.log('\n🧪 Test 2: Posting test tweet...');
    const testMessage = `🧪 CreatorSync direct token test • ${new Date().toISOString().slice(0, 16)} • ${Math.random().toString(36).substr(2, 6)}`;
    console.log('- Message:', testMessage);
    
    const tweetResponse = await axios.post('https://api.twitter.com/2/tweets', {
      text: testMessage
    }, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });
    
    console.log('✅ Tweet posted successfully!');
    console.log('- Tweet ID:', tweetResponse.data.data.id);
    console.log('- Tweet text:', tweetResponse.data.data.text);
    
    return true;
    
  } catch (error) {
    console.error('❌ Twitter direct test failed:', error.message);
    if (error.response?.data) {
      console.error('API Error details:', JSON.stringify(error.response.data, null, 2));
    }
    
    if (error.response?.status === 401) {
      console.log('💡 Token is invalid or expired - try OAuth flow');
    } else if (error.response?.status === 403) {
      console.log('💡 Token lacks required permissions (tweet.write)');
    }
    
    return false;
  }
}

async function testTwitterDatabase() {
  console.log('🔍 Testing Twitter API with Database Tokens...');
  
  const tokenDoc = await TwitterToken.findOne({});
  
  if (!tokenDoc) {
    console.log('❌ No Twitter tokens found in database');
    return false;
  }
  
  console.log('✅ Found Twitter tokens for user:', tokenDoc.userId);
  console.log('- Token expires at:', tokenDoc.expiresAt);
  console.log('- Scopes:', tokenDoc.scope);
  
  try {
    // Test getting a valid access token
    console.log('\n🧪 Test 1: Getting valid access token...');
    const { getValidAccessToken, postTweet } = require('./services/twitterService');
    const accessToken = await getValidAccessToken({ userId: tokenDoc.userId });
    console.log('✅ Access token retrieved successfully');
    console.log('- Token length:', accessToken.length);
    
    // Test posting a tweet
    console.log('\n🧪 Test 2: Posting test tweet...');
    const testMessage = `🧪 CreatorSync database token test • ${new Date().toISOString().slice(0, 16)} • ${Math.random().toString(36).substr(2, 6)}`;
    console.log('- Message:', testMessage);
    
    const result = await postTweet({ userId: tokenDoc.userId }, testMessage);
    console.log('✅ Tweet posted successfully!');
    console.log('- Tweet ID:', result.data?.id);
    console.log('- Tweet text:', result.data?.text);
    
    return true;
    
  } catch (error) {
    console.error('❌ Twitter database test failed:', error.message);
    return false;
  }
}

async function testTwitterOAuth() {
  console.log('🔍 Testing Twitter OAuth Configuration...');
  
  console.log('📋 Configuration:');
  console.log('- TWITTER_CLIENT_ID:', process.env.TWITTER_CLIENT_ID ? 'Set' : 'Missing');
  console.log('- TWITTER_CLIENT_SECRET:', process.env.TWITTER_CLIENT_SECRET ? 'Set' : 'Missing');
  console.log('- TWITTER_REDIRECT_URI:', process.env.TWITTER_REDIRECT_URI || 'http://localhost:4001/oauth2/callback/twitter');
  
  if (!process.env.TWITTER_CLIENT_ID || !process.env.TWITTER_CLIENT_SECRET) {
    console.log('❌ Missing Twitter OAuth credentials');
    return false;
  }
  
  // Test OAuth endpoints
  try {
    console.log('\n🧪 Test 1: Checking OAuth endpoints...');
    const oauthResponse = await axios.get('https://api.twitter.com/2/oauth2/authorize', {
      timeout: 10000,
      params: {
        response_type: 'code',
        client_id: process.env.TWITTER_CLIENT_ID,
        redirect_uri: process.env.TWITTER_REDIRECT_URI || 'http://localhost:4001/oauth2/callback/twitter',
        scope: 'tweet.read tweet.write users.read offline.access',
        state: 'test'
      }
    });
    console.log('✅ OAuth endpoint is accessible');
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('✅ OAuth endpoint is accessible (400 expected for test request)');
    } else {
      console.log('❌ OAuth endpoint issue:', error.message);
      return false;
    }
  }
  
  console.log('\n🧪 Test 2: OAuth flow ready');
  console.log('💡 To complete OAuth, visit:');
  console.log('   http://localhost:4001/oauth2/start/twitter?userId=test-user');
  
  return true;
}

async function main() {
  console.log('🚀 Starting Comprehensive Twitter Test...\n');
  
  const args = process.argv.slice(2);
  const forceOAuth = args.includes('--oauth');
  const forceDirect = args.includes('--direct');
  
  let success = false;
  
  // Test 1: Direct token (if forced or available)
  if (forceDirect || (!forceOAuth && process.env.TWITTER_TEST_ACCESS_TOKEN)) {
    success = await testTwitterDirect();
    if (success) {
      console.log('\n🎉 Twitter direct token test completed successfully!');
      process.exit(0);
    }
  }
  
  // Test 2: Database tokens (if available)
  if (!success && !forceOAuth) {
    success = await testTwitterDatabase();
    if (success) {
      console.log('\n🎉 Twitter database token test completed successfully!');
      process.exit(0);
    }
  }
  
  // Test 3: OAuth configuration
  if (!success || forceOAuth) {
    success = await testTwitterOAuth();
    if (success) {
      console.log('\n📝 Twitter OAuth is configured and ready');
      console.log('💡 Complete the OAuth flow to test posting');
    }
  }
  
  if (!success) {
    console.log('\n❌ All Twitter tests failed');
    console.log('💡 Please check your Twitter configuration');
    process.exit(1);
  }
  
  console.log('\n✅ Twitter test completed');
  process.exit(0);
}

// Run the test
main().catch((error) => {
  console.error('💥 Test failed:', error);
  process.exit(1);
});
