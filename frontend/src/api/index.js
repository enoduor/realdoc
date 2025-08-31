// --- Base URLs (unchanged) --------------------------------------------------
const API_BASE_URL = process.env.REACT_APP_API_URL?.replace(/\/$/, '') || 'http://localhost:4001';
const PYTHON_API_BASE_URL = process.env.REACT_APP_PYTHON_API_URL || 'http://localhost:5001';

// --- Auth helpers (unchanged) -----------------------------------------------
const getAuthToken = async () => {
  try {
    console.log('🔍 Getting auth token...');
    console.log('- Clerk object:', window.Clerk ? 'Available' : 'Not available');
    console.log('- Session:', window.Clerk?.session ? 'Available' : 'Not available');

    const token = await window.Clerk.session?.getToken({ skipCache: true });
    console.log('- Token result:', token ? 'Generated' : 'Failed');
    if (token) console.log('- Token preview:', token.substring(0, 20) + '...');
    return token;
  } catch (error) {
    console.error('❌ Error getting auth token:', error);
    return null;
  }
};

const makeAuthenticatedRequest = async (url, options = {}) => {
  const token = await getAuthToken();

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }

  return response.json();
};

// --- AI Services (unchanged) -----------------------------------------------
export const getCaption = async ({ platform, topic, tone }) => {
  try {
    const response = await fetch(`${PYTHON_API_BASE_URL}/captions/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, topic, tone }),
    });

    if (!response.ok) throw new Error('Failed to generate caption');
    return await response.json();
  } catch (error) {
    console.error('Error generating caption:', error);
    throw error;
  }
};

export const getHashtags = async ({ platform, topic, count }) => {
  try {
    const response = await fetch(`${PYTHON_API_BASE_URL}/hashtags/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, topic, count }),
    });

    if (!response.ok) throw new Error('Failed to generate hashtags');
    return await response.json();
  } catch (error) {
    console.error('Error generating hashtags:', error);
    throw error;
  }
};

// ---- Internal helpers ------------------------------------------------------
const ENDPOINTS = [
  // Individual platform endpoints for legacy flow
  '/api/publisher/linkedin/publish',
  '/api/publisher/facebook/publish',
  '/api/publisher/instagram/publish',
  '/api/publisher/twitter/publish',
  '/api/publisher/youtube/publish',
  '/api/publisher/tiktok/publish',
];

const asArray = (v) => (Array.isArray(v) ? v : []);

const normalizeReturn = (data, platformsFallback, singlePlatform) => {
  // Always return { success, post: { id, platforms:[{ platform, success, result, url, postId, message }] }, message }
  const id = data?.post?.id || data?.postId || data?.id || Date.now();
  const success = data?.success ?? true;
  const message = data?.message || (singlePlatform ? `Published to ${singlePlatform}` : 'Published');

  // Case A: backend already returned multi-platform structure
  if (data?.post?.platforms && Array.isArray(data.post.platforms)) {
    const platforms = data.post.platforms.map((p) => ({
      platform: p.platform,
      success: p.success,
      result: p.result,
      url: p.result?.url ?? p.url,
      postId: p.result?.postId ?? p.postId,
      message: p.result?.message ?? p.message,
      error: p.error,
    }));
    return { success, post: { id, platforms }, message };
  }

  // Case B: single-platform structure, wrap it for UI
  const returned = asArray(data?.platforms);
  const base = returned.length ? returned : singlePlatform ? [singlePlatform] : asArray(platformsFallback);

  const platforms = base.map((p) =>
    typeof p === 'string'
      ? {
          platform: p,
          success,
          result: data?.result || data,
          // Handle new backend structure: fields are nested under result
          url: data?.result?.url || data?.url,
          postId: data?.result?.postId || data?.postId,
          message: data?.result?.message || data?.message,
        }
      : p
  );

  return { success, post: { id, platforms }, message };
};

