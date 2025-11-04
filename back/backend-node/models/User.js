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
 * - Trialing users: 1/day
 * - Starter: 2/day
 * - Creator: 5/day
 * - Enterprise: high cap (effectively unlimited for normal usage)
 */
UserSchema.methods.getDailyPostLimit = function () {
  // During trial period, limit to 1 post/day for all plans
  // Only check subscriptionStatus, not isTrialActive(), so paid subscribers get their plan limits immediately
  if (this.subscriptionStatus === 'trialing') {
    return 1;
  }

  const plan = (this.selectedPlan || 'none').toLowerCase();

  switch (plan) {
    case 'starter':
      return 2;
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
 * Helper method to clean up user data
 * Note: This is a documentation generator, no social media tokens to clean up
 */
UserSchema.methods.deleteAllTokens = async function() {
  const clerkUserId = this.clerkUserId;
  
  console.log(`🔍 [User Cleanup] Starting cleanup for user:`, {
    clerkUserId: clerkUserId || 'MISSING',
    userDocumentId: this._id
  });
  
  if (!clerkUserId) {
    console.error('❌ [User Cleanup] No clerkUserId found, skipping cleanup');
    return;
  }
  
  console.log(`✅ [User Cleanup] Cleanup completed for clerkUserId: ${clerkUserId}`);
};

/**
 * Pre-delete hook: Clean up user data when user is deleted
 * Note: This is a documentation generator, no social media tokens to clean up
 */
UserSchema.pre('deleteOne', { document: false, query: true }, async function() {
  const query = this.getQuery();
  const clerkUserId = query.clerkUserId;
  
  console.log(`🔍 [Pre-Delete Hook] User deletion triggered with query:`, JSON.stringify(query, null, 2));
  
  if (!clerkUserId) {
    console.log('⚠️ [Pre-Delete Hook] No clerkUserId found in query');
    return;
  }
  
  console.log(`✅ [Pre-Delete Hook] User deletion cleanup for clerkUserId: ${clerkUserId}`);
});

/**
 * Pre-delete hook for findOneAndDelete queries
 * Note: This is a documentation generator, no social media tokens to clean up
 */
UserSchema.pre('findOneAndDelete', async function() {
  const query = this.getQuery();
  const clerkUserId = query.clerkUserId;
  
  console.log(`🔍 [FindOneAndDelete Hook] User deletion triggered with query:`, JSON.stringify(query, null, 2));
  
  if (!clerkUserId) {
    console.log('⚠️ [FindOneAndDelete Hook] No clerkUserId found in query');
    return;
  }
  
  console.log(`✅ [FindOneAndDelete Hook] User deletion cleanup for clerkUserId: ${clerkUserId}`);
});

module.exports = mongoose.model("User", UserSchema);