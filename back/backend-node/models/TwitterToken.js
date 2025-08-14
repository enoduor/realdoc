/* back/backend-node/models/TwitterToken.js */
const mongoose = require('mongoose');

const TwitterTokenSchema = new mongoose.Schema(
  {
    // OPTIONAL: your app user id (string if using Clerk IDs)
    userId: { type: String, index: true },

    // REQUIRED for publish when Clerk is separated
    twitterUserId: { type: String, required: true, unique: true },

    // Nice-to-have identity fields
    handle: { type: String, index: true }, // @handle without '@'
    name: { type: String },

    // OAuth2 tokens
    accessToken: { type: String, required: true },
    refreshToken: { type: String, required: true }, // rotates!
    tokenType: { type: String, default: 'bearer' },
    scope: { type: String }, // space-delimited
    expiresAt: { type: Date, required: true },
    provider: { type: String, default: 'twitter' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TwitterToken', TwitterTokenSchema);