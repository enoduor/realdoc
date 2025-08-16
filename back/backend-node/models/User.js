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
  return ['trialing', 'active'].includes(this.subscriptionStatus);
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
userSchema.methods.isFileSizeAllowed = function(fileSizeMB) {
  const limits = this.getPlanLimits();
  return fileSizeMB <= limits.maxFileSize;
};

module.exports = mongoose.model('User', userSchema);