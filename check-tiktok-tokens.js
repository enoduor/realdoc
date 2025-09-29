const mongoose = require('mongoose');
const TikTokToken = require('./back/backend-node/models/TikTokToken');

async function checkTikTokTokens() {
  try {
    // Connect to MongoDB using the same connection string as the app
    const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://repostly:repostly123@repostly.7jqjq.mongodb.net/repostly?retryWrites=true&w=majority';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
    
    const tokens = await TikTokToken.find({}).limit(10);
    console.log('TikTok tokens found:', tokens.length);
    
    if (tokens.length > 0) {
      console.log('Sample tokens:');
      tokens.forEach((token, index) => {
        console.log(`${index + 1}. ClerkUserId: ${token.clerkUserId}, Email: ${token.email}, Created: ${token.createdAt}`);
      });
    } else {
      console.log('No TikTok tokens found in database');
    }
    
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkTikTokTokens();
