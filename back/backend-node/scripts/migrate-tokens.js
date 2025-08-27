require('dotenv').config();
const mongoose = require('mongoose');

// Import models
const TwitterToken = require('../models/TwitterToken');
const LinkedInToken = require('../models/LinkedInToken');
const InstagramToken = require('../models/InstagramToken');
const FacebookToken = require('../models/FacebookToken');
const TikTokToken = require('../models/TikTokToken');
const User = require('../models/User');

async function migrateTokens() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get the current user's Clerk ID
    const user = await User.findOne({ email: 'erick@oduor.net' });
    if (!user) {
      console.log('❌ User not found');
      return;
    }

    const clerkUserId = user.clerkUserId;
    console.log(`🔍 Found user: ${clerkUserId} (${user.email})`);

    // Update all platform tokens to include clerkUserId
    const updates = [];

    // Twitter tokens - only update valid ones
    const twitterTokens = await TwitterToken.find({ userId: clerkUserId });
    console.log(`📱 Found ${twitterTokens.length} Twitter tokens`);
    for (const token of twitterTokens) {
      if (!token.clerkUserId && token.oauthToken && token.oauthTokenSecret) {
        token.clerkUserId = clerkUserId;
        await token.save();
        updates.push('Twitter');
        console.log('  ✅ Updated Twitter token');
      } else if (!token.oauthToken || !token.oauthTokenSecret) {
        console.log('  ⚠️  Skipping invalid Twitter token');
      }
    }

    // LinkedIn tokens
    const linkedinTokens = await LinkedInToken.find({ userId: clerkUserId });
    console.log(`💼 Found ${linkedinTokens.length} LinkedIn tokens`);
    for (const token of linkedinTokens) {
      if (!token.clerkUserId && token.accessToken) {
        token.clerkUserId = clerkUserId;
        await token.save();
        updates.push('LinkedIn');
        console.log('  ✅ Updated LinkedIn token');
      }
    }

    // Instagram tokens
    const instagramTokens = await InstagramToken.find({ userId: clerkUserId });
    console.log(`📸 Found ${instagramTokens.length} Instagram tokens`);
    for (const token of instagramTokens) {
      if (!token.clerkUserId && token.accessToken) {
        token.clerkUserId = clerkUserId;
        await token.save();
        updates.push('Instagram');
        console.log('  ✅ Updated Instagram token');
      }
    }

    // Facebook tokens
    const facebookTokens = await FacebookToken.find({ userId: clerkUserId });
    console.log(`👤 Found ${facebookTokens.length} Facebook tokens`);
    for (const token of facebookTokens) {
      if (!token.clerkUserId && token.accessToken) {
        token.clerkUserId = clerkUserId;
        await token.save();
        updates.push('Facebook');
        console.log('  ✅ Updated Facebook token');
      }
    }

    // TikTok tokens - handle different userId field type
    const tiktokTokens = await TikTokToken.find({});
    console.log(`🎵 Found ${tiktokTokens.length} TikTok tokens total`);
    for (const token of tiktokTokens) {
      // Check if this token belongs to our user (by email or other means)
      if (!token.clerkUserId && token.accessToken && 
          (token.email === user.email || token.userId === user._id)) {
        token.clerkUserId = clerkUserId;
        await token.save();
        updates.push('TikTok');
        console.log('  ✅ Updated TikTok token');
      }
    }

    console.log('✅ Migration completed!');
    console.log(`📊 Updated tokens: ${updates.join(', ')}`);

    // Verify the migration
    console.log('\n🔍 Verifying migration...');
    const { getUserPlatformTokens } = require('../utils/tokenUtils');
    const userTokens = await getUserPlatformTokens(clerkUserId);
    
    console.log('📱 Platform tokens found:');
    Object.entries(userTokens).forEach(([platform, token]) => {
      if (token) {
        console.log(`  ✅ ${platform}: ${token.clerkUserId ? 'Has clerkUserId' : 'Missing clerkUserId'}`);
      } else {
        console.log(`  ❌ ${platform}: No token found`);
      }
    });

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

migrateTokens();
