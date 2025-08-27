/* back/backend-node/models/TikTokToken.js */
/* eslint-disable no-console */
const mongoose = require('mongoose');

const TikTokTokenSchema = new mongoose.Schema(
  {
    // Standard primary key across platforms: Clerk user ID
    clerkUserId: { type: String, index: true, required: false },
    email: { type: String, default: null },

    // Back-compat reference to User document (may be absent going forward)
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },

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

// helpful indexes
TikTokTokenSchema.index({ clerkUserId: 1, provider: 1 });
TikTokTokenSchema.index({ userId: 1, provider: 1 });
TikTokTokenSchema.index({ email: 1 });

module.exports = mongoose.model('TikTokToken', TikTokTokenSchema);
