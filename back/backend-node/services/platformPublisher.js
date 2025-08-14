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
          if (!this.linkedinService || !this.linkedinService.accessToken) {
            throw new Error('LinkedIn service not configured');
          }

          const rawCaption = (postData?.caption ?? '').toString();
          const captionTags = extractHashtags(rawCaption);          // tags present in caption
          const caption = cleanCaption(stripHashtags(rawCaption));  // caption without tags, cleaned

          const inputTags = Array.isArray(postData?.hashtags) ? postData.hashtags : [];
          const allTags = dedupeCaseInsensitive([...captionTags, ...inputTags])
            .map(t => t.replace(/^#+/, '')) // remove leading # for normalization
            .map(normalizeHashtagCase);     // -> #TagFormat

          const mediaUrl = postData?.mediaUrl || null;

          console.log('[Publisher][LinkedIn] caption.preview =', caption.slice(0, 140));
          console.log('[Publisher][LinkedIn] hashtags =', allTags);

          const result = await this.linkedinService.createPost(
            caption,   // message only (no inline hashtags)
            mediaUrl,
            {
              ensureUnique: postData?.ensureUnique !== false,
              hashtags: allTags // service formats to "#Tag" tokens in one block
            }
          );

          if (!result.success) throw new Error(result.error);

          const linkedinPermalinkFromUrn = urn =>
            urn ? `https://www.linkedin.com/feed/update/${encodeURIComponent(urn)}` : null;

          return {
            success: true,
            platform,
            postId: result.postId,
            url: linkedinPermalinkFromUrn(result.postId),
            version: result.version,
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
          // Accept either twitterUserId (preferred) or userId (legacy)
          const { twitterUserId, userId, caption, text } = postData || {};
          const identifier =
            twitterUserId ? { twitterUserId } :
            userId ? { userId } :
            null;

          if (!identifier) {
            throw new Error('Twitter requires twitterUserId or userId');
          }

          const tweetText = (caption || text || '').trim();
          if (!tweetText) throw new Error('Tweet text is empty');

          const result = await postTweet(identifier, tweetText);
          // X returns { data: { id, text } }
          return {
            success: true,
            platform,
            postId: result?.data?.id || result?.id,
            url: `https://twitter.com/user/status/${result?.data?.id || result?.id}`,
            message: 'Successfully published to Twitter'
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
    // Accept both shapes:
    // { platforms, content:{...}, refreshToken }  OR  { caption, mediaUrl, ..., refreshToken }
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