// Ensure per-platform URL/message fallbacks so UI shows "View Post" correctly
const enrichPlatformItem = (item) => {
  const platformId = (item.platform || '').toLowerCase();
  
  // Debug logging for YouTube
  if (platformId === 'youtube') {
    console.log('[Frontend][YouTube] enrichPlatformItem input:', JSON.stringify(item, null, 2));
    console.log('[Frontend][YouTube] item.result?.url:', item.result?.url);
    console.log('[Frontend][YouTube] item.url:', item.url);
  }
  
  // Check for backend-provided URL and message (from structured response)
  const backendUrl = item.result?.url || item.url;
  const backendPostId = item.result?.postId || item.postId;
  const backendMessage = item.result?.message || item.message;
  
  // Debug logging for YouTube
  if (platformId === 'youtube') {
    console.log('[Frontend][YouTube] backendUrl:', backendUrl);
    console.log('[Frontend][YouTube] backendPostId:', backendPostId);
    console.log('[Frontend][YouTube] backendMessage:', backendMessage);
  }
  
  // If backend provided a URL, use it (this is the correct behavior)
  if (backendUrl) {
    item.url = backendUrl;
    if (backendMessage) {
      item.message = backendMessage;
    }
    if (platformId === 'youtube') {
      console.log('[Frontend][YouTube] Using backend URL:', backendUrl);
    }
    return item;
  }
  
  // Only use fallback URLs if backend didn't provide a proper URL
  if (platformId === 'linkedin') {
    if (!item.message || item.message === 'Published') {
      item.message = 'Successfully posted to LinkedIn';
    }
    if (backendPostId) {
      item.url = `https://www.linkedin.com/feed/update/${backendPostId}`;
    } else {
      item.url = 'https://www.linkedin.com/feed/';
    }
  } else if (platformId === 'twitter') {
    if (!item.message || item.message === 'Published') {
      item.message = 'Successfully published to Twitter';
    }
    if (backendPostId) {
      item.url = `https://twitter.com/i/status/${backendPostId}`;
    } else {
      item.url = 'https://twitter.com/';
    }
  } else if (platformId === 'instagram') {
    if (!item.message || item.message === 'Published') {
      item.message = 'Successfully published to Instagram';
    }
    if (backendPostId) {
      item.url = `https://www.instagram.com/p/${backendPostId}/`;
    } else {
      item.url = 'https://www.instagram.com/';
    }
  } else if (platformId === 'facebook') {
    if (!item.message || item.message === 'Published') {
      item.message = 'Successfully published to Facebook';
    }
    if (backendPostId) {
      item.url = `https://www.facebook.com/${backendPostId}`;
    } else {
      item.url = 'https://www.facebook.com/';
    }
  } else if (platformId === 'tiktok') {
    if (!item.message || item.message === 'Published') {
      item.message = 'Successfully published to TikTok';
    }
    if (backendPostId) {
      item.url = `https://www.tiktok.com/@user/video/${backendPostId}`;
    } else {
      item.url = 'https://www.tiktok.com/';
    }
  } else if (platformId === 'youtube') {
    if (!item.message || item.message === 'Published') {
      item.message = 'Successfully published to YouTube';
    }
    // Only create fallback URL if we have a postId and no backend URL
    if (backendPostId && !backendUrl) {
      console.log('[Frontend][YouTube] Creating fallback URL with postId:', backendPostId);
      item.url = `https://www.youtube.com/watch?v=${backendPostId}`;
    } else if (!backendUrl) {
      console.log('[Frontend][YouTube] Creating generic fallback URL');
      item.url = 'https://www.youtube.com/';
    }
    console.log('[Frontend][YouTube] Final item.url:', item.url);
  }
  
  return item;
};

// Build the request payload for a given platform from the UI postData
const buildPlatformBody = (platform, postData) => {
  // All separated endpoints accept { content: { caption, hashtags, mediaUrl, mediaType } }
  return { content: postData.content };
};

// Per-platform endpoint map (frontend-only)
const platformPath = (platform) => {
  switch (platform) {
    case 'twitter':
      return '/api/publisher/twitter/publish';
    case 'linkedin':
      return '/api/publisher/linkedin/publish';
    case 'instagram':
      return '/api/publisher/instagram/publish';
    case 'facebook':
      return '/api/publisher/facebook/publish';
    case 'tiktok':
      return '/api/publisher/tiktok/publish';
    case 'youtube':
      return '/api/publisher/youtube/publish';
    default:
      return null;
  }
};

