# 🚀 Repostly - Real API Setup Quick Reference

## 📋 **Ready-to-Use Setup Script**

I've created a comprehensive setup script that will guide you through the entire process:

```bash
./setup-real-apis.sh
```

## 🎯 **What the Script Does:**

✅ **Interactive Setup** - Guides you through each platform step-by-step  
✅ **Validates Input** - Checks your API keys for correct format  
✅ **Tests Connections** - Verifies your APIs work before saving  
✅ **Auto-Configures** - Updates your `.env` file automatically  
✅ **Creates Backups** - Safely backs up your existing configuration  
✅ **Provides Instructions** - Shows exact steps for each platform  

## 🔑 **Required Information for Each Platform:**

### **Instagram & Facebook:**
- **App ID** (from Facebook Developers → Settings → Basic)
- **App Secret**
- **API URL** (default: https://graph.facebook.com/v18.0)
- For Facebook OAuth in dev, set:
  - `FACEBOOK_REDIRECT_URI=http://localhost:4001/api/auth/facebook/oauth/callback/facebook`
  - `STATE_HMAC_SECRET=<random_long_secret>`

### **TikTok:**
- **App ID** (from TikTok for Developers dashboard)
- **Access Token** (from TikTok for Developers dashboard)
- **API URL** (default: https://open.tiktokapis.com/v2)

### **LinkedIn:**
- **App ID** (from LinkedIn Developers dashboard)
- **Access Token** (from LinkedIn Developers dashboard)
- **API URL** (default: https://api.linkedin.com/v2)

### **Twitter:**
- **App ID** (from Twitter Developer Portal)
- **Access Token** (from Twitter Developer Portal)
- **API URL** (default: https://api.twitter.com/2)

### **YouTube:**
- **App ID** (from Google Cloud Console)
- **Access Token** (from Google Cloud Console)
- **API URL** (default: https://www.googleapis.com/youtube/v3)

## 🚀 **How to Use:**

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

## ⚠️ **Important Prerequisites:**

### **Before running the script, make sure you have:**
- ✅ Facebook Developer account (for Instagram/Facebook)
- ✅ TikTok for Developers account
- ✅ LinkedIn Developers account
- ✅ Twitter Developer account
- ✅ Google Cloud account (for YouTube)

### **Account Requirements:**
- **Instagram**: Must be a Business or Creator account
- **Facebook**: Must have a Facebook Page
- **TikTok**: Must have a TikTok Business account
- **LinkedIn**: Must have a LinkedIn Page
- **Twitter**: Must have a Twitter Developer account
- **YouTube**: Must have a YouTube channel

## 🔧 **Manual Setup (Alternative):**

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
FACEBOOK_REDIRECT_URI=http://localhost:4001/api/auth/facebook/oauth/callback/facebook
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

## 🎉 **After Setup:**

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

## 🔒 **Security Notes:**

- **Never commit your `.env` file** to version control
- **Access tokens expire** - you'll need to refresh them periodically
- **Keep your credentials secure**
- **Use different tokens** for development and production

## 🆘 **Need Help?**

If you encounter issues:

1. **Check the logs:**
   ```bash
   tail -f back/node-backend.log
   ```

2. **Verify your credentials** in the developer portals

3. **Test your APIs manually** using curl or Postman

4. **Check platform-specific requirements** (Business accounts, etc.)

---

**🎯 The setup script makes this process much easier - just run `./setup-real-apis.sh` and follow the prompts!**
