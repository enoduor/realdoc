// /back/backend-node/models/User.js
const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    // Identity
    clerkUserId: {
      type: String,
      index: true,
      sparse: true,
      unique: true, // each Clerk user maps to exactly one record
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      index: true, // NOT unique (users can change email or pay with different email)
    },
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },

    // Stripe linkage
    stripeCustomerId: {
      type: String,
      index: true,
      sparse: true,
      unique: true, // one Stripe customer per user
      trim: true,
    },
    stripeSubscriptionId: {
      type: String,
      index: true,
      sparse: true,
      trim: true,
    },

    // Subscription / plan state
    subscriptionStatus: {
      type: String,
      enum: [
        "none",
        "trialing",
        "active",
        "past_due",
        "unpaid",
        "canceled",
        "incomplete",
        "incomplete_expired",
        "paused",
        "unknown",
      ],
      default: "none",
      index: true,
    },
    selectedPlan: {
      type: String,
      enum: ["starter", "creator", "enterprise", "none", "unknown"],
      default: "none",
      index: true,
    },
    billingCycle: {
      type: String,
      enum: ["monthly", "yearly", "none", "unknown"],
      default: "none",
      index: true,
    },

    // Trial dates (from Stripe) — store as Date for easy comparisons
    trialStartDate: { type: Date },
    trialEndDate: { type: Date },

    // App usage
    trialDaysRemaining: { type: Number, default: 0, min: 0 },
    postsCreated: { type: Number, default: 0, min: 0 },
    accountsConnected: { type: Number, default: 0, min: 0 },

    dailyPostsUsed: { type: Number, default: 0, min: 0 },
    lastPostDate: { type: Date, default: null },
    dailyLimitResetAt: { type: Date, default: null },

    // Activity tracking
    lastActiveDate: { type: Date, default: null },

    // Housekeeping / migrations
    mergedIntoUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true, // adds createdAt, updatedAt
    versionKey: false,
  }
);

/**
 * Indexes
 * - Unique+sparse on clerkUserId and stripeCustomerId prevent duplicate identities.
 * - Additional indexes speed up dashboards/admin queries.
 */
UserSchema.index({ subscriptionStatus: 1, selectedPlan: 1 });
UserSchema.index({ lastActiveDate: -1 });
UserSchema.index({ createdAt: -1 });

/**
 * Helper: full name (safe)
 */
UserSchema.virtual("fullName").get(function () {
  const f = this.firstName || "";
  const l = this.lastName || "";
  return `${f} ${l}`.trim();
});

/**
 * Helper: isTrialActive
 */
UserSchema.methods.isTrialActive = function () {
  if (!this.trialEndDate) return false;
  return new Date() <= this.trialEndDate;
};

/**
 * Helper: resetDailyCountersIfNeeded
 * Call this in a request middleware or cron if you enforce daily limits.
 */
UserSchema.methods.resetDailyCountersIfNeeded = function (now = new Date()) {
  if (!this.dailyLimitResetAt || now >= this.dailyLimitResetAt) {
    this.dailyPostsUsed = 0;
    // next reset at midnight UTC (adjust if you store per-user timezones)
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    this.dailyLimitResetAt = next;
  }
};

/**
 * Helper: hasActiveSubscription
 * Check if user has an active subscription (including trial)
 */
UserSchema.methods.hasActiveSubscription = function () {
  return this.subscriptionStatus === 'active' || 
         this.subscriptionStatus === 'trialing' || 
         this.isTrialActive();
};

/**
 * Helper: getDailyPostLimit
 * Get the daily post limit based on subscription status and plan.
 * - Trialing users: capped at 5/day
 * - Starter: 1/day
 * - Creator: 5/day
 * - Enterprise: high cap (effectively unlimited for normal usage)
 */
UserSchema.methods.getDailyPostLimit = function () {
  // During trial period, standardize at 5 posts/day
  if (this.subscriptionStatus === 'trialing' || this.isTrialActive()) {
    return 5;
  }

  const plan = (this.selectedPlan || 'none').toLowerCase();

  switch (plan) {
    case 'starter':
      return 1;
    case 'creator':
      return 5;
    case 'enterprise':
      // Effectively "unlimited"; keep within integer bounds
      return Number.MAX_SAFE_INTEGER;
    default:
      return 0;
  }
};