// A single platform publish call (keeps your single-platform logic & checks)
const publishSinglePlatform = async (platform, postData, token) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // REMOVED: Twitter special guard that was causing authentication issues
  // if (platform === 'twitter') {
  //   try {
  //     const accountsRes = await fetch(`${API_BASE_URL}/api/publisher/platforms/status`, {
  //       headers: token ? { Authorization: `Bearer ${token}` } : {},
  //       credentials: 'include',
  //     });
  //     if (!accountsRes.ok) throw new Error('Failed to check Twitter connection status');
  //     const accountsData = await accountsRes.json();
  //     if (!accountsData.platforms?.twitter?.connected) {
  //       throw new Error('No Twitter account connected. Please connect your Twitter account first via OAuth.');
  //     }
  //   } catch (e) {
  //     // Surface the "connect account" message to UI
  //     throw new Error('No Twitter account connected. Please connect your Twitter account first via OAuth.');
  //   }
  // }

  const path = platformPath(platform);
  if (!path) throw new Error(`Unsupported platform: ${platform}`);

  const body = buildPlatformBody(platform, postData);

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(body),
  });

  // Robust parse: prefer JSON, fallback to text; treat empty 200 as success (backend responded OK without body)
  let raw = '';
  try {
    raw = await res.text();
  } catch {}

  let data = null;
  if (raw) {
    try { data = JSON.parse(raw); } catch {}
  }

  if (res.ok) {
    // If we got JSON, normalize as usual
    if (data) {
      const normalized = normalizeReturn(data, [platform], platform);
      const item = normalized?.post?.platforms?.[0] || {
        platform,
        success: data?.success ?? true,
        result: data,
        // Handle new backend structure: fields are nested under result
        url: data?.result?.url || data?.url,
        postId: data?.result?.postId || data?.postId,
        message: data?.result?.message || data?.message,
      };
      item.platform = platform;
      return enrichPlatformItem(item);
    }
    // If 200 OK but empty/non-JSON, synthesize a success item so UI doesn't show "HTTP 200 OK"
    return enrichPlatformItem({
      platform,
      success: true,
      url: null,
      postId: null,
      message: 'Published',
    });
  }

  const errMsg = data?.error || data?.message || (raw || `HTTP ${res.status} ${res.statusText}`);
  throw new Error(errMsg);
};

// --- Public: publishNow (keeps your names & structure) ----------------------
export async function publishNow(postData) {
  // Get user ID and token from Clerk (keep your style)
  let userId = null;
  let token = null;
  try {
    userId = window.Clerk.user?.id;
    token = await window.Clerk.session?.getToken();
  } catch (error) {
    console.warn('Could not get user data from Clerk:', error);
  }

  // Guard platforms to avoid undefined
  const platforms = Array.isArray(postData.platforms) ? postData.platforms : [];

  // Single platform flags
  const isTwitterOnly = platforms.length === 1 && platforms[0] === 'twitter';
  const isLinkedInOnly = platforms.length === 1 && platforms[0] === 'linkedin';
  const isInstagramOnly = platforms.length === 1 && platforms[0] === 'instagram';
  const isFacebookOnly = platforms.length === 1 && platforms[0] === 'facebook';
  const isTikTokOnly = platforms.length === 1 && platforms[0] === 'tiktok';
  const isYouTubeOnly = platforms.length === 1 && platforms[0] === 'youtube';

  // ---- LinkedIn separated flow (user-specific tokens) ----------------------
  if (isLinkedInOnly) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const linkedinPostData = { content: postData.content };

      const res = await fetch(`${API_BASE_URL}/api/publisher/linkedin/publish`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(linkedinPostData),
      });

      let data = null;
      try {
        data = await res.json();
      } catch {}

      if (res.ok && data) {
        return normalizeReturn(data, platforms, 'linkedin');
      }
      throw new Error(data?.error || data?.message || `HTTP ${res.status} ${res.statusText}`);
    } catch (error) {
      console.error('LinkedIn separated flow error:', error);
      throw error;
    }
  }

  // ---- Twitter separated flow (production: user-specific tokens) -----------
  if (isTwitterOnly) {
    try {
      const item = await publishSinglePlatform('twitter', postData, token);
      // Convert single item to normalized shape
      return {
        success: true,
        post: { id: item.postId || Date.now(), platforms: [item] },
        message: item.message || 'Published to twitter',
      };
    } catch (error) {
      console.error('Twitter separated flow error:', error);
      throw error;
    }
  }

  // ---- New: Instagram separated flow --------------------------------------
  if (isInstagramOnly) {
    const item = await publishSinglePlatform('instagram', postData, token);
    return { success: true, post: { id: item.postId || Date.now(), platforms: [item] }, message: item.message || 'Published to instagram' };
  }

  // ---- New: Facebook separated flow ---------------------------------------
  if (isFacebookOnly) {
    const item = await publishSinglePlatform('facebook', postData, token);
    return { success: true, post: { id: item.postId || Date.now(), platforms: [item] }, message: item.message || 'Published to facebook' };
  }

  // ---- New: TikTok separated flow -----------------------------------------
  if (isTikTokOnly) {
    const item = await publishSinglePlatform('tiktok', postData, token);
    return { success: true, post: { id: item.postId || Date.now(), platforms: [item] }, message: item.message || 'Published to tiktok' };
  }

  // ---- New: YouTube separated flow ----------------------------------------
  if (isYouTubeOnly) {
    const item = await publishSinglePlatform('youtube', postData, token);
    return { success: true, post: { id: item.postId || Date.now(), platforms: [item] }, message: item.message || 'Published to youtube' };
  }

  // ---- Multi-platform (frontend-only aggregation; backend unchanged) -------
  if (platforms.length > 1) {
    const results = [];
    for (const p of platforms) {
      try {
        const item = await publishSinglePlatform(p, postData, token);
        results.push(item);
      } catch (err) {
        results.push({
          platform: p,
          success: false,
          url: null,
          postId: null,
          message: err.message || 'Failed to publish',
          error: err.message || 'Failed to publish',
        });
      }
    }

    const success = results.some((r) => r.success);
    return {
      success,
      post: { id: Date.now(), platforms: results },
      message: success ? 'Published to one or more platforms' : 'Failed to publish',
    };
  }
}

