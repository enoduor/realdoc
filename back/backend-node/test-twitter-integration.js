const mongoose = require('mongoose');
const platformPublisher = require('./services/platformPublisher');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/creatorsync')
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => {
    console.error('❌ MongoDB Error:', err);
    process.exit(1);
  });

async function testTwitterIntegration() {
  console.log('🧪 Testing Twitter Integration with Platform Publisher...\n');
  
  try {
    // Test data
    const postData = {
      userId: 'test-user',
      caption: '🧪 Integration test: Updated Twitter service with new interface!',
      hashtags: ['CreatorSync', 'Integration', 'Testing'],
      mediaUrl: null
    };

    console.log('📝 Post data:');
    console.log('- User ID:', postData.userId);
    console.log('- Caption:', postData.caption);
    console.log('- Hashtags:', postData.hashtags);
    console.log('- Media URL:', postData.mediaUrl || 'None');

    console.log('\n🚀 Publishing to Twitter...');
    
    // Test the platform publisher
    const result = await platformPublisher.publishToPlatform('twitter', postData);
    
    console.log('\n✅ Result:');
    console.log('- Success:', result.success);
    console.log('- Platform:', result.platform);
    console.log('- Post ID:', result.postId);
    console.log('- URL:', result.url);
    console.log('- Message:', result.message);
    
    if (result.success) {
      console.log('\n🎉 Twitter integration test completed successfully!');
      console.log(`📱 View your tweet: ${result.url}`);
    } else {
      console.log('\n❌ Twitter integration test failed:');
      console.log('- Error:', result.error);
    }
    
    return result.success;
    
  } catch (error) {
    console.error('\n❌ Integration test failed:', error.message);
    console.error('- Stack:', error.stack);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting Twitter Integration Test...\n');
  
  const success = await testTwitterIntegration();
  
  if (success) {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  } else {
    console.log('\n❌ Tests failed');
    process.exit(1);
  }
}

// Run the test
main().catch((error) => {
  console.error('💥 Test failed:', error);
  process.exit(1);
});
