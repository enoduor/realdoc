require('dotenv').config();
const axios = require('axios');

async function testLinkedInSimple() {
    console.log('🔍 Testing LinkedIn API with simple approaches...');
    
    const accessToken = process.env.LINKEDIN_ACCESS_TOKEN;
    const apiUrl = 'https://api.linkedin.com/v2';
    
    console.log('📋 Configuration:');
    console.log('- Has Token:', !!accessToken);
    console.log('- Token Length:', accessToken ? accessToken.length : 0);
    
    // Test 1: Simple GET to /me to see what permissions we have
    try {
        console.log('\n🧪 Test 1: GET /me');
        const meResponse = await axios.get(`${apiUrl}/me`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('✅ /me successful:', meResponse.data);
    } catch (error) {
        console.log('❌ /me failed:', error.response?.status, error.response?.data?.message);
    }
    
    // Test 2: Try the simplest possible post structure
    try {
        console.log('\n🧪 Test 2: Simple post structure');
        const simplePost = {
            text: 'Simple test post'
        };
        
        const postResponse = await axios.post(`${apiUrl}/ugcPosts`, simplePost, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'X-Restli-Protocol-Version': '2.0.0'
            }
        });
        console.log('✅ Simple post successful:', postResponse.data);
    } catch (error) {
        console.log('❌ Simple post failed:', error.response?.status, error.response?.data?.message);
        if (error.response?.data) {
            console.log('Details:', JSON.stringify(error.response.data, null, 2));
        }
    }
    
    // Test 3: Try with minimal UGC structure
    try {
        console.log('\n🧪 Test 3: Minimal UGC structure');
        const minimalPost = {
            specificContent: {
                'com.linkedin.ugc.ShareContent': {
                    shareCommentary: {
                        text: 'Minimal UGC test post'
                    }
                }
            }
        };
        
        const postResponse = await axios.post(`${apiUrl}/ugcPosts`, minimalPost, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'X-Restli-Protocol-Version': '2.0.0'
            }
        });
        console.log('✅ Minimal UGC post successful:', postResponse.data);
    } catch (error) {
        console.log('❌ Minimal UGC post failed:', error.response?.status, error.response?.data?.message);
        if (error.response?.data) {
            console.log('Details:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testLinkedInSimple();
