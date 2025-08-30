const mongoose = require('mongoose');
const TwitterToken = require('./models/TwitterToken');
const LinkedInToken = require('./models/LinkedInToken');
const InstagramToken = require('./models/InstagramToken');
const FacebookToken = require('./models/FacebookToken');
const TikTokToken = require('./models/TikTokToken');
const YouTubeToken = require('./models/YouTubeToken');

async function checkTokens() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Get command line arguments
    const args = process.argv.slice(2);
    const showAll = args.includes('--all');
    const userId = args.find(arg => arg.startsWith('--user='))?.split('=')[1];
    const limit = parseInt(args.find(arg => arg.startsWith('--limit='))?.split('=')[1]) || 10;
    const summaryOnly = args.includes('--summary');
    
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
      process.exit(0);
    }
    
    console.log(`Found ${allUsers.size} user(s) in database`);
    
    // If specific user requested
    if (userId) {
      if (!allUsers.has(userId)) {
        console.log(`User ${userId} not found in database`);
        process.exit(0);
      }
      await checkUserTokens(userId);
      process.exit(0);
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
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
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

// Show usage if no arguments or help requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Usage: node check-tokens.js [options]

Options:
  --all              Show all users (default: limit to 10)
  --user=USER_ID     Check specific user only
  --limit=N          Show first N users (default: 10)
  --summary          Show only summary statistics
  --help, -h         Show this help message

Examples:
  node check-tokens.js                    # Show first 10 users
  node check-tokens.js --limit=20         # Show first 20 users
  node check-tokens.js --all              # Show all users
  node check-tokens.js --summary          # Show only statistics
  node check-tokens.js --user=user_123    # Check specific user
  `);
  process.exit(0);
}

checkTokens();
