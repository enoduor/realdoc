/* eslint-disable no-console */
const mongoose = require('mongoose');

const instagramTokenSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true }, // Clerk userId
  email: { type: String },

  // Facebook Graph token (long-lived)
  accessToken: { type: String, required: true },
  tokenType: { type: String, default: 'user' },
  expiresAt: { type: Date },

  // Page and IG business account resolution
  pageId: { type: String },
  pageName: { type: String },
  igUserId: { type: String, index: true },
  name: { type: String },

  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('InstagramToken', instagramTokenSchema);