/**
 * Helper: canPublishToday
 * Check if user can publish today based on daily limits
 */
UserSchema.methods.canPublishToday = function() {
  const now = new Date();
  
  // Reset daily counters if needed
  this.resetDailyCountersIfNeeded(now);
  
  const dailyLimit = this.getDailyPostLimit();
  const used = this.dailyPostsUsed || 0;
  
  return {
    canPublish: used < dailyLimit,
    used: used,
    limit: dailyLimit,
    remaining: Math.max(0, dailyLimit - used),
    resetAt: this.dailyLimitResetAt
  };
};

/**
 * Helper: incrementDailyUsage
 * Increments today's counters and persists.
 */
UserSchema.methods.incrementDailyUsage = async function () {
  const now = new Date();
  this.resetDailyCountersIfNeeded(now);
  this.dailyPostsUsed = (this.dailyPostsUsed || 0) + 1;
  this.postsCreated = (this.postsCreated || 0) + 1;
  this.lastPostDate = now; // Set the last post date
  await this.save();
};

/**
 * Helper: calculateTrialDaysRemaining
 * Calculate remaining trial days
 */
UserSchema.methods.calculateTrialDaysRemaining = function() {
  if (!this.trialEndDate) return 0;
  const now = new Date();
  const diffTime = this.trialEndDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
};

/**
 * Helper: syncTrialDaysRemaining
 * Updates the stored numeric field from current dates.
 */
UserSchema.methods.syncTrialDaysRemaining = function () {
  this.trialDaysRemaining = this.calculateTrialDaysRemaining();
};

/**
 * Keep trialDaysRemaining in sync on save
 */
UserSchema.pre('save', function (next) {
  try {
    this.syncTrialDaysRemaining();
  } catch (e) {
    // non-fatal
  }
  next();
});

/**
 * Helper: canCreatePosts
 * Check if user can create posts (alias for hasActiveSubscription)
 */
UserSchema.methods.canCreatePosts = function() {
  return this.hasActiveSubscription();
};

/**
 * Helper method to delete all user tokens
 */
UserSchema.methods.deleteAllTokens = async function() {
  const email = this.email;
  
  if (!email) {
    console.log('⚠️ No email found, skipping token deletion');
    return;
  }
  
  try {
    console.log(`🗑️ Deleting all tokens for user email: ${email}`);
    
    // Import token models
    const TwitterToken = require('./TwitterToken');
    const LinkedInToken = require('./LinkedInToken');
    const InstagramToken = require('./InstagramToken');
    const FacebookToken = require('./FacebookToken');
    const TikTokToken = require('./TikTokToken');
    const YouTubeToken = require('./YouTubeToken');
    const ScheduledPost = require('./ScheduledPost');
    
    // Delete all platform tokens by email
    const tokenDeletions = await Promise.allSettled([
      TwitterToken.deleteMany({ email }),
      LinkedInToken.deleteMany({ email }),
      InstagramToken.deleteMany({ email }),
      FacebookToken.deleteMany({ email }),
      TikTokToken.deleteMany({ email }),
      YouTubeToken.deleteMany({ email }),
      ScheduledPost.deleteMany({ email })
    ]);
    
    // Log results
    const platforms = ['Twitter', 'LinkedIn', 'Instagram', 'Facebook', 'TikTok', 'YouTube', 'ScheduledPost'];
    tokenDeletions.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        console.log(`✅ Deleted ${result.value.deletedCount} ${platforms[index]} records`);
      } else {
        console.error(`❌ Failed to delete ${platforms[index]}:`, result.reason);
      }
    });
    
    console.log(`🎉 Token cleanup completed for user email: ${email}`);
  } catch (error) {
    console.error('❌ Error deleting user tokens:', error);
    throw error; // Re-throw to let caller handle
  }
};

/**
 * Pre-delete hook: Delete all associated tokens when user is deleted (document-based)
 */
UserSchema.pre('deleteOne', { document: true, query: false }, async function() {
  await this.deleteAllTokens();
});

