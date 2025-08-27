/* eslint-disable no-console */
const axios = require('axios');
const FormData = require('form-data');
const path = require('path');
const InstagramToken = require('../models/InstagramToken');

const FACEBOOK_API_URL = process.env.FACEBOOK_API_URL || 'https://graph.facebook.com/v18.0';
const PYTHON_API_BASE_URL = process.env.PYTHON_API_BASE_URL || 'http://localhost:5001';

function inferFilenameFromUrl(url) {
  try {
    const p = new URL(url);
    const base = path.basename(p.pathname);
    if (!base || base === '/' || base === '.') return 'upload';
    return base.includes('.') ? base : `${base}`;
  } catch {
    return 'upload';
  }
}

async function downloadToBuffer(mediaUrl) {
  const resp = await axios.get(mediaUrl, {
    responseType: 'arraybuffer',
    timeout: 30000,
    maxContentLength: 50 * 1024 * 1024,
    maxBodyLength: 50 * 1024 * 1024,
    headers: { 'User-Agent': 'CreatorSync/1.0' }
  });
  const buffer = Buffer.from(resp.data);
  const contentType = resp.headers['content-type'] || 'application/octet-stream';
  const filename = inferFilenameFromUrl(mediaUrl);
  return { buffer, contentType, filename };
}

async function rehostToS3(buffer, filename, contentType) {
  const form = new FormData();
  form.append('file', buffer, { filename, contentType });
  form.append('platform', 'instagram');

  const resp = await axios.post(`${PYTHON_API_BASE_URL}/api/v1/upload`, form, {
    headers: form.getHeaders(),
    timeout: 60000,
  });
  if (!resp.data?.url) throw new Error('S3 rehost failed: no URL returned');
  return resp.data.url;
}

async function findToken(identifier = {}) {
  if (identifier.igUserId) {
    return InstagramToken.findOne({ igUserId: identifier.igUserId, isActive: true }).sort({ updatedAt: -1 });
  }
  if (identifier.userId) {
    return InstagramToken.findOne({ userId: identifier.userId, isActive: true }).sort({ updatedAt: -1 });
  }
  if (identifier.email) {
    return InstagramToken.findOne({ email: identifier.email, isActive: true }).sort({ updatedAt: -1 });
  }
  return null;
}

async function createContainerImage(accessToken, igUserId, imageUrl, caption) {
  const resp = await axios.post(`${FACEBOOK_API_URL}/${igUserId}/media`, null, {
    params: { image_url: imageUrl, caption, access_token: accessToken },
    timeout: 20000,
  });
  return resp.data; // { id: creation_id }
}

async function createContainerVideo(accessToken, igUserId, videoUrl, caption) {
  const resp = await axios.post(`${FACEBOOK_API_URL}/${igUserId}/media`, null, {
    params: { media_type: 'REELS', video_url: videoUrl, caption, access_token: accessToken },
    timeout: 30000,
  });
  return resp.data; // { id: creation_id }
}

async function getContainerStatus(accessToken, creationId) {
  const resp = await axios.get(`${FACEBOOK_API_URL}/${creationId}`, {
    params: { fields: 'status_code', access_token: accessToken },
    timeout: 15000,
  });
  return resp.data?.status_code;
}

async function publishMedia(accessToken, igUserId, creationId) {
  const resp = await axios.post(`${FACEBOOK_API_URL}/${igUserId}/media_publish`, null, {
    params: { creation_id: creationId, access_token: accessToken },
    timeout: 15000,
  });
  return resp.data; // { id: ig_media_id }
}

async function getPermalink(accessToken, mediaId) {
  const resp = await axios.get(`${FACEBOOK_API_URL}/${mediaId}`, {
    params: { fields: 'permalink', access_token: accessToken },
    timeout: 15000,
  });
  return resp.data?.permalink || null;
}

async function postToInstagram(identifier, message, mediaUrl, isVideo = false) {
  const doc = await findToken(identifier);
  if (!doc || !doc.accessToken || !doc.igUserId) {
    throw new Error('Instagram not connected for this user');
  }
  const accessToken = doc.accessToken;
  const igUserId = doc.igUserId;

  let effectiveUrl = mediaUrl;
  let triedRehost = false;

  const attemptCreate = async () => {
    console.log('[IG] Creating container...');
    return isVideo
      ? await createContainerVideo(accessToken, igUserId, effectiveUrl, message)
      : await createContainerImage(accessToken, igUserId, effectiveUrl, message);
  };

  let creation;
  try {
    creation = await attemptCreate();
  } catch (e) {
    const httpStatus = e.response?.status;
    const fbErr = e.response?.data;
    console.warn('[IG] Container create failed:', httpStatus, fbErr || e.message);
    // Fallback: rehost to S3 if URL might be inaccessible to Meta
    if (!triedRehost && typeof mediaUrl === 'string' && mediaUrl.startsWith('http')) {
      try {
        console.log('[IG] Rehosting media to S3 via Python service...');
        const { buffer, contentType, filename } = await downloadToBuffer(mediaUrl);
        effectiveUrl = await rehostToS3(buffer, filename, contentType);
        triedRehost = true;
        console.log('[IG] Rehosted URL:', effectiveUrl);
        creation = await attemptCreate();
      } catch (rhErr) {
        console.error('[IG] Rehost attempt failed:', rhErr.response?.data || rhErr.message);
        throw e; // original error
      }
    } else {
      throw e;
    }
  }

  if (isVideo) {
    // Poll for FINISHED
    const start = Date.now();
    while (Date.now() - start < 120000) { // up to 2 minutes
      const status = await getContainerStatus(accessToken, creation.id);
      if (status === 'FINISHED') break;
      if (status === 'ERROR') throw new Error('Instagram video processing failed');
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  console.log('[IG] Publishing media...');
  const published = await publishMedia(accessToken, igUserId, creation.id);
  const permalink = await getPermalink(accessToken, published.id);
  
  // Return structured object like LinkedIn and Twitter
  return {
    success: true,
    postId: published.id,
    url: permalink,
    message: 'Successfully published to Instagram'
  };
}

module.exports = { postToInstagram };


