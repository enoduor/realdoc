const mongoose = require('mongoose');

// Production MongoDB URI
const MONGODB_URI = 'mongodb://appuser:mghFD0EJinvc8vHo@ac-xdnz5ey-shard-00-00.bzk8vmo.mongodb.net:27017,ac-xdnz5ey-shard-00-01.bzk8vmo.mongodb.net:27017,ac-xdnz5ey-shard-00-02.bzk8vmo.mongodb.net:27017/repostly?ssl=true&replicaSet=atlas-psyvgp-shard-0&authSource=admin&retryWrites=true&w=majority&appName=creatorsync';

async function connectToMongoDB() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB successfully!');
    
    // Get database info
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    
    console.log('\n📊 Database Collections:');
    collections.forEach(collection => {
      console.log(`  - ${collection.name}`);
    });
    
    // Check users collection
    const usersCount = await db.collection('users').countDocuments();
    console.log(`\n👥 Users: ${usersCount}`);
    
    // Check token collections
    const tokenCollections = ['youtubetokens', 'facebooktokens', 'linkedintokens', 'instagramtokens', 'twittertokens', 'tiktoktokens'];
    
    console.log('\n🔑 Platform Tokens:');
    for (const collectionName of tokenCollections) {
      const count = await db.collection(collectionName).countDocuments();
      console.log(`  - ${collectionName}: ${count} tokens`);
    }
    
    // Keep connection open for interactive use
    console.log('\n💡 Connection is open. You can now run queries.');
    console.log('💡 Press Ctrl+C to disconnect.');
    
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n👋 Disconnecting from MongoDB...');
  await mongoose.disconnect();
  console.log('✅ Disconnected successfully!');
  process.exit(0);
});

connectToMongoDB();
