/* eslint-disable no-console */
const { TwitterApi } = require('twitter-api-v2');

function getTwitterClient(accessToken) {
  if (!accessToken) throw new Error('Missing Twitter access token');
  return new TwitterApi(accessToken);
}

async function whoAmI(accessToken) {
  const client = getTwitterClient(accessToken);
  const me = await client.v2.me();
  return me.data;
}

/**
 * Posts a tweet to Twitter.
 * @param {string} accessToken User's Twitter access token
 * @param {string} text Tweet text content
 * @param {string} mediaUrl Optional media URL to attach
 */
async function postTweet(accessToken, text, mediaUrl = null) {
  const client = getTwitterClient(accessToken);
  
  try {
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
 */
async function createPost(accessToken, content) {
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

  return await postTweet(accessToken, tweetText, mediaUrl);
}

module.exports = { getTwitterClient, whoAmI, postTweet, createPost };
