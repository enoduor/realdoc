/* eslint-disable no-console */
const fetch = require('node-fetch');
const LinkedInToken = require('../models/LinkedInToken');

/**
 * Find a LinkedIn token doc by { linkedinUserId } or { userId }
 */
async function findLinkedInToken(identifier = {}) {
  if (identifier.linkedinUserId) {
    return LinkedInToken.findOne({ linkedinUserId: identifier.linkedinUserId });
  }
  if (identifier.userId) {
    return LinkedInToken.findOne({ userId: identifier.userId, linkedinUserId: { $exists: true } });
  }
  return null;
}

/**
 * Returns a valid access token, checking if expired
 */
async function getValidLinkedInToken(identifier) {
  const doc = await findLinkedInToken(identifier);
  if (!doc) throw new Error('LinkedIn not connected for this user');

  const now = Date.now();
  const expiresAtMs = new Date(doc.expiresAt).getTime();
  const isExpired = expiresAtMs && (expiresAtMs - now) < 0;

  if (isExpired) {
    throw new Error('LinkedIn token has expired. Please reconnect your LinkedIn account.');
  }

  return doc.accessToken;
}

/**
 * Get LinkedIn user profile
 */
async function getLinkedInProfile(identifier) {
  const doc = await findLinkedInToken(identifier);
  if (!doc) throw new Error('LinkedIn not connected for this user');

  return {
    linkedinUserId: doc.linkedinUserId,
    firstName: doc.firstName,
    lastName: doc.lastName,
    fullName: `${doc.firstName} ${doc.lastName}`.trim()
  };
}

/**
 * Post to LinkedIn using user-specific token
 */
async function postToLinkedIn(identifier, message, mediaUrl = null, hashtags = []) {
  const accessToken = await getValidLinkedInToken(identifier);
  const profile = await getLinkedInProfile(identifier);

  // Format hashtags
  const hashtagString = hashtags.length > 0 ? '\n\n' + hashtags.map(tag => `#${tag.replace(/^#/, '')}`).join(' ') : '';
  
  // Combine message and hashtags
  const fullMessage = mediaUrl ? `${message}\n\nMedia: ${mediaUrl}${hashtagString}` : `${message}${hashtagString}`;

  // LinkedIn API endpoint
  const url = 'https://api.linkedin.com/v2/ugcPosts';
  
  const payload = {
    author: `urn:li:person:${profile.linkedinUserId}`,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: {
          text: fullMessage
        },
        shareMediaCategory: mediaUrl ? 'IMAGE' : 'NONE'
      }
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
    }
  };

  if (mediaUrl) {
    payload.specificContent['com.linkedin.ugc.ShareContent'].media = [{
      status: 'READY',
      description: {
        text: 'Media content'
      },
      media: mediaUrl,
      title: {
        text: 'LinkedIn Post'
      }
    }];
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
      'LinkedIn-Version': '202503'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error('LinkedIn API Error:', response.status, errorData);
    throw new Error(`LinkedIn API error: ${response.status} ${errorData}`);
  }

  const result = await response.json();
  const postId = result.id;
  const linkedinUrl = `https://www.linkedin.com/feed/update/${postId}`;
  
  return {
    success: true,
    postId: postId,
    url: linkedinUrl,
    message: 'Successfully posted to LinkedIn'
  };
}

module.exports = {
  findLinkedInToken,
  getValidLinkedInToken,
  getLinkedInProfile,
  postToLinkedIn
};
