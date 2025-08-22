/* eslint-disable no-console */
const axios = require('axios');
const LinkedInService = require('./linkedinService');
const youtubeService = require('./youtubeService'); // real YouTube API
const { postTweet } = require('./twitterService'); // real Twitter API

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

    // Real LinkedIn API
    this.linkedinService = new LinkedInService({
      accessToken: process.env.LINKEDIN_ACCESS_TOKEN
    });

    // Real Twitter API - using function-based approach with token persistence
  }

  // ===== Main publish switch =====
  async publishToPlatform(platform, postData) {
    try {
      console.log(`📤 Publishing to ${platform}...`);
      const platformConfig = this.platforms[platform];
      if (!platformConfig) throw new Error(`Platform ${platform} not configured`);

      this.validatePlatformRequirements(platform, postData);

      switch (platform) {
        // ------------ LINKEDIN ------------
        case 'linkedin': {
          // Accept either linkedinUserId (preferred) or userId (legacy)
          const { linkedinUserId, userId, caption, text } = postData || {};
          const identifier =
            linkedinUserId ? { linkedinUserId } :
            userId ? { userId } :
            null;

          if (!identifier) {
            throw new Error('LinkedIn requires linkedinUserId or userId');
          }

          const { postToLinkedIn } = require('./linkedinUserService');

          const message = (caption || text || '').trim();
          if (!message) throw new Error('LinkedIn post text is empty');

          const mediaUrl = postData?.mediaUrl || null;
          const hashtags = Array.isArray(postData?.hashtags) ? postData.hashtags : [];

          console.log('[Publisher][LinkedIn] message.preview =', message.slice(0, 140));
          console.log('[Publisher][LinkedIn] hashtags =', hashtags);

          const result = await postToLinkedIn(identifier, message, mediaUrl, hashtags);

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
          const refreshToken = postData?.refreshToken || process.env.YT_TEST_REFRESH_TOKEN;
          if (!refreshToken) {
            throw new Error('YouTube refreshToken missing (provide in body.refreshToken or set YT_TEST_REFRESH_TOKEN)');
          }
          if (!postData?.mediaUrl) {
            throw new Error('YouTube requires video content: content.mediaUrl (HTTPS URL or stream)');
          }

          const { title, description, video_url, tags, privacyStatus } =
            this.formatContentForPlatform('youtube', postData);

          console.log('[Publisher][YouTube] title =', title);
          console.log('[Publisher][YouTube] video_url =', video_url);

          const data = await youtubeService.uploadVideo(
            refreshToken,
            video_url, // URL is streamed by youtubeService
            { title, description, tags, privacyStatus }
          );

          return {
            success: true,
            platform,
            postId: data.id,
            url: `https://youtu.be/${data.id}`,
            message: 'Successfully published to YouTube'
          };
        }

        // ------------ TWITTER ------------
        case 'twitter': {
          // Production: require userId for user-specific tokens
          const { userId, caption, text, mediaUrl } = postData || {};
          
          console.log('[Publisher][Twitter] Debug - postData:', JSON.stringify(postData, null, 2));
          console.log('[Publisher][Twitter] Debug - userId:', userId);
          console.log('[Publisher][Twitter] Debug - caption:', caption);
          console.log('[Publisher][Twitter] Debug - text:', text);
          console.log('[Publisher][Twitter] Debug - mediaUrl:', mediaUrl);
          
          if (!userId) {
            throw new Error('Twitter requires authenticated userId');
          }

          const identifier = { userId };

          const tweetText = (caption || text || '').trim();
          console.log('[Publisher][Twitter] Debug - tweetText:', tweetText);
          if (!tweetText) throw new Error('Tweet text is empty');

          // Pass mediaUrl directly to postTweet - Twitter service handles URL/Buffer conversion
          const result = await postTweet(identifier, tweetText, mediaUrl);
          // Twitter API returns { data: { id, text } }
          const tweetId = result?.data?.id;
          
          if (!tweetId) {
            throw new Error('Failed to get tweet ID from Twitter API response');
          }
          
          const twitterUrl = `https://twitter.com/i/status/${tweetId}`;
          console.log(`[Twitter] Generated URL: ${twitterUrl}`);
          
          return {
            success: true,
            platform,
            postId: tweetId,
            url: twitterUrl,
            message: 'Successfully published to Twitter'
          };
        }

        // ------------ TIKTOK ------------
        case 'tiktok': {
          const { userId, caption, text, mediaUrl } = postData || {};
          
          if (!userId) {
            throw new Error('TikTok requires authenticated userId');
          }
          if (!mediaUrl) {
            throw new Error('TikTok requires video content: mediaUrl (HTTPS URL or stream)');
          }

          const { text: formattedText, video_url } =
            this.formatContentForPlatform('tiktok', postData);

          console.log('[Publisher][TikTok] text =', formattedText);
          console.log('[Publisher][TikTok] video_url =', video_url);

          // Use the TikTok service for video upload and publishing
          const { uploadVideo, publishVideo } = require('./tiktokService');
          
          // 1) Upload video
          const { video_id } = await uploadVideo({
            userId: userId,
            fileBuffer: video_url, // This should be a buffer or URL
            mimeType: 'video/mp4',
          });

          // 2) Publish video
          const publishResp = await publishVideo({
            userId: userId,
            videoId: video_id,
            title: formattedText,
          });

          return {
            success: true,
            platform,
            postId: video_id,
            url: publishResp?.share_url || `https://www.tiktok.com/@user/video/${video_id}`,
            message: 'Successfully published to TikTok'
          };
        }

        // ------------ INSTAGRAM ------------
        case 'instagram': {
          const { userId, caption, text, mediaUrl, mediaType, hashtags } = postData || {};
          if (!userId) {
            throw new Error('Instagram requires authenticated userId');
          }

          // Build caption + hashtags like other platforms
          const safeCaption = (caption || text || '').toString().trim();
          const tagString = Array.isArray(hashtags) && hashtags.length
            ? hashtags.map(t => `#${(t ?? '').toString().replace(/^#+/, '')}`).join(' ')
            : '';
          const message = [safeCaption, tagString].filter(Boolean).join(' ').trim();

          if (!message) throw new Error('Instagram post text is empty');
          if (!mediaUrl) throw new Error('Instagram requires mediaUrl (publicly reachable)');

          const { postToInstagram } = require('./instagramService');
          const identifier = { userId };
          const isVideo = String(mediaType || '').toLowerCase() === 'video' || /\.(mp4|mov|m4v)(\?|$)/i.test(mediaUrl);

          const result = await postToInstagram(identifier, message, mediaUrl, isVideo);

          return {
            success: true,
            platform,
            postId: result.id,
            url: result.url,
            message: 'Successfully published to Instagram'
          };
        }

        // ------------ FACEBOOK ------------
        case 'facebook': {
          const { userId, caption, text, mediaUrl } = postData || {};
          
          if (!userId) {
            throw new Error('Facebook requires authenticated userId');
          }

          const identifier = { userId };

          const { postToFacebook } = require('./facebookService');

          const message = (caption || text || '').trim();
          if (!message) throw new Error('Facebook post text is empty');

          console.log('[Publisher][Facebook] message.preview =', message.slice(0, 140));
          console.log('[Publisher][Facebook] mediaUrl =', mediaUrl);

          const result = await postToFacebook(identifier, message, mediaUrl);

          // Prefer service-provided permalink, fallback if missing
          const fallbackUrl = result?.id
            ? `https://www.facebook.com/${String(result.id).includes('_')
                ? String(result.id).split('_').join('/posts/')
                : result.id}`
            : undefined;
          const finalUrl = result?.url || fallbackUrl;

          return {
            success: true,
            platform,
            postId: result?.id,
            url: finalUrl,
            message: 'Successfully published to Facebook'
          };
        }

        // ------------ DEFAULT (simulated for others) ------------
        default: {
          const formattedContent = this.formatContentForPlatform(platform, postData);
          const result = await this.publishContent(platform, formattedContent);
          console.log(`✅ Successfully published to ${platform}`);
          return {
            success: true,
            platform,
            postId: result.postId || result.id,
            url: result.url,
            message: `Successfully published to ${platform}`
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
    const { caption, hashtags, mediaUrl } = postData;

    switch (platform) {
      case 'instagram':
        if (!mediaUrl) throw new Error('Instagram requires media content');
        if (caption && caption.length > 2200) throw new Error('Instagram caption exceeds 2200 character limit');
        if (hashtags && hashtags.length > 30) throw new Error('Instagram allows maximum 30 hashtags');
        break;

      case 'tiktok':
        if (!mediaUrl) throw new Error('TikTok requires video content');
        if (caption && caption.length > 150) throw new Error('TikTok caption exceeds 150 character limit');
        if (hashtags && hashtags.length > 20) throw new Error('TikTok allows maximum 20 hashtags');
        break;

      case 'linkedin': {
        // validate the *message* length after stripping inline hashtags
        const stripped = (caption || '').toString().replace(/#[\p{L}\p{N}_]+/gu, '');
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
        if (caption && caption.length > 63206) throw new Error('Facebook post exceeds character limit');
        if (hashtags && hashtags.length > 100) throw new Error('Facebook allows maximum 100 hashtags');
        break;
    }
  }

  // ===== Normalize content per platform =====
  formatContentForPlatform(platform, postData) {
    const { caption, hashtags, mediaUrl, mediaType, privacyStatus } = postData;
    const safeCaption = (caption || '').toString();
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
        const desc = [safeCaption.trim(), tagString].filter(Boolean).join('\n\n').trim();
        return {
          title,
          description: desc,
          video_url: mediaUrl,
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

  // ===== Simulated publisher for non-wired platforms =====
  async publishContent(platform, content) {
    // Simulate API latency
    await new Promise(resolve => setTimeout(resolve, 1200));

    const idBase = Date.now();
    const responses = {
      instagram: { id: `ig_${idBase}`, url: `https://instagram.com/p/ig_${idBase}` },
      tiktok:    { id: `tt_${idBase}`, url: `https://tiktok.com/@user/video/tt_${idBase}` },
      linkedin:  { id: `li_${idBase}`, url: `https://www.linkedin.com/feed/update/li_${idBase}` },
      twitter:   { id: `tw_${idBase}`, url: `https://twitter.com/user/status/tw_${idBase}` },
      youtube:   { id: `yt_${idBase}`, url: `https://youtube.com/watch?v=yt_${idBase}` },
      facebook:  { id: `fb_${idBase}`, url: `https://facebook.com/permalink.php?story_fbid=fb_${idBase}` }
    };

    return responses[platform] || { id: `post_${idBase}` };
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

module.exports = new PlatformPublisher();