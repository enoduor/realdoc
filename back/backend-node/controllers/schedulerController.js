const ScheduledPost = require('../models/ScheduledPost');
const platformPublisher = require('../services/platformPublisher');

// Schedule a post
exports.schedulePost = async (req, res) => {
    try {
        const { datetime, platforms, content } = req.body;
        const userId = req.user.userId;

        // Validate required fields
        if (!datetime || !platforms || platforms.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Datetime and platforms are required'
            });
        }

        // Validate scheduled time is in the future
        const scheduledTime = new Date(datetime);
        if (scheduledTime <= new Date()) {
            return res.status(400).json({
                success: false,
                message: 'Scheduled time must be in the future'
            });
        }

        // Initialize publish results for each platform
        const publishResults = platforms.map(platform => ({
            platform,
            status: 'pending'
        }));

        // Create scheduled post
        const scheduledPost = new ScheduledPost({
            mediaUrl: content.mediaUrl,
            mediaType: content.mediaType,
            caption: content.caption,
            hashtags: content.hashtags,
            platforms,
            scheduledAt: scheduledTime,
            publishResults,
            createdBy: userId
        });

        await scheduledPost.save();

        console.log(`📅 Post scheduled for ${scheduledTime} on platforms: ${platforms.join(', ')}`);

        res.status(201).json({
            success: true,
            message: 'Post scheduled successfully',
            post: {
                id: scheduledPost._id,
                scheduledAt: scheduledPost.scheduledAt,
                platforms: scheduledPost.platforms,
                status: scheduledPost.status
            }
        });

    } catch (error) {
        console.error('Error scheduling post:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to schedule post',
            error: error.message
        });
    }
};

// Publish post immediately
exports.publishNow = async (req, res) => {
    try {
        const { platforms, content } = req.body;
        const userId = req.user.userId;

        // Validate required fields
        if (!platforms || platforms.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one platform is required'
            });
        }

        // Create immediate post
        const scheduledPost = new ScheduledPost({
            mediaUrl: content.mediaUrl,
            mediaType: content.mediaType,
            caption: content.caption,
            hashtags: content.hashtags,
            platforms,
            scheduledAt: new Date(),
            status: 'pending',
            publishResults: platforms.map(platform => ({
                platform,
                status: 'pending'
            })),
            createdBy: userId
        });

        await scheduledPost.save();

        // Publish to all platforms
        const publishResults = [];
        for (const platform of platforms) {
            try {
                const result = await platformPublisher.publishToPlatform(platform, content);
                
                if (result.success) {
                    await scheduledPost.markAsPublished(platform, result.postId);
                } else {
                    await scheduledPost.markAsFailed(platform, result.error);
                }
                
                publishResults.push(result);
            } catch (error) {
                await scheduledPost.markAsFailed(platform, error.message);
                publishResults.push({
                    success: false,
                    platform,
                    error: error.message
                });
            }
        }

        // Update post status
        await scheduledPost.save();

        res.json({
            success: true,
            message: 'Post published',
            post: {
                id: scheduledPost._id,
                status: scheduledPost.status,
                results: publishResults
            }
        });

    } catch (error) {
        console.error('Error publishing post:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to publish post',
            error: error.message
        });
    }
};

// Get user's scheduled posts
exports.getUserPosts = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { status, page = 1, limit = 10 } = req.query;

        const query = { createdBy: userId };
        if (status) {
            query.status = status;
        }

        const posts = await ScheduledPost.find(query)
            .sort({ scheduledAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .populate('createdBy', 'email');

        const total = await ScheduledPost.countDocuments(query);

        res.json({
            success: true,
            posts,
            pagination: {
                current: page,
                pages: Math.ceil(total / limit),
                total
            }
        });

    } catch (error) {
        console.error('Error fetching posts:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch posts',
            error: error.message
        });
    }
};

// Get specific post
exports.getPost = async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.userId;

        const post = await ScheduledPost.findOne({
            _id: postId,
            createdBy: userId
        }).populate('createdBy', 'email');

        if (!post) {
            return res.status(404).json({
                success: false,
                message: 'Post not found'
            });
        }

        res.json({
            success: true,
            post
        });

    } catch (error) {
        console.error('Error fetching post:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch post',
            error: error.message
        });
    }
};

// Update scheduled post
exports.updatePost = async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.userId;
        const updates = req.body;

        const post = await ScheduledPost.findOne({
            _id: postId,
            createdBy: userId,
            status: 'scheduled'
        });

        if (!post) {
            return res.status(404).json({
                success: false,
                message: 'Post not found or cannot be updated'
            });
        }

        // Only allow updates to certain fields
        const allowedUpdates = ['caption', 'hashtags', 'scheduledAt', 'platforms'];
        for (const field of allowedUpdates) {
            if (updates[field] !== undefined) {
                post[field] = updates[field];
            }
        }

        await post.save();

        res.json({
            success: true,
            message: 'Post updated successfully',
            post
        });

    } catch (error) {
        console.error('Error updating post:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update post',
            error: error.message
        });
    }
};

// Delete scheduled post
exports.deletePost = async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.userId;

        const post = await ScheduledPost.findOneAndDelete({
            _id: postId,
            createdBy: userId,
            status: 'scheduled'
        });

        if (!post) {
            return res.status(404).json({
                success: false,
                message: 'Post not found or cannot be deleted'
            });
        }

        res.json({
            success: true,
            message: 'Post deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting post:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete post',
            error: error.message
        });
    }
};

// Retry failed post
exports.retryPost = async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.userId;

        const post = await ScheduledPost.findOne({
            _id: postId,
            createdBy: userId,
            status: 'failed'
        });

        if (!post) {
            return res.status(404).json({
                success: false,
                message: 'Failed post not found'
            });
        }

        // Reset status and retry count
        post.status = 'pending';
        post.retryCount = 0;
        post.error = null;

        // Reset publish results
        post.publishResults.forEach(result => {
            if (result.status === 'failed') {
                result.status = 'pending';
                result.error = null;
            }
        });

        await post.save();

        // Attempt to publish again
        const content = {
            mediaUrl: post.mediaUrl,
            mediaType: post.mediaType,
            caption: post.caption,
            hashtags: post.hashtags
        };

        const publishResults = [];
        for (const platform of post.platforms) {
            try {
                const result = await platformPublisher.publishToPlatform(platform, content);
                
                if (result.success) {
                    await post.markAsPublished(platform, result.postId);
                } else {
                    await post.markAsFailed(platform, result.error);
                }
                
                publishResults.push(result);
            } catch (error) {
                await post.markAsFailed(platform, error.message);
                publishResults.push({
                    success: false,
                    platform,
                    error: error.message
                });
            }
        }

        await post.save();

        res.json({
            success: true,
            message: 'Post retry completed',
            post: {
                id: post._id,
                status: post.status,
                results: publishResults
            }
        });

    } catch (error) {
        console.error('Error retrying post:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retry post',
            error: error.message
        });
    }
};

// Get platform connection status
exports.getPlatformStatus = async (req, res) => {
    try {
        const platforms = ['instagram', 'tiktok', 'linkedin', 'twitter', 'youtube', 'facebook'];
        const statuses = {};

        for (const platform of platforms) {
            statuses[platform] = await platformPublisher.checkPlatformConnection(platform);
        }

        res.json({
            success: true,
            platforms: statuses
        });

    } catch (error) {
        console.error('Error checking platform status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check platform status',
            error: error.message
        });
    }
};
