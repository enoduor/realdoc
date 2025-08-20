const mongoose = require('mongoose');

const TwitterTokenSchema = new mongoose.Schema(
  {
    userId: { type: String, default: null }, // optional app user id
    email: { type: String, default: null }, // optional email for linking
    twitterUserId: { type: String, index: true, required: true, unique: true },

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

// helpful compound index for lookups by either id
TwitterTokenSchema.index({ twitterUserId: 1 }, { unique: true });
TwitterTokenSchema.index({ userId: 1 });
TwitterTokenSchema.index({ email: 1 });

module.exports = mongoose.model('TwitterToken', TwitterTokenSchema);