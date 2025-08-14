const mongoose = require('mongoose');
const { postTweet, getValidAccessToken, getTwitterHandle } = require('./services/twitterService');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/creatorsync')
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => {
    console.error('❌ MongoDB Error:', err);
    process.exit(1);
  });

async function testTwitterService() {
  console.log('🧪 Testing Twitter Service Directly...\n');
  
  try {
    const userId = 'test-user';
    
    // Test 1: Get Twitter handle
    console.log('📝 Test 1: Getting Twitter handle...');
    const handle = await getTwitterHandle({ userId });
    console.log('✅ Twitter handle:', handle);
    
    // Test 2: Get valid access token
    console.log('\n📝 Test 2: Getting valid access token...');
    const token = await getValidAccessToken({ userId });
    console.log('✅ Access token length:', token.length);
    
    // Test 3: Post a tweet
    console.log('\n📝 Test 3: Posting a tweet...');
    const testMessage = `🧪 Direct Twitter service test • ${new Date().toISOString().slice(0, 16)} • ${Math.random().toString(36).substr(2, 6)}`;
    console.log('📝 Message:', testMessage);
    
    const result = await postTweet({ userId }, testMessage);
    console.log('✅ Tweet posted successfully!');
    console.log('- Tweet ID:', result.data?.id);
    console.log('- Tweet text:', result.data?.text);
    console.log('- URL: https://twitter.com/user/status/' + result.data?.id);
    
    return true;
    
  } catch (error) {
    console.error('\n❌ Twitter service test failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting Direct Twitter Service Test...\n');
  
  const success = await testTwitterService();
  
  if (success) {
    console.log('\n🎉 Twitter service test completed successfully!');
    process.exit(0);
  } else {
    console.log('\n❌ Twitter service test failed');
    process.exit(1);
  }
}

// Run the test
main().catch((error) => {
  console.error('💥 Test failed:', error);
  process.exit(1);
});
