const mongoose = require('mongoose');

const LinkedInTokenSchema = new mongoose.Schema(
  {
    userId: { type: String, default: null }, // optional app user id
    linkedinUserId: { type: String, index: true, required: true, unique: true },

    firstName: String,
    lastName: String,

    accessToken: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    scope: { type: String, default: 'r_liteprofile r_emailaddress w_member_social' },

    provider: { type: String, default: 'linkedin' },
  },
  {
    timestamps: true, // creates createdAt / updatedAt automatically
  }
);

// helpful compound index for lookups by either id
LinkedInTokenSchema.index({ linkedinUserId: 1 }, { unique: true });
LinkedInTokenSchema.index({ userId: 1 });

module.exports = mongoose.model('LinkedInToken', LinkedInTokenSchema);
