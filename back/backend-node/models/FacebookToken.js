const mongoose = require('mongoose');

const facebookTokenSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  email: {
    type: String,
    required: true,
    index: true
  },
  facebookUserId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  accessToken: {
    type: String,
    required: true
  },
  pageId: { type: String },                 // selected page to post to (optional)
  pageName: { type: String },
  pageAccessToken: { type: String },        // page token (stronger perms)
  tokenType: {
    type: String,
    default: 'user'
  },
  expiresAt: {
    type: Date
  },
  name: {
    type: String
  },
  handle: {
    type: String
  },
  handleUpdatedAt: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
facebookTokenSchema.index({ userId: 1, isActive: 1 });
facebookTokenSchema.index({ email: 1, isActive: 1 });
facebookTokenSchema.index({ facebookUserId: 1, isActive: 1 });

module.exports = mongoose.model('FacebookToken', facebookTokenSchema);
