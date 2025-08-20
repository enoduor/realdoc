/* back/backend-node/models/TikTokToken.js */
/* eslint-disable no-console */
const mongoose = require('mongoose');

const TikTokTokenSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // TikTok account info (fill after first fetch)
    tiktokUserOpenId: { type: String, index: true }, // TikTok's user identifier
    username: { type: String }, // optional, if fetched

    // OAuth2 token set
    accessToken: { type: String, required: true },
    refreshToken: { type: String }, // TikTok rotates this on refresh
    tokenType: { type: String, default: 'Bearer' },
    scope: { type: String }, // space-separated scopes
    expiresAt: { type: Date, required: true }, // absolute UTC time

    provider: { type: String, default: 'tiktok' },
  },
  { timestamps: true }
);

// helpful index
TikTokTokenSchema.index({ userId: 1, provider: 1 });

module.exports = mongoose.model('TikTokToken', TikTokTokenSchema);
