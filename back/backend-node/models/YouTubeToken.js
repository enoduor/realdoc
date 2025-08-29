const mongoose = require('mongoose');

const YouTubeTokenSchema = new mongoose.Schema(
  {
    // Standard primary key across platforms: Clerk user ID
    clerkUserId: { type: String, index: true, required: false },
    email: { type: String, default: null },

    // Back-compat reference to User document (may be absent going forward)
    userId: { type: String, default: null }, // optional app user id

    // YouTube account info
    channelId: { type: String, required: false },
    channelTitle: { type: String },
    channelDescription: { type: String },

    // OAuth tokens
    accessToken: { type: String, required: false },
    refreshToken: { type: String, required: false },
    expiresAt: { type: Date, required: false },
    scope: { type: String, default: 'https://www.googleapis.com/auth/youtube.upload' },

    isActive: { type: Boolean, default: true },
    provider: { type: String, default: 'youtube' },
  },
  {
    timestamps: true, // creates createdAt / updatedAt automatically
  }
);

// helpful indexes
YouTubeTokenSchema.index({ clerkUserId: 1, provider: 1 });
YouTubeTokenSchema.index({ userId: 1, provider: 1 });
YouTubeTokenSchema.index({ channelId: 1 });
YouTubeTokenSchema.index({ email: 1 });

module.exports = mongoose.model('YouTubeToken', YouTubeTokenSchema);
