# Twitter Service Usage Examples

Your Twitter service has been updated to support flexible user identification. Here's how to use it:

## Updated Interface

All Twitter service functions now accept an `identifier` object instead of a simple string:

```javascript
// OLD way (deprecated)
await postTweet('user-123', 'Hello world');

// NEW way (recommended)
await postTweet({ userId: 'user-123' }, 'Hello world');
// OR
await postTweet({ twitterUserId: '175496790084' }, 'Hello world');
```

## Available Functions

### 1. `postTweet(identifier, text)`
Posts a tweet with automatic token refresh and retry logic.

```javascript
const { postTweet } = require('./services/twitterService');

// Using app user ID (if you still have it)
await postTweet({ userId: 'app-user-123' }, 'Hello world!');

// Using Twitter user ID (recommended if Clerk is separate)
await postTweet({ twitterUserId: '175496790084' }, 'Hello world!');
```

### 2. `getValidAccessToken(identifier)`
Gets a valid access token, refreshing if needed.

```javascript
const { getValidAccessToken } = require('./services/twitterService');

const token = await getValidAccessToken({ userId: 'user-123' });
// Returns: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 3. `refreshAccessToken(identifier)`
Manually refreshes the access token.

```javascript
const { refreshAccessToken } = require('./services/twitterService');

const newToken = await refreshAccessToken({ userId: 'user-123' });
```

### 4. `findToken(identifier)`
Finds a token document in the database.

```javascript
const { findToken } = require('./services/twitterService');

const tokenDoc = await findToken({ userId: 'user-123' });
// Returns: TwitterToken document or null
```

### 5. `getTwitterHandle(identifier)`
Gets the Twitter handle for a user.

```javascript
const { getTwitterHandle } = require('./services/twitterService');

const handle = await getTwitterHandle({ userId: 'user-123' });
// Returns: "johndoe" or "unknown"
```

## Identifier Options

The `identifier` object supports two properties:

### `userId` (String)
- Your app's internal user ID
- Used when you have the user's ID from your database
- Example: `{ userId: 'clerk-user-123' }`

### `twitterUserId` (String)
- Twitter's internal user ID
- More reliable for Twitter API operations
- Example: `{ twitterUserId: '175496790084' }`

## Priority Logic

When both `userId` and `twitterUserId` are provided, the service prefers `twitterUserId`:

```javascript
// This will use twitterUserId
await postTweet({ 
  userId: 'app-user-123', 
  twitterUserId: '175496790084' 
}, 'Hello world!');
```

## Error Handling

The service includes comprehensive error handling:

```javascript
try {
  const result = await postTweet({ userId: 'user-123' }, 'Hello world!');
  console.log('Tweet posted:', result.data.id);
} catch (error) {
  if (error.message === 'Twitter not connected for this user') {
    // User needs to connect their Twitter account
    console.log('Please connect your Twitter account first');
  } else if (error.message === 'TWITTER_REVOKED') {
    // User revoked access, need to re-authenticate
    console.log('Twitter access was revoked, please reconnect');
  } else {
    // Other error
    console.error('Twitter error:', error.message);
  }
}
```

## Integration Examples

### In Platform Publisher
```javascript
// In platformPublisher.js - already updated
const result = await postTweet({ userId }, finalText);
```

### In Controllers
```javascript
// In a controller
const { postTweet } = require('../services/twitterService');

exports.publishToTwitter = async (req, res) => {
  try {
    const { userId, text } = req.body;
    const result = await postTweet({ userId }, text);
    
    res.json({
      success: true,
      tweetId: result.data.id,
      url: `https://twitter.com/user/status/${result.data.id}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

### In Tests
```javascript
// In test files
const { postTweet, getValidAccessToken } = require('./services/twitterService');

// Test with userId
const result = await postTweet({ userId: tokenDoc.userId }, testMessage);

// Test with twitterUserId
const result = await postTweet({ twitterUserId: tokenDoc.twitterUserId }, testMessage);
```

## Migration Guide

If you have existing code using the old interface:

1. **Find all calls** to Twitter service functions
2. **Wrap the first parameter** in an object with `userId` or `twitterUserId`
3. **Test thoroughly** to ensure tokens are found correctly

### Before (Old Interface)
```javascript
await postTweet('user-123', 'Hello world');
await getValidAccessToken('user-123');
await refreshAccessToken('user-123');
```

### After (New Interface)
```javascript
await postTweet({ userId: 'user-123' }, 'Hello world');
await getValidAccessToken({ userId: 'user-123' });
await refreshAccessToken({ userId: 'user-123' });
```

## Schema Requirements

Make sure your `TwitterToken` model has the correct fields:

```javascript
// models/TwitterToken.js
const TwitterTokenSchema = new mongoose.Schema({
  userId: { 
    type: String, // Store as String if Clerk IDs
    required: true, 
    index: true 
  },
  twitterUserId: { 
    type: String, 
    index: true, 
    unique: true 
  }, // Twitter's internal user ID
  handle: { type: String }, // Twitter username
  name: { type: String },   // Twitter display name
  
  // OAuth2 tokens
  accessToken: { type: String, required: true },
  refreshToken: { type: String, required: true },
  tokenType: { type: String, default: 'bearer' },
  scope: { type: String },
  expiresAt: { type: Date, required: true },
  
  provider: { type: String, default: 'twitter' }
});
```

## Benefits of the New Interface

1. **Flexibility**: Support both app user IDs and Twitter user IDs
2. **Future-proof**: Easy to add more identifier types
3. **Clarity**: Explicit about which type of ID is being used
4. **Consistency**: All functions use the same identifier pattern
5. **Better error handling**: More specific error messages based on identifier type
6. **Better indexing**: Proper database indexes for efficient queries
