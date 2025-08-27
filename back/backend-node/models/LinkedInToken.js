const mongoose = require('mongoose');

const LinkedInTokenSchema = new mongoose.Schema(
  {
    // Standard primary key across platforms: Clerk user ID
    clerkUserId: { type: String, index: true, required: false },
    email: { type: String, default: null },

    // Back-compat reference to User document (may be absent going forward)
    userId: { type: String, default: null }, // optional app user id

    // LinkedIn account info
    linkedinUserId: { type: String, required: true },
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

// helpful indexes
LinkedInTokenSchema.index({ clerkUserId: 1, provider: 1 });
LinkedInTokenSchema.index({ userId: 1, provider: 1 });
LinkedInTokenSchema.index({ linkedinUserId: 1 }, { unique: true });
LinkedInTokenSchema.index({ email: 1 });

module.exports = mongoose.model('LinkedInToken', LinkedInTokenSchema);
