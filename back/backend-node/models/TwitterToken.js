const mongoose = require('mongoose');

const TwitterTokenSchema = new mongoose.Schema(
  {
    userId: { type: String, default: null }, // optional app user id
    twitterUserId: { type: String, index: true, required: true, unique: true },

    handle: String,
    name: String,

    accessToken: { type: String, required: true },
    refreshToken: { type: String, required: true },
    tokenType: { type: String, default: 'bearer' },
    scope: { type: String, default: 'tweet.write users.read tweet.read offline.access' },

    provider: { type: String, default: 'twitter' },

    expiresAt: { type: Date, required: true },
  },
  {
    timestamps: true, // creates createdAt / updatedAt automatically
  }
);

// helpful compound index for lookups by either id
TwitterTokenSchema.index({ twitterUserId: 1 }, { unique: true });
TwitterTokenSchema.index({ userId: 1 });

module.exports = mongoose.model('TwitterToken', TwitterTokenSchema);