const mongoose = require('mongoose');

const ScheduledPostSchema = new mongoose.Schema({
    // Content details
    mediaUrl: {
        type: String,
        required: false
    },
    mediaType: {
        type: String,
        enum: ['image', 'video', 'audio', 'document'],
        required: false
    },
    caption: {
        type: String,
        required: false
    },
    hashtags: [{
        type: String
    }],
    
    // Platform and scheduling
    platforms: [{
        type: String,
        enum: ['instagram', 'tiktok', 'linkedin', 'twitter', 'youtube', 'facebook'],
        required: true
    }],
    scheduledAt: {
        type: Date,
        required: true
    },
    
    // Status tracking
    status: {
        type: String,
        enum: ['scheduled', 'pending', 'published', 'failed'],
        default: 'scheduled'
    },
    
    // Publishing results
    publishResults: [{
        platform: {
            type: String,
            required: true
        },
        status: {
            type: String,
            enum: ['success', 'failed', 'pending'],
            default: 'pending'
        },
        postId: String, // Platform's post ID
        error: String,
        publishedAt: Date
    }],
    
    // Error handling
    error: {
        type: String,
        required: false
    },
    retryCount: {
        type: Number,
        default: 0
    },
    maxRetries: {
        type: Number,
        default: 3
    },
    
    // User and metadata
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
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

// Index for efficient querying
ScheduledPostSchema.index({ scheduledAt: 1, status: 1 });
ScheduledPostSchema.index({ createdBy: 1, status: 1 });
ScheduledPostSchema.index({ status: 1, scheduledAt: 1 });

// Pre-save middleware to update updatedAt
ScheduledPostSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// Instance method to check if post is ready to publish
ScheduledPostSchema.methods.isReadyToPublish = function() {
    return this.status === 'scheduled' && new Date() >= this.scheduledAt;
};

// Instance method to mark as published
ScheduledPostSchema.methods.markAsPublished = function(platform, postId) {
    const result = this.publishResults.find(r => r.platform === platform);
    if (result) {
        result.status = 'success';
        result.postId = postId;
        result.publishedAt = new Date();
    }
    
    // Check if all platforms are published
    const allPublished = this.publishResults.every(r => r.status === 'success');
    if (allPublished) {
        this.status = 'published';
    }
    
    return this.save();
};

// Instance method to mark as failed
ScheduledPostSchema.methods.markAsFailed = function(platform, error) {
    const result = this.publishResults.find(r => r.platform === platform);
    if (result) {
        result.status = 'failed';
        result.error = error;
    }
    
    this.retryCount += 1;
    if (this.retryCount >= this.maxRetries) {
        this.status = 'failed';
        this.error = `Failed after ${this.maxRetries} retries`;
    }
    
    return this.save();
};

// Static method to get posts ready for publishing
ScheduledPostSchema.statics.getReadyToPublish = function() {
    return this.find({
        status: 'scheduled',
        scheduledAt: { $lte: new Date() }
    }).populate('createdBy', 'email');
};

// Static method to get user's posts
ScheduledPostSchema.statics.getUserPosts = function(userId, status = null) {
    const query = { createdBy: userId };
    if (status) {
        query.status = status;
    }
    
    return this.find(query)
        .sort({ scheduledAt: -1 })
        .populate('createdBy', 'email');
};

module.exports = mongoose.model('ScheduledPost', ScheduledPostSchema);
