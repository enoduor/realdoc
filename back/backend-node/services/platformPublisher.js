/* eslint-disable no-console */
const axios = require('axios');
const LinkedInService = require('./linkedinService');
const youtubeService = require('./youtubeService'); // ⬅️ real YouTube API
const twitterService = require('./twitterService'); // ⬅️ real Twitter API

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
        token: process.env.TWITTER_ACCESS_TOKEN
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
  }

  // ===== Main publish switch =====
  async publishToPlatform(platform, postData) {
    try {
      console.log(`📤 Publishing to ${platform}...`);
      const platformConfig = this.platforms[platform];
      if (!platformConfig) throw new Error(`Platform ${platform} not configured`);

      this.validatePlatformRequirements(platform, postData);

      switch (platform) {
        case 'linkedin': {
          if (!this.linkedinService || !this.linkedinService.accessToken) {
            throw new Error('LinkedIn service not configured');
          }
          const caption = (postData?.caption ?? '').toString().trim();
          const tagsArr = Array.isArray(postData?.hashtags) ? postData.hashtags : [];
          const tags = tagsArr
            .map(t => (t ?? '').toString().trim().replace(/^#+/, ''))
            .filter(Boolean)
            .map(t => `#${t}`)
            .join(' ');
          const postText = [caption, tags].filter(Boolean).join('\n\n');

          console.log('[Publisher][LinkedIn] postText.preview =', postText.slice(0, 140));

          const result = await this.linkedinService.createPost(
            postText,
            postData?.mediaUrl || null,
            { ensureUnique: true }
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

        case 'youtube': {
          // We accept refreshToken either in postData.refreshToken OR from env for testing
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

        case 'twitter': {
          // We accept accessToken either in postData.accessToken OR from env for testing
          const accessToken = postData?.accessToken || process.env.TWITTER_TEST_ACCESS_TOKEN;
          if (!accessToken || accessToken === 'your_twitter_access_token_here') {
            throw new Error('Twitter accessToken missing. Please get a real token from: http://localhost:4001/oauth2/start/twitter');
          }

          const { text, media_url, hashtags } = this.formatContentForPlatform('twitter', postData);

          console.log('[Publisher][Twitter] text =', text);
          console.log('[Publisher][Twitter] media_url =', media_url);

          const result = await twitterService.createPost(accessToken, {
            text,
            mediaUrl: media_url,
            hashtags
          });

          if (!result.success) throw new Error(result.error);

          return {
            success: true,
            platform,
            postId: result.tweetId,
            url: result.url,
            message: result.message
          };
        }

        default: {
          // Keep simulated flow for other platforms (until real APIs are added)
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

      case 'linkedin':
        if (caption && caption.length > 3000) throw new Error('LinkedIn post exceeds 3000 character limit');
        if (hashtags && hashtags.length > 50) throw new Error('LinkedIn allows maximum 50 hashtags');
        break;

      case 'twitter':
        if (caption && caption.length > 280) throw new Error('Twitter post exceeds 280 character limit');
        if (hashtags && hashtags.length > 25) throw new Error('Twitter allows maximum 25 hashtags');
        break;

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
          caption: safeCaption,
          hashtags: Array.isArray(hashtags) ? hashtags : [],
          mediaUrl
        };

      case 'twitter':
        return {
          text: [safeCaption, tagString].filter(Boolean).join(' ').trim(),
          media_url: mediaUrl
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
    const platformConfig = this.platforms[platform];

    // Simulate API latency
    await new Promise(resolve => setTimeout(resolve, 1200));

    const responses = {
      instagram: { id: `ig_${Date.now()}`, url: `https://instagram.com/p/ig_${Date.now()}` },
      tiktok:    { id: `tt_${Date.now()}`, url: `https://tiktok.com/@user/video/tt_${Date.now()}` },
      linkedin:  { id: `li_${Date.now()}`, url: `https://www.linkedin.com/feed/update/li_${Date.now()}` },
      twitter:   { id: `tw_${Date.now()}`, url: `https://twitter.com/user/status/tw_${Date.now()}` },
      youtube:   { id: `yt_${Date.now()}`, url: `https://youtube.com/watch?v=yt_${Date.now()}` },
      facebook:  { id: `fb_${Date.now()}`, url: `https://facebook.com/permalink.php?story_fbid=fb_${Date.now()}` }
    };

    return responses[platform] || { id: `post_${Date.now()}` };
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