// --- Platform status (unchanged) -------------------------------------------
export const getPlatformStatus = async () => {
  return makeAuthenticatedRequest(`${API_BASE_URL}/scheduler/platforms/status`);
};

// --- Stripe Services --------------------------------------------------------
export const createSubscriptionSession = async (plan, billingCycle) => {
  try {
    console.log('🔍 createSubscriptionSession called with:', { plan, billingCycle });
    console.log('🔍 API_BASE_URL:', API_BASE_URL);

    const requestBody = { plan, billingCycle };
    console.log('🔍 Request body:', requestBody);

    const response = await fetch(`${API_BASE_URL}/api/stripe/create-subscription-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    console.log('🔍 Response status:', response.status);
    console.log('🔍 Response ok:', response.ok);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ API Error:', errorData);
      throw new Error(errorData.error || 'Failed to create subscription session');
    }

    const data = await response.json();
    console.log('✅ API Success:', data);
    return data;
  } catch (error) {
    console.error('❌ Error creating subscription session:', error);
    throw error;
  }
};

export const getSubscriptionStatus = async () => {
  try {
    return await makeAuthenticatedRequest(`${API_BASE_URL}/api/stripe/subscription`);
  } catch (error) {
    console.error('Error getting subscription status:', error);
    throw error;
  }
};

export const cancelSubscription = async () => {
  try {
    return await makeAuthenticatedRequest(`${API_BASE_URL}/api/stripe/cancel-subscription`, { method: 'POST' });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    throw error;
  }
};

export const reactivateSubscription = async () => {
  try {
    return await makeAuthenticatedRequest(`${API_BASE_URL}/api/stripe/reactivate-subscription`, { method: 'POST' });
  } catch (error) {
    console.error('Error reactivating subscription:', error);
    throw error;
  }
};

export const getBillingPortalUrl = async () => {
  try {
    return await makeAuthenticatedRequest(`${API_BASE_URL}/api/stripe/billing-portal`, { method: 'POST' });
  } catch (error) {
    console.error('Error getting billing portal URL:', error);
    throw error;
  }
};

// Check if user has active subscription
export const checkSubscriptionStatus = async () => {
  try {
    return await makeAuthenticatedRequest(`${API_BASE_URL}/api/stripe/subscription`);
  } catch (error) {
    console.error('Error checking subscription status:', error);
    return { hasActiveSubscription: false };
  }
};

// Check subscription status by session ID (no auth required)
export const checkSubscriptionBySession = async (sessionId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/stripe/subscription-by-session/${sessionId}`);
    return await response.json();
  } catch (error) {
    console.error('Error checking subscription by session:', error);
    return { hasActiveSubscription: false };
  }
};

// Link temporary user with Clerk user
export const linkTempUser = async (email) => {
  try {
    const token = await window.Clerk.session?.getToken({ skipCache: true });
    const response = await fetch(`${API_BASE_URL}/api/auth/link-temp-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email }),
    });
    return await response.json();
  } catch (error) {
    console.error('Error linking temporary user:', error);
    throw error;
  }
};

// Create or link Clerk user with database user
export const createOrLinkClerkUser = async () => {
  try {
    return await makeAuthenticatedRequest(`${API_BASE_URL}/api/auth/create-clerk-user`, { method: 'POST' });
  } catch (error) {
    console.error('Error creating/linking Clerk user:', error);
    throw error;
  }
};