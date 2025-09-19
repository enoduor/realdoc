const mongoose = require('mongoose');

const PostUsageSchema = new mongoose.Schema({
  // User identification
  clerkUserId: {
    type: String,
    required: true,
    index: true
  },
  
  // Date tracking (YYYY-MM-DD format for easy querying)
  date: {
    type: String,
    required: true,
    index: true
  },
  
  // Usage tracking
  postsPublished: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Plan information
  plan: {
    type: String,
    enum: ['starter', 'creator'],
    required: true
  },
  
  // Daily limit for this plan
  dailyLimit: {
    type: Number,
    required: true
  },
  
  // Reset timing
  resetAt: {
    type: Date,
    required: true
  },
  
  // Detailed post tracking (optional - for analytics)
  posts: [{
    publishedAt: {
      type: Date,
      default: Date.now
    },
    platforms: [{
      type: String,
      enum: ['instagram', 'tiktok', 'linkedin', 'twitter', 'youtube', 'facebook']
    }],
    platformCount: {
      type: Number,
      default: 1
    }
  }],
  
  // Metadata
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index for efficient daily usage queries
PostUsageSchema.index({ clerkUserId: 1, date: 1 }, { unique: true });

// Index for cleanup of old records
PostUsageSchema.index({ resetAt: 1 });

// Update timestamp on save
PostUsageSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static method to get or create today's usage record
PostUsageSchema.statics.getTodayUsage = async function(clerkUserId, userPlan) {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const resetAt = new Date();
  resetAt.setUTCHours(24, 0, 0, 0); // Next midnight UTC
  
  // Define plan limits
  const planLimits = {
    starter: 1,
    creator: 5
  };
  
  const dailyLimit = planLimits[userPlan] || 1;
  
  // Find or create today's usage record
  let usage = await this.findOne({ clerkUserId, date: today });
  
  if (!usage) {
    usage = new this({
      clerkUserId,
      date: today,
      postsPublished: 0,
      plan: userPlan,
      dailyLimit,
      resetAt
    });
    await usage.save();
  }
  
  return usage;
};

// Static method to check if user can publish
PostUsageSchema.statics.canUserPublish = async function(clerkUserId, userPlan) {
  const usage = await this.getTodayUsage(clerkUserId, userPlan);
  
  return {
    canPublish: usage.postsPublished < usage.dailyLimit,
    used: usage.postsPublished,
    limit: usage.dailyLimit,
    remaining: Math.max(0, usage.dailyLimit - usage.postsPublished),
    resetAt: usage.resetAt
  };
};

// Instance method to increment usage
PostUsageSchema.methods.incrementUsage = function(platformCount = 1) {
  this.postsPublished += 1; // Increment by 1 post regardless of platform count
  
  // Add detailed tracking
  this.posts.push({
    publishedAt: new Date(),
    platformCount
  });
  
  return this.save();
};

// Static method to cleanup old usage records (older than 30 days)
PostUsageSchema.statics.cleanupOldRecords = async function() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  return this.deleteMany({
    resetAt: { $lt: thirtyDaysAgo }
  });
};

module.exports = mongoose.model('PostUsage', PostUsageSchema);
