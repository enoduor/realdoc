/* eslint-disable no-console */
// Usage:
//   node scripts/test-instagram-direct.js <mediaUrl> <image|video> "Optional caption" "tag1,tag2"

require('dotenv').config();
const mongoose = require('mongoose');
const { postToInstagram } = require('../services/instagramService');

async function main() {
  const [,, mediaUrlArg, mediaTypeArg = 'image', captionArg = 'CLI test', hashtagsCsv = ''] = process.argv;
  if (!mediaUrlArg) {
    console.error('ERROR: mediaUrl is required');
    process.exit(1);
  }

  const mediaUrl = mediaUrlArg;
  const isVideo = String(mediaTypeArg || 'image').toLowerCase() === 'video';
  const caption = String(captionArg || '').trim();
  const tags = String(hashtagsCsv || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(t => `#${t.replace(/^#+/, '')}`)
    .join(' ');
  const message = [caption, tags].filter(Boolean).join(' ').trim();

  const userId = process.env.TEST_CLERK_USER_ID || 'user_317vIukeHneALOkPCrpufgWA8DJ';

  try {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI not set');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    console.log('🚀 Posting to Instagram with:', { userId, isVideo, mediaUrl, messagePreview: message.slice(0, 120) });
    const result = await postToInstagram({ userId }, message, mediaUrl, isVideo);
    console.log('✅ IG result:', result);
  } catch (err) {
    console.error('❌ IG publish failed:', err.response?.data || err.message || err);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close().catch(() => {});
  }
}

main();


