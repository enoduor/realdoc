/* eslint-disable no-console */
const mongoose = require('mongoose');

const instagramTokenSchema = new mongoose.Schema({
  // Standard primary key across platforms: Clerk user ID
  clerkUserId: { type: String, index: true, required: false },
  email: { type: String, default: null },

  // Back-compat reference to User document (may be absent going forward)
  userId: { type: String, required: true }, // Clerk userId

  // Instagram account info
  pageId: { type: String },
  pageName: { type: String },
  igUserId: { type: String },
  name: { type: String },
  firstName: { type: String },
  lastName: { type: String },
  handle: { type: String },
  grantedPermissions: { type: [String], default: [] },

  // Facebook Graph token (long-lived)
  accessToken: { type: String, required: true },
  tokenType: { type: String, default: 'user' },
  expiresAt: { type: Date },

  isActive: { type: Boolean, default: true },
  provider: { type: String, default: 'instagram' },
}, { timestamps: true });

// helpful indexes
instagramTokenSchema.index({ clerkUserId: 1, provider: 1 });
instagramTokenSchema.index({ userId: 1, isActive: 1 });
instagramTokenSchema.index({ igUserId: 1 });
instagramTokenSchema.index({ email: 1 });

module.exports = mongoose.model('InstagramToken', instagramTokenSchema);


