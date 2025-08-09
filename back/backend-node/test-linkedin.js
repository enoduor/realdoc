require('dotenv').config();
const LinkedInService = require('./services/linkedinService');

async function testLinkedIn() {
    console.log('🔍 Testing LinkedIn API Connection...');
    
    const linkedinService = new LinkedInService();
    
    console.log('📋 Configuration:');
    console.log('- API V2 URL:', linkedinService.apiV2);
    console.log('- API REST URL:', linkedinService.apiRest);
    console.log('- Has Token:', !!linkedinService.accessToken);
    console.log('- Token Length:', linkedinService.accessToken ? linkedinService.accessToken.length : 0);
    
    try {
        console.log('\n🧪 Testing connection...');
        const result = await linkedinService.testConnection();
        
        if (result.connected) {
            console.log('✅ LinkedIn API connection successful!');
            console.log('👤 User:', result.user);
            console.log('📝 Permissions:', result.permissions);
            console.log('🚀 Can Post:', result.canPost);
            
            // Test actual posting
            if (result.canPost) {
                console.log('\n📤 Testing LinkedIn posting...');
                const testPost = await linkedinService.postText('🧪 Test post from CreatorSync API - ' + new Date().toISOString());
                console.log('✅ Post successful:', testPost);
            }
        } else {
            console.log('❌ LinkedIn API connection failed:');
            console.log('Error:', result.error);
            if (result.details) {
                console.log('Details:', JSON.stringify(result.details, null, 2));
            }
        }
    } catch (error) {
        console.error('💥 Test failed with error:', error.message);
    }
}

testLinkedIn();
