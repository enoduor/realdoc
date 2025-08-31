# 🚀 CreatorSync - Complete Documentation

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Authentication Setup (Clerk)](#authentication-setup-clerk)
3. [API Setup Quick Reference](#api-setup-quick-reference)
4. [Real API Integration Guide](#real-api-integration-guide)
5. [Platform Limits & Requirements](#platform-limits--requirements)
6. [Twitter Service Usage](#twitter-service-usage)
7. [Project Features & Flows](#project-features--flows)
8. [Architecture Overview](#architecture-overview)
9. [Development Workflow](#development-workflow)

---

## 🎯 Project Overview

CreatorSync is a multi-platform social media publishing application that allows users to create, preview, and publish content across multiple social media platforms from a single interface.

### **Current Status**
- **LinkedIn**: ✅ Fully working - OAuth, publishing, URL generation
- **Twitter**: 🔧 In development - OAuth working, publishing needs testing
- **Instagram**: 📋 Planned
- **Facebook**: 📋 Planned
- **TikTok**: 📋 Planned
- **YouTube**: 📋 Planned

### **Architecture**
- **Frontend**: React.js with Clerk authentication
- **Backend**: Node.js with Express.js
- **Database**: MongoDB Atlas
- **AI Services**: Python FastAPI backend for caption/hashtag generation
- **Authentication**: Clerk for user management
- **File Storage**: AWS S3 for media uploads

---

## 🔐 Authentication Setup (Clerk)

### 🚀 Quick Setup (5 minutes)

#### Step 1: Create Clerk Account
1. Go to [https://clerk.com/](https://clerk.com/)
2. Click "Start building for free"
3. Create your account

#### Step 2: Create New Application
1. Click "Add application"
2. Choose "Web application"
3. Name it "CreatorSync"
4. Select your preferred sign-in methods (Email, Google, GitHub, etc.)

#### Step 3: Get Your Keys
1. Go to "API Keys" in your Clerk dashboard
2. Copy the **Publishable Key** (starts with `pk_test_`)

#### Step 4: Configure Environment Variables

**Frontend (.env file in frontend/ directory):**
```bash
REACT_APP_CLERK_PUBLISHABLE_KEY=pk_test_your_actual_key_here
REACT_APP_API_URL=http://localhost:4001
REACT_APP_PYTHON_API_URL=http://localhost:5001
```

**Backend (.env file in back/backend-node/ directory):**
```bash
CLERK_JWT_KEY=your_jwt_key_from_clerk_dashboard
CLERK_ISSUER_URL=https://clerk.your-app.com
CLERK_AUDIENCE=http://localhost:3000
MONGODB_URI=mongodb://localhost:27017/creatorsync
JWT_SECRET=your_jwt_secret_here
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
PORT=4001
```

#### Step 5: Configure Allowed Origins
1. In Clerk dashboard, go to "Settings" → "Domains"
2. Add `http://localhost:3000` for development
3. Add your production domain when ready

#### Step 6: Start the App
```bash
# Terminal 1: Start backend
cd back/backend-node && npm start

# Terminal 2: Start frontend
cd frontend && npm start
```

### 🎯 Features You Get with Clerk

#### ✅ Built-in Security
- **Multifactor Authentication** (MFA)
- **Fraud & Abuse Prevention**
- **SOC 2 Type 2 Compliant**
- **Session Management**
- **Device Management**

#### ✅ Social Sign-On
- Google, GitHub, Twitter, Facebook
- 20+ providers available
- Easy to add/remove

#### ✅ User Management
- **Email Verification**
- **Password Reset**
- **Profile Management**
- **Organization Support** (for B2B)

#### ✅ Developer Experience
- **Pre-built UI Components**
- **Customizable Styling**
- **TypeScript Support**
- **Webhooks**

### 🔧 Customization

#### Styling
Edit `frontend/src/components/Auth/ClerkLogin.jsx` and `ClerkRegister.jsx` to match your brand:

```javascript
appearance={{
  elements: {
    formButtonPrimary: 'bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md w-full',
    // Add more custom styles here
  }
}}
```

#### Sign-in Methods
In Clerk dashboard:
1. Go to "User & Authentication" → "Email, Phone, Username"
2. Enable/disable sign-in methods
3. Configure social providers

### 🚀 Production Deployment

#### Environment Variables
Update your production environment variables:
```bash
REACT_APP_CLERK_PUBLISHABLE_KEY=pk_live_your_production_key
CLERK_ISSUER_URL=https://clerk.your-production-domain.com
CLERK_AUDIENCE=https://your-production-domain.com
```

#### Domains
Add your production domain to Clerk:
1. Go to "Settings" → "Domains"
2. Add your production domain
3. Update redirect URLs

### 🔍 Troubleshooting

#### Common Issues

**1. "Invalid token" errors**
- Check your `CLERK_JWT_KEY` is correct
- Verify `CLERK_ISSUER_URL` matches your Clerk instance
- Ensure `CLERK_AUDIENCE` matches your frontend URL

**2. CORS errors**
- Add your frontend URL to Clerk's allowed origins
- Check your backend CORS configuration

**3. Redirect loops**
- Verify redirect URLs in Clerk dashboard
- Check your route configuration

#### Support
- [Clerk Documentation](https://clerk.com/docs)
- [Clerk Discord](https://discord.gg/clerk)
- [Clerk Support](https://clerk.com/support)

---

## 🚀 API Setup Quick Reference

### 📋 **Ready-to-Use Setup Script**

I've created a comprehensive setup script that will guide you through the entire process:

```bash
./setup-real-apis.sh
```

### 🎯 **What the Script Does:**

✅ **Interactive Setup** - Guides you through each platform step-by-step  
✅ **Validates Input** - Checks your API keys for correct format  
✅ **Tests Connections** - Verifies your APIs work before saving  
✅ **Auto-Configures** - Updates your `.env` file automatically  
✅ **Creates Backups** - Safely backs up your existing configuration  
✅ **Provides Instructions** - Shows exact steps for each platform  

### 🔑 **Required Information for Each Platform:**

#### **Instagram & Facebook:**
- **App ID** (from Facebook Developers → Settings → Basic)
- **App Secret**
- **API URL** (default: https://graph.facebook.com/v18.0)
- For Facebook OAuth in dev, set:
  - `FACEBOOK_REDIRECT_URI=http://localhost:4001/api/facebook/oauth/callback/facebook`
  - `STATE_HMAC_SECRET=<random_long_secret>`

#### **TikTok:**
- **App ID** (from TikTok for Developers dashboard)
- **Access Token** (from TikTok for Developers dashboard)
- **API URL** (default: https://open.tiktokapis.com/v2)

#### **LinkedIn:**
- **App ID** (from LinkedIn Developers dashboard)
- **Access Token** (from LinkedIn Developers dashboard)
- **API URL** (default: https://api.linkedin.com/v2)

#### **Twitter:**
- **App ID** (from Twitter Developer Portal)
- **Access Token** (from Twitter Developer Portal)
- **API URL** (default: https://api.twitter.com/2)

#### **YouTube:**
- **App ID** (from Google Cloud Console)
- **Access Token** (from Google Cloud Console)
- **API URL** (default: https://www.googleapis.com/youtube/v3)

### 🚀 **How to Use:**

1. **Run the script:**
   ```bash
   ./setup-real-apis.sh
   ```

2. **Follow the prompts** for each platform you want to set up

3. **Get your API credentials** from the developer portals (script provides links)

4. **Enter your credentials** when prompted

5. **Test the connections** (script does this automatically)

6. **Restart your app:**
   ```bash
   ./start-app.sh
   ```

### ⚠️ **Important Prerequisites:**

#### **Before running the script, make sure you have:**
- ✅ Facebook Developer account (for Instagram/Facebook)
- ✅ TikTok for Developers account
- ✅ LinkedIn Developers account
- ✅ Twitter Developer account
- ✅ Google Cloud account (for YouTube)

#### **Account Requirements:**
- **Instagram**: Must be a Business or Creator account
- **Facebook**: Must have a Facebook Page
- **TikTok**: Must have a TikTok Business account
- **LinkedIn**: Must have a LinkedIn Page
- **Twitter**: Must have a Twitter Developer account
- **YouTube**: Must have a YouTube channel

### 🔧 **Manual Setup (Alternative):**

If you prefer to set up manually, add these to your `back/backend-node/.env`:

```bash
# Instagram API
INSTAGRAM_API_URL=https://graph.facebook.com/v18.0
INSTAGRAM_ACCESS_TOKEN=your_instagram_access_token_here
INSTAGRAM_APP_ID=your_facebook_app_id_here

# Facebook API (OAuth)
FACEBOOK_API_URL=https://graph.facebook.com/v18.0
FACEBOOK_APP_ID=your_facebook_app_id_here
FACEBOOK_APP_SECRET=your_facebook_app_secret_here
FACEBOOK_REDIRECT_URI=http://localhost:4001/api/facebook/oauth/callback/facebook
STATE_HMAC_SECRET=replace_with_random_long_secret

# TikTok API
TIKTOK_API_URL=https://open.tiktokapis.com/v2
TIKTOK_ACCESS_TOKEN=your_tiktok_access_token_here
TIKTOK_APP_ID=your_tiktok_app_id_here

# LinkedIn API
LINKEDIN_API_URL=https://api.linkedin.com/v2
LINKEDIN_ACCESS_TOKEN=your_linkedin_access_token_here
LINKEDIN_APP_ID=your_linkedin_app_id_here

# Twitter API
TWITTER_API_URL=https://api.twitter.com/2
TWITTER_ACCESS_TOKEN=your_twitter_access_token_here
TWITTER_APP_ID=your_twitter_app_id_here

# YouTube API
YOUTUBE_API_URL=https://www.googleapis.com/youtube/v3
YOUTUBE_ACCESS_TOKEN=your_youtube_access_token_here
YOUTUBE_APP_ID=your_youtube_app_id_here
```

### 🎉 **After Setup:**

1. **Restart your app:**
   ```bash
   ./start-app.sh
   ```

2. **Test the APIs:**
   - Go to http://localhost:3000
   - Navigate to the Scheduler
   - Try posting to your configured platforms

3. **Check logs for any issues:**
   ```bash
   tail -f back/node-backend.log
   ```

### 🔒 **Security Notes:**

- **Never commit your `.env` file** to version control
- **Access tokens expire** - you'll need to refresh them periodically
- **Keep your credentials secure**
- **Use different tokens** for development and production

### 🆘 **Need Help?**

If you encounter issues:

1. **Check the logs:**
   ```bash
   tail -f back/node-backend.log
   ```

2. **Verify your credentials** in the developer portals

3. **Test your APIs manually** using curl or Postman

4. **Check platform-specific requirements** (Business accounts, etc.)

---

## 🔌 Real API Integration Guide

### 🎯 Goal: Replace Simulation with Real API Integration

### **Platform Priority (Recommended Order):**
1. **Instagram** (Most popular for creators)
2. **TikTok** (Fastest growing)
3. **LinkedIn** (Professional content)
4. **Twitter/X** (News/updates)
5. **YouTube** (Video content)
6. **Facebook** (Wide audience)

---

### 📱 **1. Instagram Graph API**

#### **Setup Steps:**
1. **Create Facebook App:**
   - Go to [Facebook Developers](https://developers.facebook.com/)
   - Create New App → Business
   - Add Instagram Basic Display

2. **Get Access Token:**
   ```bash
   # Add to back/backend-node/.env
   INSTAGRAM_API_URL=https://graph.facebook.com/v18.0
   INSTAGRAM_ACCESS_TOKEN=your_instagram_token
   INSTAGRAM_APP_ID=your_app_id
   INSTAGRAM_APP_SECRET=your_app_secret
   ```

3. **Permissions Needed:**
   - `instagram_basic`
   - `instagram_content_publish`
   - `pages_show_list`

---

### 🎵 **2. TikTok API**

#### **Setup Steps:**
1. **Create TikTok App:**
   - Go to [TikTok for Developers](https://developers.tiktok.com/)
   - Create App → Web App
   - Enable Content Publishing

2. **Get Access Token:**
   ```bash
   # Add to back/backend-node/.env
   TIKTOK_API_URL=https://open.tiktokapis.com/v2
   TIKTOK_ACCESS_TOKEN=your_tiktok_token
   TIKTOK_CLIENT_KEY=your_client_key
   TIKTOK_CLIENT_SECRET=your_client_secret
   ```

3. **Permissions Needed:**
   - `video.publish`
   - `video.upload`

---

### 💼 **3. LinkedIn API**

#### **Setup Steps:**
1. **Create LinkedIn App:**
   - Go to [LinkedIn Developers](https://www.linkedin.com/developers/)
   - Create App
   - Request Access to Marketing APIs

2. **Get Access Token:**
   ```bash
   # Add to back/backend-node/.env
   LINKEDIN_API_URL=https://api.linkedin.com/v2
   LINKEDIN_ACCESS_TOKEN=your_linkedin_token
   LINKEDIN_CLIENT_ID=your_client_id
   LINKEDIN_CLIENT_SECRET=your_client_secret
   ```

3. **Permissions Needed:**
   - `w_member_social`
   - `r_liteprofile`

---

### 🐦 **4. Twitter/X API**

#### **Setup Steps:**
1. **Create Twitter App:**
   - Go to [Twitter Developer Portal](https://developer.twitter.com/)
   - Create App
   - Apply for Elevated Access

2. **Get Access Token:**
   ```bash
   # Add to back/backend-node/.env
   TWITTER_API_URL=https://api.twitter.com/2
   TWITTER_ACCESS_TOKEN=your_twitter_token
   TWITTER_API_KEY=your_api_key
   TWITTER_API_SECRET=your_api_secret
   ```

3. **Permissions Needed:**
   - `tweets.write`
   - `tweets.read`

---

### 📺 **5. YouTube API**

#### **Setup Steps:**
1. **Create Google Cloud Project:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Enable YouTube Data API v3
   - Create OAuth 2.0 credentials

2. **Get Access Token:**
   ```bash
   # Add to back/backend-node/.env
   YOUTUBE_API_URL=https://www.googleapis.com/youtube/v3
   YOUTUBE_ACCESS_TOKEN=your_youtube_token
   YOUTUBE_CLIENT_ID=your_client_id
   YOUTUBE_CLIENT_SECRET=your_client_secret
   ```

3. **Permissions Needed:**
   - `youtube.upload`
   - `youtube.readonly`

---

### 📘 **6. Facebook API**

#### **Setup Steps (Final):**
1. **Facebook App & Roles:**
   - Use your Facebook App (same as Instagram ok)
   - Add Facebook Login product
   - In Dev mode, add your FB profile as Administrator/Developer/Tester

2. **Redirect URI (Dev):**
   - `http://localhost:4001/api/facebook/oauth/callback/facebook`
   - Note: localhost redirects are auto-allowed in Dev mode

3. **Environment (.env):**
   ```bash
   # Facebook API
   FACEBOOK_API_URL=https://graph.facebook.com/v18.0
   FACEBOOK_APP_ID=your_app_id
   FACEBOOK_APP_SECRET=your_app_secret
   FACEBOOK_REDIRECT_URI=http://localhost:4001/api/facebook/oauth/callback/facebook
   STATE_HMAC_SECRET=replace_with_random_long_secret
   ```

4. **Scopes Requested:**
   - `public_profile`
   - `email`
   - `pages_manage_posts`
   - `pages_read_engagement`
   - `pages_show_list`

5. **How to Run OAuth (Dev):**
   - Ensure you're logged in at `http://localhost:3000` (Clerk session)
   - Start: `http://localhost:4001/api/facebook/oauth/start/facebook` (Clerk-secured)
   - Optional test route (no Clerk): `/api/facebook/oauth/start/facebook/test?userId=...&email=...`

6. **What Gets Stored (MongoDB):**
   - `FacebookToken`: `userId`, `email`, `facebookUserId`, `accessToken` (long-lived), `name`, `isActive`, optional `pageId/pageName/pageAccessToken`, timestamps

7. **Publishing Notes:**
   - Publisher uses `facebookService` permalink from Graph API (`permalink_url`) when available
   - Fallback URL is built safely if permalink is missing

---

### 🔧 **Implementation Steps**

#### **Step 1: Update Environment Variables**
```bash
# Add to back/backend-node/.env
# Instagram
INSTAGRAM_API_URL=https://graph.facebook.com/v18.0
INSTAGRAM_ACCESS_TOKEN=your_token_here
INSTAGRAM_APP_ID=your_app_id
INSTAGRAM_APP_SECRET=your_app_secret

# TikTok
TIKTOK_API_URL=https://open.tiktokapis.com/v2
TIKTOK_ACCESS_TOKEN=your_token_here
TIKTOK_CLIENT_KEY=your_client_key
TIKTOK_CLIENT_SECRET=your_client_secret

# LinkedIn
LINKEDIN_API_URL=https://api.linkedin.com/v2
LINKEDIN_ACCESS_TOKEN=your_token_here
LINKEDIN_CLIENT_ID=your_client_id
LINKEDIN_CLIENT_SECRET=your_client_secret

# Twitter
TWITTER_API_URL=https://api.twitter.com/2
TWITTER_ACCESS_TOKEN=your_token_here
TWITTER_API_KEY=your_api_key
TWITTER_API_SECRET=your_api_secret

# YouTube
YOUTUBE_API_URL=https://www.googleapis.com/youtube/v3
YOUTUBE_ACCESS_TOKEN=your_token_here
YOUTUBE_CLIENT_ID=your_client_id
YOUTUBE_CLIENT_SECRET=your_client_secret

# Facebook
FACEBOOK_API_URL=https://graph.facebook.com/v18.0
FACEBOOK_ACCESS_TOKEN=your_token_here
FACEBOOK_APP_ID=your_app_id
FACEBOOK_APP_SECRET=your_app_secret
```

#### **Step 2: Update PlatformPublisher Service**
Replace simulation with real API calls in `back/backend-node/services/platformPublisher.js`

#### **Step 3: Add OAuth Flow**
Create OAuth endpoints for user authorization

#### **Step 4: Test Integration**
Test posting to each platform

---

### 🚀 **Production Deployment**

#### **Recommended Platforms:**
1. **Vercel** (Frontend)
2. **Railway** (Backend)
3. **Render** (Backend)
4. **Heroku** (Full stack)

#### **Environment Setup:**
- Set all environment variables in production
- Configure custom domain
- Set up SSL certificates
- Configure CORS for production domain

---

### ⚠️ **Important Notes**

#### **Rate Limits:**
- **Instagram:** 200 calls/hour
- **TikTok:** 1000 calls/day
- **LinkedIn:** 100 calls/day
- **Twitter:** 300 calls/15min
- **YouTube:** 10,000 calls/day
- **Facebook:** 200 calls/hour

#### **Content Restrictions:**
- Each platform has specific content guidelines
- Media format requirements vary
- Character limits are enforced
- Hashtag limits are enforced

#### **Error Handling:**
- Implement retry logic for rate limits
- Handle API errors gracefully
- Log failed posts for debugging
- Provide user feedback

---

### 🎯 **Success Criteria**

✅ **MVP Complete when:**
- [ ] At least 2 platforms integrated (Instagram + TikTok)
- [ ] Real posting works
- [ ] Error handling implemented
- [ ] Production deployment complete
- [ ] Users can successfully post content

**Estimated Time: 2-3 days for basic integration**

---

## 📊 Platform Limits & Requirements

### Official Platform Limits (2024)

#### Instagram ✅
- **Characters**: 2,200
- **Hashtags**: 30
- **Media**: Required for posts
- **Source**: Instagram Official Documentation

#### Twitter/X ✅
- **Characters**: 280
- **Hashtags**: 25 (recommended, no hard limit)
- **Media**: Optional
- **Source**: Twitter Official Documentation

#### LinkedIn ✅
- **Characters**: 3,000
- **Hashtags**: 50 (recommended, no hard limit)
- **Media**: Optional
- **Source**: LinkedIn Official Documentation

#### Facebook ✅
- **Characters**: 63,206
- **Hashtags**: 100 (recommended, no hard limit)
- **Media**: Optional
- **Source**: Facebook Official Documentation

#### TikTok ⚠️ (Varies by region/feature)
- **Characters**: 
  - Caption: 150-2,200 (varies by region)
  - Comments: 150
  - Bio: 80
- **Hashtags**: 20-30 (varies by feature)
- **Media**: Video required
- **Source**: TikTok Official Documentation (varies by region)

#### YouTube ⚠️ (Varies by feature)
- **Description**: 5,000 characters
- **Title**: 100 characters
- **Hashtags**: 15 in title, unlimited in description
- **Media**: Video required
- **Source**: YouTube Official Documentation

### Recommendations

For TikTok and YouTube, it's best to use conservative limits:
- **TikTok**: 150 chars, 20 hashtags (safe limit)
- **YouTube**: 5,000 chars, 15 hashtags (title limit)

---

## 🐦 Twitter Service Usage

Your Twitter service has been updated to support flexible user identification. Here's how to use it:

### Updated Interface

All Twitter service functions now accept an `identifier` object instead of a simple string:

```javascript
// OLD way (deprecated)
await postTweet('user-123', 'Hello world');

// NEW way (recommended)
await postTweet({ userId: 'user-123' }, 'Hello world');
// OR
await postTweet({ twitterUserId: '175496790084' }, 'Hello world');
```

### Available Functions

#### 1. `postTweet(identifier, text)`
Posts a tweet with automatic token refresh and retry logic.

```javascript
const { postTweet } = require('./services/twitterService');

// Using app user ID (if you still have it)
await postTweet({ userId: 'app-user-123' }, 'Hello world!');

// Using Twitter user ID (recommended if Clerk is separate)
await postTweet({ twitterUserId: '175496790084' }, 'Hello world!');
```

#### 2. `getValidAccessToken(identifier)`
Gets a valid access token, refreshing if needed.

```javascript
const { getValidAccessToken } = require('./services/twitterService');

const token = await getValidAccessToken({ userId: 'user-123' });
// Returns: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
```

#### 3. `refreshAccessToken(identifier)`
Manually refreshes the access token.

```javascript
const { refreshAccessToken } = require('./services/twitterService');

const newToken = await refreshAccessToken({ userId: 'user-123' });
```

#### 4. `findToken(identifier)`
Finds a token document in the database.

```javascript
const { findToken } = require('./services/twitterService');

const tokenDoc = await findToken({ userId: 'user-123' });
// Returns: TwitterToken document or null
```

#### 5. `getTwitterHandle(identifier)`
Gets the Twitter handle for a user.

```javascript
const { getTwitterHandle } = require('./services/twitterService');

const handle = await getTwitterHandle({ userId: 'user-123' });
// Returns: "johndoe" or "unknown"
```

### Identifier Options

The `identifier` object supports two properties:

#### `userId` (String)
- Your app's internal user ID
- Used when you have the user's ID from your database
- Example: `{ userId: 'clerk-user-123' }`

#### `twitterUserId` (String)
- Twitter's internal user ID
- More reliable for Twitter API operations
- Example: `{ twitterUserId: '175496790084' }`

### Priority Logic

When both `userId` and `twitterUserId` are provided, the service prefers `twitterUserId`:

```javascript
// This will use twitterUserId
await postTweet({ 
  userId: 'app-user-123', 
  twitterUserId: '175496790084' 
}, 'Hello world!');
```

### Error Handling

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

### Integration Examples

#### In Platform Publisher
```javascript
// In platformPublisher.js - already updated
const result = await postTweet({ userId }, finalText);
```

#### In Controllers
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

#### In Tests
```javascript
// In test files
const { postTweet, getValidAccessToken } = require('./services/twitterService');

// Test with userId
const result = await postTweet({ userId: tokenDoc.userId }, testMessage);

// Test with twitterUserId
const result = await postTweet({ twitterUserId: tokenDoc.twitterUserId }, testMessage);
```

### Migration Guide

If you have existing code using the old interface:

1. **Find all calls** to Twitter service functions
2. **Wrap the first parameter** in an object with `userId` or `twitterUserId`
3. **Test thoroughly** to ensure tokens are found correctly

#### Before (Old Interface)
```javascript
await postTweet('user-123', 'Hello world');
await getValidAccessToken('user-123');
await refreshAccessToken('user-123');
```

#### After (New Interface)
```javascript
await postTweet({ userId: 'user-123' }, 'Hello world');
await getValidAccessToken({ userId: 'user-123' });
await refreshAccessToken({ userId: 'user-123' });
```

### Schema Requirements

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

### Benefits of the New Interface

1. **Flexibility**: Support both app user IDs and Twitter user IDs
2. **Future-proof**: Easy to add more identifier types
3. **Clarity**: Explicit about which type of ID is being used
4. **Consistency**: All functions use the same identifier pattern
5. **Better error handling**: More specific error messages based on identifier type
6. **Better indexing**: Proper database indexes for efficient queries

---

## 🚀 Project Features & Flows

### Media Upload Enhancements
- **Drag and drop upload** - Intuitive file upload interface
- **Multiple file support** - Upload multiple images/videos at once
- **Image preview** - Real-time preview before upload
- **Platform-specific validation** - Validate media against platform requirements
- **Auto-resize/crop options** - Automatic optimization for each platform
- **Progress indicator** - Visual upload progress tracking
- **Error handling** - Comprehensive error messages and recovery
- **Preview in PlatformPreview component** - Integrated preview system

### Social Media Portal
- **Social channels for your business** - Multi-platform management
- **Manage more than one** - Handle multiple accounts per platform
- **New post creation**:
  - Select all social channels
  - Deselect specific platforms
  - Post now option
  - Draft saving
  - Schedule date and time
  - Schedule post to be repeated
- **Post management**:
  - Click a post to view engagement
  - Modify and update scheduled posts
  - Context about hashtags
- **Analytics dashboard** - Monitor stats from social media side by side

### 🔄 Complete System Flows

#### Media Upload Flow

**1. Frontend (MediaUploader.jsx):**
- User selects a file (image or video)
- File is validated for type and size
- Local preview is shown
- On upload button click, file is sent to backend via `axios.post` to `http://localhost:5001/api/v1/upload`
- FormData includes:
  - `file`: The actual file
  - `platform`: Selected platform (instagram, facebook, etc.)

**2. Backend (main.py):**
- Receives request at `/api/v1/upload`
- Routes to media.py through the router configuration:
```python
app.include_router(media_router, prefix="/api/v1", tags=["media"])
```

**3. Backend (media.py):**
- Handles the upload in `upload_media` function
- Processes the file:
  - For images: Resizes according to platform requirements
  - For videos: Uploads as is
- Uploads to S3 using pre-signed URLs
- Returns response with:
  - `url`: Pre-signed S3 URL
  - `type`: Media type (image/video)
  - `dimensions`: For images
  - `filename`: Generated filename

**4. Frontend (MediaUploader.jsx):**
- Receives response
- Updates content context with:
  - `mediaUrl`: S3 URL
  - `mediaType`: Type of media
  - `mediaDimensions`: Dimensions (for images)
- Shows preview using the S3 URL

**5. Frontend (PlatformPreviewPanel.jsx):**
- Displays the media based on type:
  - Images: Shows with platform-specific dimensions
  - Videos: Shows with controls and platform-specific dimensions
- Shows platform requirements and recommendations

#### Caption Generator Flow

**1. Frontend (CaptionGenerator.jsx):**
- Sends POST request to `http://localhost:5001/api/v1/captions`

**2. Backend (main.py):**
- Receives request and routes it to `captions.py`

**3. Backend (captions.py):**
- Validates the platform and request data
- Uses OpenAI helper to generate the caption
- Applies platform-specific character limits
- Stores the caption in memory
- Returns CaptionResponse with generated caption

**4. Response Flow:**
- Response goes back through `main.py` to frontend

**5. Frontend Display:**
- Frontend displays the generated caption in the UI

#### Hashtag Generator Flow

**1. Frontend (HashtagGenerator.jsx):**
- Sends POST request to `http://localhost:5001/api/v1/hashtags`

**2. Backend (main.py):**
- Receives request and routes it to `hashtags.py`

**3. Backend (hashtags.py):**
- Validates the platform and count
- Generates hashtags based on the topic
- Stores hashtags in memory
- Returns HashtagResponse with generated hashtags

**4. Response Flow:**
- Response goes back through `main.py` to frontend

**5. Frontend Display:**
- Frontend displays results in HashtagGenerator.js

#### Dashboard Flow

**1. Authentication Check**
- Checks if user is authenticated via AuthContext

**2. Backend Connection**
- Connects to Node.js backend running on port 4001

**3. Session Management**
- Maintains session via localStorage token

**4. Authentication Redirect**
- If not authenticated, redirects to `/login`
- If authenticated, loads Dashboard component

**5. Feature Grid Display**
- Displays available features in a grid layout
- Each feature links to its respective component

**6. State Management**
- Manages user state and authentication status
- Handles loading states and error conditions

**7. Logout Process**
- Clear localStorage (token and user data)
- Reset user state
- Redirect to login page

---

## 🏗️ Architecture Overview

### Frontend (React)
- **Authentication**: Clerk integration for user management
- **State Management**: Context API for global state
- **Routing**: React Router for navigation
- **API Integration**: Axios for backend communication

### Backend (Node.js)
- **Authentication**: Clerk middleware for token verification
- **Subscription Management**: Stripe integration
- **User Management**: Minimal MongoDB storage for usage tracking
- **API Routes**: RESTful endpoints for all features

### Backend (Python)
- **AI Services**: OpenAI integration for caption and hashtag generation
- **Media Processing**: Image/video optimization and S3 upload
- **Platform Validation**: Platform-specific requirements checking

### External Services
- **Clerk**: User authentication and management
- **Stripe**: Payment processing and subscription management
- **AWS S3**: Media file storage
- **OpenAI**: AI-powered content generation

### 🔄 Request Flow Architecture

Here's a clear end-to-end map of how requests flow through your stack, split into the common journeys you'll actually see in logs:

#### 1) Public Health/Landing (No Auth)
```
1. Browser → GET /
2. Express → hits rate-limit → CORS → custom public-skip → no Clerk auth required
3. Route returns "✅ Node backend is running"
```

#### 2) Protected API Call (Clerk Session Present)
```
1. Browser/Frontend attaches Clerk session (cookie/header) → GET /api/auth/profile
2. Express → rate-limit → CORS → clerkMiddleware() populates req.auth
3. Route guard requireAuth() checks session; if valid → next()
4. Handler queries MongoDB (users collection) by clerkUserId = req.auth().userId
5. MongoDB returns user doc (projection excludes password)
6. Express responds { success: true, profile: ... }
```

#### 3) Social OAuth Connect (e.g., Twitter/YouTube/LinkedIn)
```
1. Browser → GET /api/auth/twitter (or /google, /youtube, etc.)
2. Express route redirects to provider's OAuth consent screen
3. Provider redirects back to your callback (public path under /api/auth/...)
4. Route exchanges code ↔ tokens, stores tokens in MongoDB (scoped to clerkUserId)
5. Express responds/redirects to frontend → "Account connected"
```

#### 4) Stripe Webhook (Billing Events)
```
1. Stripe → POST /webhook (raw body)
2. Express hits /webhook BEFORE express.json() (important)
3. stripeWebhook verifies signature, parses event (invoice.paid, customer.subscription.updated, etc.)
4. Handler updates user's subscription status in MongoDB
5. Respond 200 to Stripe
```

#### 5) Publishing Flow (e.g., Twitter Post)
```
1. Browser → POST /api/publisher/twitter/publish + payload
2. Express → rate-limit → CORS → clerkMiddleware() → requireAuth()
3. Route handler loads user by clerkUserId, pulls provider tokens from DB
4. Publisher service validates payload (caption/media), uploads media if needed, calls platform API
5. Platform API returns post ID/URL → service normalizes result
6. Express responds { success, postId, url, message }
```

#### 6) Debugging Auth (Handy During Dev)
```
1. Browser → GET /api/_debug/auth
2. requireAuth() ensures session
3. Response includes Clerk auth headers + parsed req.auth to confirm who you are
```

### 🏛️ Layer Architecture

**Where each layer sits:**
- **Edge**: Browser/Stripe/Webhooks
- **Gateway**: Express (rate-limit, CORS)
- **Auth**: Clerk (clerkMiddleware globally, requireAuth() per route)
- **Business**: Routes (/api/auth, /api/publisher, social OAuth routes)
- **Integrations**: Stripe webhook, social APIs
- **Data**: MongoDB via Mongoose

### ⚠️ Gotchas Checklist

**Critical Configuration Points:**
- ✅ Stripe webhooks must be mounted before express.json() (you did this)
- ✅ Public paths (/, /ping, /webhook, /oauth2/*) correctly skip Clerk auth
- ✅ All protected routes should use requireAuth() (you did on profile/auth-test/debug)
- ✅ Ensure CORS origin includes your real frontends in prod
- ✅ Mongo connection failures should process.exit(1) (you did)
- ✅ Rate limit tuned for prod (500/15m is generous; tighten in production)

### File Structure
```
creatorsync/
├── frontend/                 # React application
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── context/          # Context providers
│   │   ├── api/              # API service functions
│   │   └── utils/            # Utility functions
├── back/
│   ├── backend-node/         # Node.js backend
│   │   ├── routes/           # API routes
│   │   ├── middleware/       # Authentication middleware
│   │   ├── models/           # Database models
│   │   └── services/         # Business logic
│   └── backend-python/       # Python AI services
│       ├── routes/           # AI API routes
│       ├── utils/            # AI helper functions
│       └── uploads/          # Temporary file storage
```

### Environment Variables
- **Frontend**: Clerk publishable key, API URLs
- **Node.js Backend**: Clerk secret key, Stripe keys, MongoDB URI
- **Python Backend**: OpenAI API key, AWS credentials

### Security Considerations
- JWT token verification for all protected routes
- File type and size validation
- Platform-specific content validation
- Secure file upload with pre-signed URLs
- CORS configuration for cross-origin requests

---

## 🔧 Development Workflow

### Platform Isolation Rules

#### CRITICAL: When working on one platform, DO NOT modify others

**LinkedIn Platform - OFF LIMITS (Working Perfectly):**
- DO NOT modify `back/backend-node/routes/linkedinAuth.js`
- DO NOT modify `back/backend-node/services/linkedinUserService.js`
- DO NOT modify `back/backend-node/models/LinkedInToken.js`
- DO NOT modify LinkedIn-related parts of `platformPublisher.js`
- DO NOT modify LinkedIn publishing routes
- LinkedIn is working perfectly - LEAVE IT ALONE

**Twitter Platform - Safe to Modify:**
- Safe to modify `back/backend-node/routes/twitterAuth.js`
- Safe to modify `back/backend-node/services/twitterService.js`
- Safe to modify `back/backend-node/models/TwitterToken.js`
- Safe to modify Twitter-related parts of `platformPublisher.js`

**Frontend Components - Multi-platform Safe:**
- Safe to modify `frontend/src/components/PlatformPreviewPanel.jsx` (UI improvements)
- Safe to modify `frontend/src/api/index.js` (API integration)
- Safe to modify other frontend components

### General Rules

1. **Always check which platform you're working on before making changes**
2. **If a platform is working, do not touch its files**
3. **Test thoroughly before committing changes**
4. **Focus on one platform at a time**
5. **Document any changes made**

### File Modification Guidelines

**Before modifying any file:**
1. Identify which platform the file belongs to
2. Check if that platform is currently working
3. If working, DO NOT modify
4. If not working or needs improvement, proceed carefully

**When working on Twitter:**
- Focus only on Twitter-related files
- Do not touch LinkedIn files
- Test Twitter functionality thoroughly

**When working on LinkedIn:**
- DO NOT touch LinkedIn files (they work perfectly)
- Focus on other platforms or general improvements

### Testing Requirements

1. **Always test the platform you're modifying**
2. **Verify other platforms still work after changes**
3. **Run the app and test publishing functionality**
4. **Check for any breaking changes**

### Commit Guidelines

1. **Clear commit messages indicating which platform was modified**
2. **Test before committing**
3. **Document any API changes**
4. **Update documentation if needed**

---

## 📈 Future Enhancements

### Analytics Integration
- Social media API integration for real-time stats
- Engagement tracking across platforms
- Performance analytics dashboard
- ROI measurement tools

### Advanced Scheduling
- Bulk scheduling capabilities
- Recurring post patterns
- Optimal posting time suggestions
- A/B testing for content

### Content Optimization
- AI-powered content suggestions
- Trend analysis and hashtag recommendations
- Competitor analysis
- Content performance predictions

### Team Collaboration
- Multi-user access
- Role-based permissions
- Content approval workflows
- Team analytics and reporting

---

## 🎉 You're Ready!

Your CreatorSync application now has comprehensive documentation covering:
- ✅ **Authentication setup** with Clerk
- ✅ **API integration** for all major platforms
- ✅ **Platform limits** and requirements
- ✅ **Service usage** examples
- ✅ **Project features** and flows
- ✅ **Architecture overview**
- ✅ **Development workflow**

Next step: Start implementing real API integrations to complete your MVP! 🚀
