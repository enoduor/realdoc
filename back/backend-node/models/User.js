const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // Clerk Integration
  clerkUserId: {
    type: String,
    required: false, // Make optional for temporary users
    unique: true,
    sparse: true, // Allow multiple null values
    index: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  firstName: String,
  lastName: String,
  imageUrl: String,

  // Stripe Integration
  stripeCustomerId: {
    type: String,
    unique: true,
    sparse: true
  },
  stripeSubscriptionId: {
    type: String,
    unique: true,
    sparse: true
  },

  // Subscription Management
  subscriptionStatus: {
    type: String,
    enum: ['none', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'expired'],
    default: 'none'
  },
  selectedPlan: {
    type: String,
    enum: ['starter', 'creator', 'pro'],
    default: 'starter'
  },
  billingCycle: {
    type: String,
    enum: ['monthly', 'yearly'],
    default: 'monthly'
  },

  // Trial Management
  trialStartDate: Date,
  trialEndDate: Date,
  trialDaysRemaining: {
    type: Number,
    default: 0
  },

  // Usage Tracking
  postsCreated: {
    type: Number,
    default: 0
  },
  accountsConnected: {
    type: Number,
    default: 0
  },
  lastActiveDate: {
    type: Date,
    default: Date.now
  },

  // Daily Post Limits (NEW)
  dailyPostsUsed: {
    type: Number,
    default: 0
  },
  lastPostDate: {
    type: String, // YYYY-MM-DD format
    default: null
  },
  dailyLimitResetAt: {
    type: Date,
    default: null
  },

  // Metadata
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp on save
userSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Calculate trial days remaining
userSchema.methods.calculateTrialDaysRemaining = function() {
  if (!this.trialEndDate || this.subscriptionStatus !== 'trialing') {
    return 0;
  }
  
  const now = new Date();
  const trialEnd = new Date(this.trialEndDate);
  const diffTime = trialEnd - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(0, diffDays);
};

// Check if user has active subscription
userSchema.methods.hasActiveSubscription = function() {
  // User has active subscription ONLY if status is 'active' (confirmed payment)
  // selectedPlan is just a preference - subscriptionStatus confirms payment
  return this.subscriptionStatus === 'active';
};

// Check if user can create posts
userSchema.methods.canCreatePosts = function() {
  return this.hasActiveSubscription();
};

// Get plan limits
userSchema.methods.getPlanLimits = function() {
  const limits = {
    starter: {
      maxAccounts: 5,
      maxFileSize: 250, // MB
      features: ['basic_scheduling', 'ai_captions', 'hashtags']
    },
    creator: {
      maxAccounts: 15,
      maxFileSize: 500, // MB
      features: ['basic_scheduling', 'ai_captions', 'hashtags', 'bulk_scheduling', 'content_studio']
    },
    pro: {
      maxAccounts: -1, // unlimited
      maxFileSize: 500, // MB
      features: ['basic_scheduling', 'ai_captions', 'hashtags', 'bulk_scheduling', 'content_studio', 'growth_consulting']
    }
  };
  
  return limits[this.selectedPlan] || limits.starter;
};

// Check if user can access feature
userSchema.methods.canAccessFeature = function(feature) {
  const limits = this.getPlanLimits();
  return limits.features.includes(feature);
};

// Check if user can connect more accounts
userSchema.methods.canConnectMoreAccounts = function() {
  const limits = this.getPlanLimits();
  if (limits.maxAccounts === -1) return true; // unlimited
  return this.accountsConnected < limits.maxAccounts;
};

// Check if file size is within limits
userSchema.methods.isFileSizeAllowed = function(fileSizeInMB) {
  const limits = this.getPlanLimits();
  return fileSizeInMB <= limits.maxFileSize;
};

// Get daily post limit for user's plan
userSchema.methods.getDailyPostLimit = function() {
  const planLimits = {
    starter: 1,
    creator: 5
  };
  return planLimits[this.selectedPlan] || 1;
};

// Check if user can publish today
userSchema.methods.canPublishToday = function() {
  const today = new Date().toISOString().split('T')[0];
  const dailyLimit = this.getDailyPostLimit();
  
  // Reset counter if it's a new day
  if (this.lastPostDate !== today) {
    return {
      canPublish: true,
      used: 0,
      limit: dailyLimit,
      remaining: dailyLimit,
      resetAt: this.getNextResetTime()
    };
  }
  
  return {
    canPublish: this.dailyPostsUsed < dailyLimit,
    used: this.dailyPostsUsed,
    limit: dailyLimit,
    remaining: Math.max(0, dailyLimit - this.dailyPostsUsed),
    resetAt: this.dailyLimitResetAt
  };
};

// Increment daily usage counter
userSchema.methods.incrementDailyUsage = function() {
  const today = new Date().toISOString().split('T')[0];
  
  // Reset if new day
  if (this.lastPostDate !== today) {
    this.dailyPostsUsed = 0;
    this.lastPostDate = today;
    this.dailyLimitResetAt = this.getNextResetTime();
  }
  
  this.dailyPostsUsed += 1;
  this.postsCreated += 1; // Overall counter
  this.lastActiveDate = new Date();
  
  return this.save();
};

// Get next reset time (midnight UTC)
userSchema.methods.getNextResetTime = function() {
  const resetTime = new Date();
  resetTime.setUTCDate(resetTime.getUTCDate() + 1);
  resetTime.setUTCHours(0, 0, 0, 0);
  return resetTime;
};

// Reset daily usage (called by cron job or manually)
userSchema.methods.resetDailyUsage = function() {
  this.dailyPostsUsed = 0;
  this.lastPostDate = null;
  this.dailyLimitResetAt = null;
  return this.save();
};

module.exports = mongoose.model('User', userSchema);