/**
 * Pre-delete hook: Delete all associated tokens when user is deleted (query-based)
 */
UserSchema.pre('deleteOne', { document: false, query: true }, async function() {
  const query = this.getQuery();
  const email = query.email;
  const clerkUserId = query.clerkUserId;
  
  if (!email && !clerkUserId) return;
  
  // If we have clerkUserId but no email, get the user's email first
  let userEmail = email;
  if (!userEmail && clerkUserId) {
    const user = await this.model.findOne({ clerkUserId });
    if (user) userEmail = user.email;
  }
  
  if (!userEmail) {
    console.log('⚠️ No email found for user deletion, skipping token cleanup');
    return;
  }
  
  try {
    console.log(`🗑️ Deleting all tokens for user email: ${userEmail}`);
    
    // Import token models
    const TwitterToken = require('./TwitterToken');
    const LinkedInToken = require('./LinkedInToken');
    const InstagramToken = require('./InstagramToken');
    const FacebookToken = require('./FacebookToken');
    const TikTokToken = require('./TikTokToken');
    const YouTubeToken = require('./YouTubeToken');
    const ScheduledPost = require('./ScheduledPost');
    
    // Delete all platform tokens by email
    const tokenDeletions = await Promise.allSettled([
      TwitterToken.deleteMany({ email: userEmail }),
      LinkedInToken.deleteMany({ email: userEmail }),
      InstagramToken.deleteMany({ email: userEmail }),
      FacebookToken.deleteMany({ email: userEmail }),
      TikTokToken.deleteMany({ email: userEmail }),
      YouTubeToken.deleteMany({ email: userEmail }),
      ScheduledPost.deleteMany({ email: userEmail })
    ]);
    
    // Log results
    const platforms = ['Twitter', 'LinkedIn', 'Instagram', 'Facebook', 'TikTok', 'YouTube', 'ScheduledPost'];
    tokenDeletions.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        console.log(`✅ Deleted ${result.value.deletedCount} ${platforms[index]} records`);
      } else {
        console.error(`❌ Failed to delete ${platforms[index]}:`, result.reason);
      }
    });
    
    console.log(`🎉 Token cleanup completed for user email: ${userEmail}`);
  } catch (error) {
    console.error('❌ Error deleting user tokens:', error);
    // Don't throw error to prevent user deletion from failing
  }
});

/**
 * Pre-delete hook for findOneAndDelete and deleteOne queries
 */
UserSchema.pre('findOneAndDelete', async function() {
  const query = this.getQuery();
  const email = query.email;
  
  if (!email) return;
  
  try {
    console.log(`🗑️ Deleting all tokens for user email: ${email}`);
    
    // Import token models
    const TwitterToken = require('./TwitterToken');
    const LinkedInToken = require('./LinkedInToken');
    const InstagramToken = require('./InstagramToken');
    const FacebookToken = require('./FacebookToken');
    const TikTokToken = require('./TikTokToken');
    const YouTubeToken = require('./YouTubeToken');
    const ScheduledPost = require('./ScheduledPost');
    
    // Delete all platform tokens by email
    const tokenDeletions = await Promise.allSettled([
      TwitterToken.deleteMany({ email }),
      LinkedInToken.deleteMany({ email }),
      InstagramToken.deleteMany({ email }),
      FacebookToken.deleteMany({ email }),
      TikTokToken.deleteMany({ email }),
      YouTubeToken.deleteMany({ email }),
      ScheduledPost.deleteMany({ email })
    ]);
    
    // Log results
    const platforms = ['Twitter', 'LinkedIn', 'Instagram', 'Facebook', 'TikTok', 'YouTube', 'ScheduledPost'];
    tokenDeletions.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        console.log(`✅ Deleted ${result.value.deletedCount} ${platforms[index]} records`);
      } else {
        console.error(`❌ Failed to delete ${platforms[index]}:`, result.reason);
      }
    });
    
    console.log(`🎉 Token cleanup completed for user email: ${email}`);
  } catch (error) {
    console.error('❌ Error deleting user tokens:', error);
    // Don't throw error to prevent user deletion from failing
  }
});

module.exports = mongoose.model("User", UserSchema);