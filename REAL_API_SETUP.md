# Real Social Media API Setup Guide

## 🎯 Goal: Replace Simulation with Real API Integration

### **Platform Priority (Recommended Order):**
1. **Instagram** (Most popular for creators)
2. **TikTok** (Fastest growing)
3. **LinkedIn** (Professional content)
4. **Twitter/X** (News/updates)
5. **YouTube** (Video content)
6. **Facebook** (Wide audience)

---

## 📱 **1. Instagram Graph API**

### **Setup Steps:**
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

## 🎵 **2. TikTok API**

### **Setup Steps:**
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

## 💼 **3. LinkedIn API**

### **Setup Steps:**
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

## 🐦 **4. Twitter/X API**

### **Setup Steps:**
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

## 📺 **5. YouTube API**

### **Setup Steps:**
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

## 📘 **6. Facebook API**

### **Setup Steps:**
1. **Use Same Facebook App:**
   - Same app as Instagram
   - Add Facebook Login

2. **Get Access Token:**
   ```bash
   # Add to back/backend-node/.env
   FACEBOOK_API_URL=https://graph.facebook.com/v18.0
   FACEBOOK_ACCESS_TOKEN=your_facebook_token
   FACEBOOK_APP_ID=your_app_id
   FACEBOOK_APP_SECRET=your_app_secret
   ```

3. **Permissions Needed:**
   - `pages_manage_posts`
   - `pages_read_engagement`

---

## 🔧 **Implementation Steps**

### **Step 1: Update Environment Variables**
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

### **Step 2: Update PlatformPublisher Service**
Replace simulation with real API calls in `back/backend-node/services/platformPublisher.js`

### **Step 3: Add OAuth Flow**
Create OAuth endpoints for user authorization

### **Step 4: Test Integration**
Test posting to each platform

---

## 🚀 **Production Deployment**

### **Recommended Platforms:**
1. **Vercel** (Frontend)
2. **Railway** (Backend)
3. **Render** (Backend)
4. **Heroku** (Full stack)

### **Environment Setup:**
- Set all environment variables in production
- Configure custom domain
- Set up SSL certificates
- Configure CORS for production domain

---

## ⚠️ **Important Notes**

### **Rate Limits:**
- **Instagram:** 200 calls/hour
- **TikTok:** 1000 calls/day
- **LinkedIn:** 100 calls/day
- **Twitter:** 300 calls/15min
- **YouTube:** 10,000 calls/day
- **Facebook:** 200 calls/hour

### **Content Restrictions:**
- Each platform has specific content guidelines
- Media format requirements vary
- Character limits are enforced
- Hashtag limits are enforced

### **Error Handling:**
- Implement retry logic for rate limits
- Handle API errors gracefully
- Log failed posts for debugging
- Provide user feedback

---

## 🎯 **Success Criteria**

✅ **MVP Complete when:**
- [ ] At least 2 platforms integrated (Instagram + TikTok)
- [ ] Real posting works
- [ ] Error handling implemented
- [ ] Production deployment complete
- [ ] Users can successfully post content

**Estimated Time: 2-3 days for basic integration**
