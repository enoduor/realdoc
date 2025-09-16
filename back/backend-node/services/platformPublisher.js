/* eslint-disable no-console */
const axios = require('axios');
const LinkedInService = require('./linkedinService');
const InstagramService = require('./instagramService');
const FacebookService = require('./facebookService');
const TwitterService = require('./twitterService');
const TikTokService = require('./tiktokService');
const YouTubeService = require('./youtubeService');
const { getUserPlatformTokens } = require('../utils/tokenUtils');

// ---- hashtag helpers ----
function extractHashtags(str = '') {
  return Array.from(str.matchAll(/#[\p{L}\p{N}_]+/gu)).map(m => m[0]);
}
function stripHashtags(str = '') {
  return str.replace(/#[\p{L}\p{N}_]+/gu, '').replace(/\s{2,}/g, ' ').trim();
}
function dedupeCaseInsensitive(arr = []) {
  const seen = new Set();
  const out = [];
  for (const t of arr) {
    const k = String(t).toLowerCase();
    if (t && !seen.has(k)) { seen.add(k); out.push(t); }
  }
  return out;
}
// normalize hashtags to PascalCase (first letter uppercase per token)
function normalizeHashtagCase(tag = '') {
  return '#' + tag
    .replace(/^#+/, '') // remove existing #
    .toLowerCase()
    .split(/[\s_-]+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}
// trim and clean final caption
function cleanCaption(str = '') {
  return str.toString().trim().replace(/\s+$/g, '');
}

function cleanCaption(str = '') {
  return str.toString().trim().replace(/\s+$/g, '');
}

// ---- YouTube helper ----
function normalizeYouTubeResult(raw = {}) {
  const videoId =
    raw.postId ||
    raw.videoId ||
    raw.id ||
    raw.result?.postId ||
    raw.result?.videoId ||
    raw.result?.id ||
    null;

  const url =
    raw.url ||
    raw.webUrl ||
    raw.result?.url ||
    (videoId ? `https://www.youtube.com/watch?v=${videoId}` : null);

  const message =
    raw.message ||
    raw.result?.message ||
    'Uploaded to YouTube';

  return { videoId, url, message };
}

class PlatformPublisher {
  constructor() {
    this.platforms = {
      instagram: {
        name: 'Instagram',
        apiUrl: process.env.INSTAGRAM_API_URL,
        token: process.env.INSTAGRAM_ACCESS_TOKEN
      },
      tiktok: {
        name: 'TikTok',
        apiUrl: process.env.TIKTOK_API_URL,
        token: process.env.TIKTOK_ACCESS_TOKEN
      },
      linkedin: {
        name: 'LinkedIn',
        apiUrl: process.env.LINKEDIN_API_URL,
        token: process.env.LINKEDIN_ACCESS_TOKEN
      },
      twitter: {
        name: 'Twitter',
        apiUrl: process.env.TWITTER_API_URL,
        token: process.env.TWITTER_TEST_ACCESS_TOKEN // legacy direct token (optional)
      },
      youtube: {
        name: 'YouTube',
        apiUrl: process.env.YOUTUBE_API_URL,     // optional
        token: process.env.YOUTUBE_ACCESS_TOKEN  // not used with refresh flow
      },
      facebook: {
        name: 'Facebook',
        apiUrl: process.env.FACEBOOK_API_URL,
        token: process.env.FACEBOOK_ACCESS_TOKEN
      }
    };

    // Initialize all platform services
    this.linkedinService = new LinkedInService();
    this.instagramService = new InstagramService();
    this.facebookService = new FacebookService();
    this.twitterService = new TwitterService();
    this.tiktokService = new TikTokService();
    this.youtubeService = new YouTubeService();
  }



  // ===== Main publish switch =====
  async publishToPlatform(platform, postData) {
    try {
      console.log(`📤 Publishing to ${platform}...`);
      console.log(`[Publisher] Platform name: "${platform}"`);
      const platformConfig = this.platforms[platform];
      if (!platformConfig) throw new Error(`Platform ${platform} not configured`);

      this.validatePlatformRequirements(platform, postData);

      // Get user's platform tokens using standardized utility
      const clerkUserId = postData.clerkUserId;
      if (!clerkUserId) {
        throw new Error('clerkUserId is required for platform publishing');
      }

      const userTokens = await getUserPlatformTokens(clerkUserId);
      const platformToken = userTokens[platform];

      if (!platformToken) {
        throw new Error(`No ${platform} token found for user ${clerkUserId}`);
      }

      switch (platform) {
        // ------------ LINKEDIN ------------
        case 'linkedin': {
          console.log('[Publisher] Executing LinkedIn case');
          // Extract from postData (which is the content object)
          const { linkedinUserId, captions, text } = postData || {};
          const identifier = { clerkUserId: clerkUserId };

          if (!clerkUserId) {
            throw new Error('LinkedIn requires authenticated clerkUserId');
          }

          // Handle both string and array inputs for captions
          const captionText = Array.isArray(captions) ? captions[0] || '' : captions || '';
          const message = (captionText || text || '').trim();
          if (!message) throw new Error('LinkedIn post text is empty');

           // Extract mediaUrl and hashtags
          const mediaUrl = postData?.mediaUrl || null;
          const hashtags = Array.isArray(postData?.hashtags) ? postData.hashtags : [];

          console.log('[Publisher][LinkedIn] message.preview =', message.slice(0, 140));
          console.log('[Publisher][LinkedIn] hashtags =', hashtags);
          
          // Call LinkedIn service
          const result = await this.linkedinService.postToLinkedIn(identifier, message, mediaUrl, hashtags);

           // Return standardized format
          return {
            success: true,
            platform,
            postId: result.postId,
            url: result.url,
            message: result.message
          };
        }

  
        // ------------ YOUTUBE ------------
case 'youtube': {
  const { captions, text, mediaUrl, mediaType, hashtags } = postData || {};

  // Token presence was checked earlier; still validate core inputs
  if (!mediaUrl) throw new Error('YouTube requires video content: mediaUrl');

  // Handle both string and array inputs for captions
  const captionText = Array.isArray(captions) ? captions[0] || '' : captions || '';
  const modifiedPostData = { ...postData, caption: captionText };

  // Build title/description/tags consistently
  const { title, description, mediaUrl: formattedMediaUrl, tags, privacyStatus } =
    this.formatContentForPlatform('youtube', modifiedPostData);

  console.log('[Publisher][YouTube] title =', title);
  console.log('[Publisher][YouTube] privacyStatus =', privacyStatus);
  console.log('[Publisher][YouTube] mediaUrl =', formattedMediaUrl);

  // Identifier we pass to the service (it will look up tokens itself or use passed clerkUserId)
  const identifier = { clerkUserId };

  // Call service
  const svcResp = await this.youtubeService.postToYouTube(
    identifier,
    formattedMediaUrl,
    {
      title,
      description,
      tags,
      privacyStatus, // 'public' | 'unlisted' | 'private'
    }
  );

  // Normalize anything the service returns to a single shape
  const { videoId, url, message } = normalizeYouTubeResult(svcResp);

  if (!videoId) {
    // Force a clear failure so the frontend doesn't fall back to generic URL
    throw new Error('YouTube upload completed but no videoId was returned');
  }

  // Return the simple shape your frontend already consumes
  return {
    success: true,
    platform,
    postId: videoId,
    url,
    message,
  };
}

        // ------------ TWITTER ------------
        case 'twitter': {
          // Extract from postData (which is the content object)
          const { clerkUserId, captions, text, mediaUrl } = postData || {};
          
          console.log('[Publisher][Twitter] Debug - postData:', JSON.stringify(postData, null, 2));
          console.log('[Publisher][Twitter] Debug - clerkUserId:', clerkUserId);
          console.log('[Publisher][Twitter] Debug - captions:', captions);
          console.log('[Publisher][Twitter] Debug - text:', text);
          console.log('[Publisher][Twitter] Debug - mediaUrl:', mediaUrl);
          
          if (!clerkUserId) {
            throw new Error('Twitter requires authenticated clerkUserId');
          }

          // Use the platform token we already retrieved (same as other platforms)
          const identifier = { clerkUserId: clerkUserId };

          // Handle both string and array inputs for captions
          const captionText = Array.isArray(captions) ? captions[0] || '' : captions || '';
          const tweetText = (captionText || text || '').trim();
          console.log('[Publisher][Twitter] Debug - tweetText:', tweetText);
          if (!tweetText) throw new Error('Tweet text is empty');

          // Pass mediaUrl directly to postToTwitter - Twitter service handles URL/Buffer conversion
          const result = await this.twitterService.postToTwitter(identifier, tweetText, mediaUrl);
          
          // Twitter service now returns structured object like LinkedIn
          return {
            success: true,
            platform,
            postId: result.postId,
            url: result.url,
            message: result.message
          };
        }

        // ------------ TIKTOK ------------
        case 'tiktok': {
          const { captions, text, mediaUrl, mediaType } = postData || {};
          
          // Use the platform token we already retrieved
          const identifier = { clerkUserId: clerkUserId };

          // Handle both string and array inputs for captions
          const captionText = Array.isArray(captions) ? captions[0] || '' : captions || '';
          const message = (captionText || text || '').trim();
          if (!message) throw new Error('TikTok post text is empty');

          const result = await this.tiktokService.postToTikTok(identifier, message, mediaUrl, mediaType);

          // TikTok service now returns structured object like other platforms
          return {
            success: true,
            platform,
            postId: result.postId,
            url: result.url,
            message: result.message
          };
        }

        // ------------ INSTAGRAM ------------
        case 'instagram': {
          const { captions, text, mediaUrl, mediaType, hashtags } = postData || {};
          
          // Use the platform token we already retrieved
          const identifier = { clerkUserId: clerkUserId };

          // Handle both string and array inputs for captions
          const captionText = Array.isArray(captions) ? captions[0] || '' : captions || '';
          const safeCaption = (captionText || text || '').toString().trim();
          const tagString = Array.isArray(hashtags) && hashtags.length
            ? hashtags.map(t => `#${(t ?? '').toString().replace(/^#+/, '')}`).join(' ')
            : '';
          const message = [safeCaption, tagString].filter(Boolean).join(' ').trim();

          if (!message) throw new Error('Instagram post text is empty');
          if (!mediaUrl) throw new Error('Instagram requires mediaUrl (publicly reachable)');

          const isVideo = String(mediaType || '').toLowerCase() === 'video' || /\.(mp4|mov|m4v)(\?|$)/i.test(mediaUrl);

          const result = await this.instagramService.postToInstagram(identifier, message, mediaUrl, isVideo);

          // Instagram service now returns structured object like LinkedIn and Twitter
          return {
            success: true,
            platform,
            postId: result.postId,
            url: result.url,
            message: result.message
          };
        }

        // ------------ FACEBOOK ------------
        case 'facebook': {
          console.log('[Publisher] Executing Facebook case');
          const { captions, text, mediaUrl } = postData || {};
          
          // Use the platform token we already retrieved
          const identifier = { clerkUserId: clerkUserId };

          // Handle both string and array inputs for captions
          const captionText = Array.isArray(captions) ? captions[0] || '' : captions || '';
          const message = (captionText || text || '').trim();
          if (!message) throw new Error('Facebook post text is empty');

          console.log('[Publisher][Facebook] message.preview =', message.slice(0, 140));
          console.log('[Publisher][Facebook] mediaUrl =', mediaUrl);

          const result = await this.facebookService.postToFacebook(identifier, message, mediaUrl);
          console.log('[Publisher][Facebook] Raw result:', JSON.stringify(result, null, 2));

          // Facebook service now returns structured object like other platforms
          return {
            success: true,
            platform,
            postId: result.postId,
            url: result.url,
            message: result.message
          };
        }


      }
    } catch (error) {
      console.error(`❌ Failed to publish to ${platform}:`, error.message);
      return {
        success: false,
        platform,
        error: error.message,
        message: `Failed to publish to ${platform}: ${error.message}`
      };
    }
  }

  // ===== Validation per platform =====
  validatePlatformRequirements(platform, postData) {
    const { captions, hashtags, mediaUrl } = postData;

    switch (platform) {
      case 'instagram':
        if (!mediaUrl) throw new Error('Instagram requires media content');
        const instagramCaption = Array.isArray(captions) ? captions[0] || '' : captions || '';
        if (instagramCaption && instagramCaption.length > 2200) throw new Error('Instagram caption exceeds 2200 character limit');
        if (hashtags && hashtags.length > 30) throw new Error('Instagram allows maximum 30 hashtags');
        break;

      case 'tiktok':
        if (!mediaUrl) throw new Error('TikTok requires media content');
        const tiktokCaption = Array.isArray(captions) ? captions[0] || '' : captions || '';
        if (tiktokCaption && tiktokCaption.length > 150) throw new Error('TikTok caption exceeds 150 character limit');
        if (hashtags && hashtags.length > 20) throw new Error('TikTok allows maximum 20 hashtags');
        break;

      case 'linkedin': {
        // validate the *message* length after stripping inline hashtags
        const linkedinCaption = Array.isArray(captions) ? captions[0] || '' : captions || '';
        const stripped = (linkedinCaption || '').toString().replace(/#[\p{L}\p{N}_]+/gu, '');
        if (stripped.length > 3000) throw new Error('LinkedIn post exceeds 3000 character limit');
        if (hashtags && hashtags.length > 50) throw new Error('LinkedIn allows maximum 50 hashtags');
        break;
      }

      case 'twitter': {
        // Character limit validation removed - auto-shrink logic handles this
        if (hashtags && hashtags.length > 25) {
          throw new Error('Twitter allows maximum 25 hashtags');
        }
        break;
      }

      case 'youtube':
        if (!mediaUrl) throw new Error('YouTube requires video content');
        if (hashtags && hashtags.length > 100) throw new Error('YouTube allows maximum 100 hashtags');
        break;

      case 'facebook':
        const facebookCaption = Array.isArray(captions) ? captions[0] || '' : captions || '';
        if (facebookCaption && facebookCaption.length > 63206) throw new Error('Facebook post exceeds character limit');
        if (hashtags && hashtags.length > 100) throw new Error('Facebook allows maximum 100 hashtags');
        break;
    }
  }

  // ===== Normalize content per platform =====
  formatContentForPlatform(platform, postData) {
    const { captions, hashtags, mediaUrl, mediaType, privacyStatus } = postData;
    // Handle both string and array inputs for captions
    const captionText = Array.isArray(captions) ? captions[0] || '' : captions || '';
    const safeCaption = captionText.toString();
    const tagString = Array.isArray(hashtags) && hashtags.length
      ? hashtags.map(t => `#${(t ?? '').toString().replace(/^#+/, '')}`).join(' ')
      : '';

    switch (platform) {
      case 'instagram':
        return {
          caption: [safeCaption, tagString].filter(Boolean).join(' ').trim(),
          media_url: mediaUrl,
          media_type: mediaType
        };

      case 'tiktok':
        return {
          text: [safeCaption, tagString].filter(Boolean).join(' ').trim(),
          video_url: mediaUrl
        };

      case 'linkedin':
        return {
          caption: (caption || '').toString(),
          hashtags: Array.isArray(hashtags) ? hashtags : [],
          mediaUrl
        };

      case 'twitter':
        return {
          text: [safeCaption, tagString].filter(Boolean).join(' ').trim(),
          media_url: mediaUrl,
          hashtags: Array.isArray(hashtags) ? hashtags : []
        };

      case 'youtube': {
        const titleBase = safeCaption.trim() || 'New Video';
        const title = titleBase.slice(0, 80); // concise title
        const message = [safeCaption.trim(), tagString].filter(Boolean).join(' ').trim();
        return {
          title,
          description: message,
          mediaUrl: mediaUrl,
          tags: Array.isArray(hashtags)
            ? hashtags.map(t => t.toString().replace(/^#+/, ''))
            : [],
          privacyStatus: privacyStatus || 'unlisted'
        };
      }

      case 'facebook':
        return {
          message: [safeCaption, tagString].filter(Boolean).join(' ').trim(),
          media_url: mediaUrl
        };

      default:
        return {
          caption: [safeCaption, tagString].filter(Boolean).join(' ').trim(),
          media_url: mediaUrl
        };
    }
  }



  // ===== Bulk publish; also normalizes body shape =====
  async publishToMultiplePlatforms(platforms, postDataRaw) {
    const { refreshToken, content, ...rest } = postDataRaw || {};
    const normalized = { ...(content || {}), ...rest };
    if (refreshToken && !normalized.refreshToken) normalized.refreshToken = refreshToken;

    const results = [];
    for (const platform of platforms) {
      const r = await this.publishToPlatform(platform, normalized);
      results.push(r);
    }
    return results;
  }

  // ===== Limits (used by UI) =====
  getPlatformLimits(platform) {
    const limits = {
      instagram: { maxCharacters: 2200, maxHashtags: 30, requiresMedia: true },
      tiktok:    { maxCharacters: 150,  maxHashtags: 20, requiresMedia: true, mediaType: 'video' },
      linkedin:  { maxCharacters: 3000, maxHashtags: 50, requiresMedia: false },
      twitter:   { maxCharacters: 280,  maxHashtags: 25, requiresMedia: false },
      youtube:   { maxCharacters: 5000, maxHashtags: 100, requiresMedia: true, mediaType: 'video' },
      facebook:  { maxCharacters: 63206, maxHashtags: 100, requiresMedia: false }
    };
    return limits[platform] || {};
  }
}

module.exports = PlatformPublisher;