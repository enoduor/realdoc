const mongoose = require('mongoose');

const facebookTokenSchema = new mongoose.Schema({
  // Standard primary key across platforms: Clerk user ID
  clerkUserId: { type: String, index: true, required: false },
  email: { type: String, default: null },

  // Back-compat reference to User document (may be absent going forward)
  userId: {
    type: String,
    required: true,
    index: true
  },

  // Facebook account info
  facebookUserId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  pageId: { type: String },                 // selected page to post to (optional)
  pageName: { type: String },
  pageAccessToken: { type: String },        // page token (stronger perms)
  name: { type: String },
  handle: { type: String },
  handleUpdatedAt: { type: Date },

  // OAuth tokens
  accessToken: {
    type: String,
    required: true
  },
  tokenType: {
    type: String,
    default: 'user'
  },
  expiresAt: {
    type: Date
  },

  isActive: {
    type: Boolean,
    default: true
  },
  provider: { type: String, default: 'facebook' }
}, {
  timestamps: true
});

// helpful indexes
facebookTokenSchema.index({ clerkUserId: 1, provider: 1 });
facebookTokenSchema.index({ userId: 1, isActive: 1 });
facebookTokenSchema.index({ email: 1, isActive: 1 });
facebookTokenSchema.index({ facebookUserId: 1, isActive: 1 });

module.exports = mongoose.model('FacebookToken', facebookTokenSchema);
