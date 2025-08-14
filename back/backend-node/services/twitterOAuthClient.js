const { TwitterApi } = require('twitter-api-v2');

const {
  TWITTER_CLIENT_ID,
  TWITTER_CLIENT_SECRET,
  TWITTER_REDIRECT_URI
} = process.env;

// Create Twitter client for OAuth
const client = new TwitterApi({
  clientId: TWITTER_CLIENT_ID,
  clientSecret: TWITTER_CLIENT_SECRET,
});

module.exports = { client, TWITTER_REDIRECT_URI };
