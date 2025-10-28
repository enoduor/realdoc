#!/usr/bin/env node

/**
 * Sora Credits Sync Script
 * 
 * This script syncs Sora video credits for users who purchased them
 * but didn't receive credits due to webhook issues.
 * 
 * Usage:
 *   node scripts/sync-sora-credits.js --user "user_34dlUgUHHJNWHYczgXxW2UE22YL"
 *   node scripts/sync-sora-credits.js --session "cs_test_123..."
 *   node scripts/sync-sora-credits.js --all-users
 */

const mongoose = require('mongoose');
const Stripe = require('stripe');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/repostly';

// Stripe configuration
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// User schema (simplified for this script)
const userSchema = new mongoose.Schema({
  clerkUserId: { type: String, index: true, unique: true },
  email: String,
  firstName: String,
  lastName: String,
  soraVideoCredits: { type: Number, default: 0 },
  stripeCustomerId: String,
  createdAt: Date,
  updatedAt: Date
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--user' && args[i + 1]) {
      options.userId = args[i + 1];
      i++;
    } else if (arg === '--session' && args[i + 1]) {
      options.sessionId = args[i + 1];
      i++;
    } else if (arg === '--all-users') {
      options.allUsers = true;
    } else if (arg === '--help') {
      options.help = true;
    }
  }
  
  return options;
}

// Show help
function showHelp() {
  console.log(`
Sora Credits Sync Script

Usage:
  node scripts/sync-sora-credits.js --user "user_34dlUgUHHJNWHYczgXxW2UE22YL"
  node scripts/sync-sora-credits.js --session "cs_test_123..."
  node scripts/sync-sora-credits.js --all-users
  node scripts/sync-sora-credits.js --help

Options:
  --user <clerkUserId>    Sync credits for a specific user
  --session <sessionId>   Sync credits for a specific Stripe session
  --all-users            Sync credits for all users (use with caution)
  --help                 Show this help message

Examples:
  # Sync credits for a specific user
  node scripts/sync-sora-credits.js --user "user_34dlUgUHHJNWHYczgXxW2UE22YL"
  
  # Sync credits for a specific session
  node scripts/sync-sora-credits.js --session "cs_test_1234567890"
  
  # Sync credits for all users (be careful!)
  node scripts/sync-sora-credits.js --all-users
`);
}

// Sync credits for a specific user
async function syncUserCredits(clerkUserId) {
  console.log(`🔄 [Sync] Starting credit sync for user: ${clerkUserId}`);
  
  try {
    // Get all completed sessions
    const allSessions = await stripe.checkout.sessions.list({
      limit: 100,
      expand: ['data.payment_intent']
    });
    
    // Filter for Sora video credit purchases for this user
    const sessions = allSessions.data.filter(session => 
      session.metadata?.productType === 'sora-video-credits' &&
      (session.metadata?.clerkUserId === clerkUserId || session.client_reference_id === clerkUserId) &&
      session.payment_status === 'paid'
    );
    
    console.log(`🔄 [Sync] Found ${sessions.length} Sora video credit sessions for user`);
    
    if (sessions.length === 0) {
      console.log(`⚠️ [Sync] No Sora video credit sessions found for user ${clerkUserId}`);
      return;
    }
    
    // Find user in database
    const user = await User.findOne({ clerkUserId });
    if (!user) {
      console.log(`❌ [Sync] User not found in database: ${clerkUserId}`);
      return;
    }
    
    console.log(`📊 [Sync] Current credits: ${user.soraVideoCredits || 0}`);
    
    let totalCreditsAdded = 0;
    let processedSessions = [];
    
    for (const session of sessions) {
      try {
        const priceId = session.metadata?.priceId;
        let creditsToAdd = 0;
        
        if (priceId === 'price_1SIyQSLPiEjYBNcQyq9gryxu') {
          creditsToAdd = 8; // $20 = 8 credits
        }
        
        if (creditsToAdd === 0) {
          console.log(`⚠️ [Sync] Unknown price ID for session ${session.id}: ${priceId}`);
          continue;
        }
        
        // Add credits
        const currentCredits = user.soraVideoCredits || 0;
        user.soraVideoCredits = currentCredits + creditsToAdd;
        await user.save();
        
        totalCreditsAdded += creditsToAdd;
        processedSessions.push({
          sessionId: session.id,
          creditsAdded: creditsToAdd,
          newTotal: user.soraVideoCredits
        });
        
        console.log(`✅ [Sync] Added ${creditsToAdd} credits for session ${session.id}. New total: ${user.soraVideoCredits}`);
        
      } catch (error) {
        console.error(`❌ [Sync] Error processing session ${session.id}:`, error);
      }
    }
    
    console.log(`\n📊 [Sync] Summary for user ${clerkUserId}:`);
    console.log(`   Total credits added: ${totalCreditsAdded}`);
    console.log(`   Sessions processed: ${processedSessions.length}`);
    console.log(`   Final credit balance: ${user.soraVideoCredits}`);
    
    return {
      success: true,
      clerkUserId,
      totalCreditsAdded,
      processedSessions,
      finalBalance: user.soraVideoCredits
    };
    
  } catch (error) {
    console.error(`❌ [Sync] Error syncing credits for user ${clerkUserId}:`, error);
    throw error;
  }
}

// Main function
async function main() {
  const options = parseArgs();
  
  if (options.help) {
    showHelp();
    return;
  }
  
  if (!options.userId && !options.sessionId && !options.allUsers) {
    console.log('❌ [Sync] Please specify --user, --session, or --all-users');
    console.log('Use --help for usage information');
    process.exit(1);
  }
  
  try {
    // Connect to MongoDB
    console.log('🔌 [Sync] Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ [Sync] Connected to MongoDB');
    
    // Run the appropriate sync function
    if (options.userId) {
      await syncUserCredits(options.userId);
    }
    
    console.log('✅ [Sync] Sync completed successfully');
    
  } catch (error) {
    console.error('❌ [Sync] Fatal error:', error);
    process.exit(1);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('🔌 [Sync] Disconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}
