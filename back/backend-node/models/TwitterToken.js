const mongoose = require('mongoose');

const TwitterTokenSchema = new mongoose.Schema(
  {
    // Standard primary key across platforms: Clerk user ID
    clerkUserId: { type: String, index: true, required: false },
    email: { type: String, default: null },

    // Back-compat reference to User document (may be absent going forward)
    userId: { type: String, default: null }, // optional app user id

    // Twitter account info
    twitterUserId: { type: String, required: true },
    handle: String,
    name: String,

    // OAuth 1.0a fields (replacing OAuth 2.0 fields)
    oauthToken: { type: String, required: true }, // OAuth 1.0a access token
    oauthTokenSecret: { type: String, required: true }, // OAuth 1.0a access token secret

    provider: { type: String, default: 'twitter' },
  },
  {
    timestamps: true, // creates createdAt / updatedAt automatically
  }
);

// helpful indexes
TwitterTokenSchema.index({ clerkUserId: 1, provider: 1 });
TwitterTokenSchema.index({ userId: 1, provider: 1 });
TwitterTokenSchema.index({ twitterUserId: 1 }, { unique: true });
TwitterTokenSchema.index({ email: 1 });

module.exports = mongoose.model('TwitterToken', TwitterTokenSchema);