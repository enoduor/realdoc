#!/usr/bin/env node

/**
 * Unified Token Management Utility
 * Complete token inspection, deletion, and user management tool
 * Replaces: check-tokens.js, delete-user-with-tokens.js, test-user-deletion.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const TwitterToken = require('./models/TwitterToken');
const LinkedInToken = require('./models/LinkedInToken');
const InstagramToken = require('./models/InstagramToken');
const FacebookToken = require('./models/FacebookToken');
const TikTokToken = require('./models/TikTokToken');
const YouTubeToken = require('./models/YouTubeToken');
const ScheduledPost = require('./models/ScheduledPost');

async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get command line arguments
    const args = process.argv.slice(2);
    const action = args[0];
    const userId = args.find(arg => arg.startsWith('--user='))?.split('=')[1];
    const showAll = args.includes('--all');
    const limit = parseInt(args.find(arg => arg.startsWith('--limit='))?.split('=')[1]) || 10;
    const summaryOnly = args.includes('--summary');

    if (action === 'check' || !action) {
      await checkTokens(userId, showAll, limit, summaryOnly);
    } else if (action === 'delete') {
      if (!userId) {
        console.log('❌ --user=USER_ID is required for delete action');
        console.log('Usage: node test-token-deletion.js delete --user=USER_ID');
        return;
      }
      await deleteUserWithTokens(userId);
    } else if (action === 'help') {
      showHelp();
    } else {
      console.log('❌ Unknown action:', action);
      showHelp();
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed');
  }
}

async function checkTokens(userId, showAll, limit, summaryOnly) {
  // Get all unique users from all token collections
  const allUsers = new Set();
  
  const [twitterUsers, linkedinUsers, instagramUsers, facebookUsers, tiktokUsers, youtubeUsers] = await Promise.all([
    TwitterToken.distinct('clerkUserId'),
    LinkedInToken.distinct('clerkUserId'),
    InstagramToken.distinct('clerkUserId'),
    FacebookToken.distinct('clerkUserId'),
    TikTokToken.distinct('clerkUserId'),
    YouTubeToken.distinct('clerkUserId')
  ]);
  
  // Combine all users
  [twitterUsers, linkedinUsers, instagramUsers, facebookUsers, tiktokUsers, youtubeUsers].forEach(users => {
    users.forEach(userId => allUsers.add(userId));
  });
  
  if (allUsers.size === 0) {
    console.log('No users found in database');
    return;
  }
  
  console.log(`Found ${allUsers.size} user(s) in database`);
  
  // If specific user requested
  if (userId) {
    if (!allUsers.has(userId)) {
      console.log(`User ${userId} not found in database`);
      return;
    }
    await checkUserTokens(userId);
    return;
  }
  
  // Show summary statistics
  if (summaryOnly || allUsers.size > 50) {
    await showSummary(allUsers);
    if (!showAll) {
      console.log('\nUse --all to see individual user details');
      console.log('Use --user=USER_ID to check specific user');
      console.log('Use --limit=N to show first N users');
    }
  }
  
  // Show individual users (limited by default)
  if (showAll || allUsers.size <= 50) {
    const usersArray = Array.from(allUsers).slice(0, limit);
    console.log(`\nShowing first ${usersArray.length} users:\n`);
    
    for (const clerkUserId of usersArray) {
      await checkUserTokens(clerkUserId);
    }
    
    if (allUsers.size > limit) {
      console.log(`\n... and ${allUsers.size - limit} more users`);
      console.log('Use --all to see all users or --limit=N to see more');
    }
  }
}

async function checkUserTokens(clerkUserId) {
  const [twitterToken, linkedinToken, instagramToken, facebookToken, tiktokToken, youtubeToken] = await Promise.all([
    TwitterToken.findOne({ clerkUserId }),
    LinkedInToken.findOne({ clerkUserId }),
    InstagramToken.findOne({ clerkUserId, isActive: true }),
    FacebookToken.findOne({ clerkUserId, isActive: true }),
    TikTokToken.findOne({ clerkUserId }),
    YouTubeToken.findOne({ clerkUserId, isActive: true })
  ]);
  
  console.log(`=== User: ${clerkUserId} ===`);
  console.log('Platform Status:');
  console.log('Twitter:', !!twitterToken ? '✅' : '❌');
  console.log('LinkedIn:', !!linkedinToken ? '✅' : '❌');
  console.log('Instagram:', !!instagramToken ? '✅' : '❌');
  console.log('Facebook:', !!facebookToken ? '✅' : '❌');
  console.log('TikTok:', !!tiktokToken ? '✅' : '❌');
  console.log('YouTube:', !!youtubeToken ? '✅' : '❌');
  
  const connectedPlatforms = [twitterToken, linkedinToken, instagramToken, facebookToken, tiktokToken, youtubeToken].filter(Boolean).length;
  console.log(`Connected platforms: ${connectedPlatforms}/6`);
  
  // Show details for connected platforms
  if (twitterToken) {
    console.log('Twitter:', {
      handle: twitterToken.handle,
      twitterUserId: twitterToken.twitterUserId,
      isActive: twitterToken.isActive
    });
  }
  
  if (linkedinToken) {
    console.log('LinkedIn:', {
      firstName: linkedinToken.firstName,
      lastName: linkedinToken.lastName,
      linkedinUserId: linkedinToken.linkedinUserId,
      isActive: linkedinToken.isActive
    });
  }
  
  if (instagramToken) {
    console.log('Instagram:', {
      username: instagramToken.username,
      igUserId: instagramToken.igUserId,
      isActive: instagramToken.isActive
    });
  }
  
  if (facebookToken) {
    console.log('Facebook:', {
      facebookUserId: facebookToken.facebookUserId,
      isActive: facebookToken.isActive
    });
  }
  
  if (tiktokToken) {
    console.log('TikTok:', {
      username: tiktokToken.username,
      userId: tiktokToken.userId,
      isActive: tiktokToken.isActive
    });
  }
  
  if (youtubeToken) {
    console.log('YouTube:', {
      channelTitle: youtubeToken.channelTitle,
      channelId: youtubeToken.channelId,
      isActive: youtubeToken.isActive
    });
  }
  
  console.log(''); // Empty line between users
}

async function showSummary(allUsers) {
  console.log('\n=== SUMMARY STATISTICS ===');
  
  // Platform connection counts
  const [twitterCount, linkedinCount, instagramCount, facebookCount, tiktokCount, youtubeCount] = await Promise.all([
    TwitterToken.countDocuments(),
    LinkedInToken.countDocuments(),
    InstagramToken.countDocuments({ isActive: true }),
    FacebookToken.countDocuments({ isActive: true }),
    TikTokToken.countDocuments(),
    YouTubeToken.countDocuments({ isActive: true })
  ]);
  
  console.log('Platform Connections:');
  console.log(`Twitter: ${twitterCount}`);
  console.log(`LinkedIn: ${linkedinCount}`);
  console.log(`Instagram: ${instagramCount}`);
  console.log(`Facebook: ${facebookCount}`);
  console.log(`TikTok: ${tiktokCount}`);
  console.log(`YouTube: ${youtubeCount}`);
  
  // User distribution by platform count
  const userPlatformCounts = {};
  
  for (const clerkUserId of allUsers) {
    const [twitterToken, linkedinToken, instagramToken, facebookToken, tiktokToken, youtubeToken] = await Promise.all([
      TwitterToken.findOne({ clerkUserId }),
      LinkedInToken.findOne({ clerkUserId }),
      InstagramToken.findOne({ clerkUserId, isActive: true }),
      FacebookToken.findOne({ clerkUserId, isActive: true }),
      TikTokToken.findOne({ clerkUserId }),
      YouTubeToken.findOne({ clerkUserId, isActive: true })
    ]);
    
    const connectedCount = [twitterToken, linkedinToken, instagramToken, facebookToken, tiktokToken, youtubeToken].filter(Boolean).length;
    userPlatformCounts[connectedCount] = (userPlatformCounts[connectedCount] || 0) + 1;
  }
  
  console.log('\nUsers by Platform Count:');
  for (let i = 0; i <= 6; i++) {
    const count = userPlatformCounts[i] || 0;
    const percentage = ((count / allUsers.size) * 100).toFixed(1);
    console.log(`${i} platforms: ${count} users (${percentage}%)`);
  }
}

async function deleteUserWithTokens(clerkUserId) {
  console.log(`🗑️ Deleting user and all tokens for: ${clerkUserId}`);

  // Find the user first
  const user = await User.findOne({ clerkUserId });
  if (!user) {
    console.log('❌ User not found');
    return;
  }

  console.log(`👤 Found user: ${user.email || 'No email'}`);

  // Count tokens before deletion
  console.log('\n📊 Tokens before deletion:');
  const beforeCounts = await Promise.all([
    TwitterToken.countDocuments({ clerkUserId }),
    LinkedInToken.countDocuments({ clerkUserId }),
    InstagramToken.countDocuments({ clerkUserId }),
    FacebookToken.countDocuments({ clerkUserId }),
    TikTokToken.countDocuments({ clerkUserId }),
    YouTubeToken.countDocuments({ clerkUserId }),
    ScheduledPost.countDocuments({ clerkUserId })
  ]);

  const platforms = ['Twitter', 'LinkedIn', 'Instagram', 'Facebook', 'TikTok', 'YouTube', 'ScheduledPost'];
  platforms.forEach((platform, index) => {
    console.log(`  ${platform}: ${beforeCounts[index]} records`);
  });

  // Delete all tokens
  console.log('\n🧹 Deleting all tokens...');
  const tokenDeletions = await Promise.allSettled([
    TwitterToken.deleteMany({ clerkUserId }),
    LinkedInToken.deleteMany({ clerkUserId }),
    InstagramToken.deleteMany({ clerkUserId }),
    FacebookToken.deleteMany({ clerkUserId }),
    TikTokToken.deleteMany({ clerkUserId }),
    YouTubeToken.deleteMany({ clerkUserId }),
    ScheduledPost.deleteMany({ clerkUserId })
  ]);

  // Log deletion results
  console.log('\n📊 Deletion results:');
  tokenDeletions.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      console.log(`  ✅ ${platforms[index]}: Deleted ${result.value.deletedCount} records`);
    } else {
      console.log(`  ❌ ${platforms[index]}: Failed - ${result.reason.message}`);
    }
  });

  // Delete the user
  console.log('\n🗑️ Deleting user...');
  const userDeletion = await User.deleteOne({ clerkUserId });
  console.log(`✅ User deletion result: ${userDeletion.deletedCount} user deleted`);

  // Verify deletion
  const remainingUser = await User.findOne({ clerkUserId });
  if (remainingUser) {
    console.log('❌ User still exists after deletion');
  } else {
    console.log('✅ User successfully deleted');
  }

  console.log('\n🎉 User and all associated tokens deleted successfully!');
}

function showHelp() {
  console.log(`
Token Management Utility

Usage: node test-token-deletion.js <action> [options]

Actions:
  check                 Check token status (default)
  delete               Delete user and all tokens
  help                 Show this help message

Options:
  --user=USER_ID       Target specific user
  --all                Show all users (check action)
  --limit=N            Show first N users (check action)
  --summary            Show only summary statistics (check action)

Examples:
  # Check tokens (default action)
  node test-token-deletion.js
  node test-token-deletion.js check
  node test-token-deletion.js check --all
  node test-token-deletion.js check --user=user_123
  node test-token-deletion.js check --summary

  # Delete user and all tokens
  node test-token-deletion.js delete --user=user_123

  # Show help
  node test-token-deletion.js help
  `);
}

main();
