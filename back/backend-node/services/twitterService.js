/* eslint-disable no-console */
const { TwitterApi } = require('twitter-api-v2');
const axios = require('axios');

// Token management
let currentAccessToken = null;
let currentRefreshToken = null;
let tokenExpiryTime = null;

function getTwitterClient(accessToken) {
  if (!accessToken) throw new Error('Missing Twitter access token');
  return new TwitterApi(accessToken);
}

/**
 * Refresh the access token using the refresh token
 */
async function refreshAccessToken(refreshToken) {
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  try {
    const clientId = process.env.TWITTER_CLIENT_ID;
    const clientSecret = process.env.TWITTER_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      throw new Error('Twitter client credentials not configured');
    }

    // Create Basic Auth header
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    const response = await axios.post('https://api.x.com/2/oauth2/token', 
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      }), 
      {
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const { access_token, refresh_token, expires_in } = response.data;
    
    // Update stored tokens
    currentAccessToken = access_token;
    currentRefreshToken = refresh_token || refreshToken; // Use new refresh token if provided
    tokenExpiryTime = Date.now() + (expires_in * 1000);
    
    console.log('[Twitter] Token refreshed successfully');
    return access_token;
  } catch (error) {
    console.error('[Twitter] Token refresh failed:', error.response?.data || error.message);
    throw new Error('Failed to refresh access token');
  }
}

/**
 * Get a valid access token, refreshing if necessary
 */
async function getValidAccessToken(accessToken, refreshToken) {
  // If no stored tokens, use provided ones
  if (!currentAccessToken) {
    currentAccessToken = accessToken;
    currentRefreshToken = refreshToken;
    // Set expiry to 2 hours from now (default Twitter token expiry)
    tokenExpiryTime = Date.now() + (7200 * 1000);
  }

  // Check if token is expired or will expire soon (within 5 minutes)
  const fiveMinutesFromNow = Date.now() + (5 * 60 * 1000);
  
  if (tokenExpiryTime && tokenExpiryTime < fiveMinutesFromNow) {
    console.log('[Twitter] Access token expired or expiring soon, refreshing...');
    try {
      return await refreshAccessToken(currentRefreshToken);
    } catch (error) {
      console.error('[Twitter] Failed to refresh token, using current token:', error.message);
      return currentAccessToken;
    }
  }

  return currentAccessToken;
}

async function whoAmI(accessToken) {
  const client = getTwitterClient(accessToken);
  const me = await client.v2.me();
  return me.data;
}

/**
 * Posts a tweet to Twitter with auto token refresh.
 * @param {string} accessToken User's Twitter access token
 * @param {string} text Tweet text content
 * @param {string} mediaUrl Optional media URL to attach
 * @param {string} refreshToken Optional refresh token for auto-renewal
 */
async function postTweet(accessToken, text, mediaUrl = null, refreshToken = null) {
  try {
    // Get valid access token (refresh if needed)
    const validToken = await getValidAccessToken(accessToken, refreshToken);
    const client = getTwitterClient(validToken);
    
    let mediaId = null;
    
    // Upload media if provided
    if (mediaUrl) {
      console.log('[Twitter] Uploading media:', mediaUrl);
      const mediaUpload = await client.v1.uploadMedia(mediaUrl);
      mediaId = mediaUpload;
    }

    // Create tweet parameters
    const tweetParams = { text };
    if (mediaId) {
      tweetParams.media = { media_ids: [mediaId] };
    }

    console.log('[Twitter] Posting tweet:', text.slice(0, 100) + '...');
    
    // Post the tweet
    const tweet = await client.v2.tweet(tweetParams);
    
    return {
      success: true,
      tweetId: tweet.data.id,
      text: tweet.data.text,
      url: `https://twitter.com/user/status/${tweet.data.id}`,
      message: 'Tweet posted successfully'
    };
  } catch (error) {
    console.error('[Twitter] Error posting tweet:', error.message);
    
    // If it's an auth error, try to refresh token and retry once
    if (error.message.includes('401') && refreshToken) {
      console.log('[Twitter] Auth error, attempting token refresh and retry...');
      try {
        const newToken = await refreshAccessToken(refreshToken);
        const client = getTwitterClient(newToken);
        
        // Retry the tweet with new token
        const tweetParams = { text };
        if (mediaUrl) {
          const mediaUpload = await client.v1.uploadMedia(mediaUrl);
          tweetParams.media = { media_ids: [mediaUpload] };
        }
        
        const tweet = await client.v2.tweet(tweetParams);
        return {
          success: true,
          tweetId: tweet.data.id,
          text: tweet.data.text,
          url: `https://twitter.com/user/status/${tweet.data.id}`,
          message: 'Tweet posted successfully (after token refresh)'
        };
      } catch (refreshError) {
        console.error('[Twitter] Retry failed after token refresh:', refreshError.message);
      }
    }
    
    // Provide more specific error messages
    let errorMessage = error.message;
    if (error.message.includes('403')) {
      errorMessage = 'Twitter access denied. Please check your access token and permissions.';
    } else if (error.message.includes('401')) {
      errorMessage = 'Twitter authentication failed. Please refresh your access token.';
    } else if (error.message.includes('400')) {
      errorMessage = 'Invalid tweet content. Please check your text and media.';
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Posts a tweet with media from URL.
 * @param {string} accessToken User's Twitter access token
 * @param {Object} content { text, mediaUrl?, hashtags? }
 * @param {string} refreshToken Optional refresh token for auto-renewal
 */
async function createPost(accessToken, content, refreshToken = null) {
  const { text, mediaUrl, hashtags } = content;
  
  // Build tweet text with hashtags
  let tweetText = text || '';
  if (hashtags && Array.isArray(hashtags) && hashtags.length > 0) {
    const hashtagString = hashtags
      .map(tag => tag.startsWith('#') ? tag : `#${tag}`)
      .join(' ');
    tweetText = tweetText ? `${tweetText} ${hashtagString}` : hashtagString;
  }

  // Validate tweet length (Twitter limit is 280 characters)
  if (tweetText.length > 280) {
    return {
      success: false,
      error: `Tweet exceeds 280 character limit (${tweetText.length} characters)`
    };
  }

  return await postTweet(accessToken, tweetText, mediaUrl, refreshToken);
}

module.exports = { 
  getTwitterClient, 
  whoAmI, 
  postTweet, 
  createPost, 
  refreshAccessToken,
  getValidAccessToken 
};