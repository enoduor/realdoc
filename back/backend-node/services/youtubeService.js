/* eslint-disable no-console */
const { google } = require('googleapis');
const axios = require('axios');

function getOAuthClient() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
    throw new Error('Missing Google OAuth env (GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI)');
  }
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

async function getYouTubeClient(refreshToken) {
  if (!refreshToken) throw new Error('Missing user refresh token');
  const auth = getOAuthClient();
  auth.setCredentials({ refresh_token: refreshToken });
  return google.youtube({ version: 'v3', auth });
}

async function whoAmI(refreshToken) {
  const yt = await getYouTubeClient(refreshToken);
  const res = await yt.channels.list({
    part: ['snippet', 'contentDetails', 'statistics'],
    mine: true
  });
  return res.data;
}

/**
 * Uploads a video to YouTube.
 * @param {string} refreshToken  User's stored refresh token
 * @param {Readable|String} fileInput  Node Readable stream, or HTTPS URL to stream
 * @param {Object} meta  { title, description, tags?, privacyStatus? }
 */
async function uploadVideo(refreshToken, fileInput, meta = {}) {
  const { title, description, tags = [], privacyStatus = 'unlisted' } = meta;
  const yt = await getYouTubeClient(refreshToken);

  // Support passing a URL (we stream it) or a Node stream
  let mediaBody = fileInput;
  if (typeof fileInput === 'string') {
    const resp = await axios.get(fileInput, { responseType: 'stream' });
    mediaBody = resp.data;
  }

  const res = await yt.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: { title, description, tags },
      status: { privacyStatus }
    },
    media: { body: mediaBody },
    // Optional: onUploadProgress available if using googleapis resumable; simple insert suffices for now.
  });

  return res.data; // includes id, snippet, status
}

module.exports = { getYouTubeClient, whoAmI, uploadVideo };
