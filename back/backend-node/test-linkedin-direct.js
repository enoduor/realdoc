require('dotenv').config();
const LinkedInService = require('./services/linkedinService');

async function testLinkedInDirect() {
  try {
    console.log('🚀 Testing LinkedIn posting with shared token...\n');
    
    // Create LinkedIn service instance with shared token
    const linkedinService = new LinkedInService();
    
    console.log('📋 LinkedIn Service Configuration:');
    console.log(`   API URL: ${linkedinService.apiRest}`);
    console.log(`   Access Token: ${linkedinService.accessToken ? '✅ Present' : '❌ Missing'}`);
    console.log('');
    
    if (!linkedinService.accessToken) {
      console.log('❌ No LinkedIn access token found in environment');
      return;
    }
    
    // Test connection
    console.log('🔍 Testing LinkedIn connection...');
    const connection = await linkedinService.testConnection();
    console.log('Connection result:', connection);
    console.log('');
    
    if (!connection.connected) {
      console.log('❌ LinkedIn connection failed:', connection.error);
      return;
    }
    
    // Test posting
    console.log('📝 Testing LinkedIn posting...');
    const testMessage = "🚀 Testing CreatorSync LinkedIn integration! This is a test post from our multi-platform content management system. #CreatorSync #LinkedIn #Testing";
    
    const result = await linkedinService.createPost(testMessage);
    
    if (result.success) {
      console.log('✅ LinkedIn post successful!');
      console.log(`   Post ID: ${result.postId}`);
      console.log(`   Version: ${result.version}`);
      console.log(`   Message: ${result.message}`);
      console.log(`   URL: https://www.linkedin.com/feed/update/${result.postId}`);
    } else {
      console.log('❌ LinkedIn post failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testLinkedInDirect();
