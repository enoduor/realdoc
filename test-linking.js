const axios = require('axios');

// Test the complete linking flow
async function testLinkingFlow() {
  console.log('🧪 Testing Complete Linking Flow...\n');

  // Step 1: Create a temporary user via webhook
  console.log('📝 Step 1: Creating temporary user via webhook...');
  const uniqueEmail = `test-${Date.now()}@example.com`;
  const uniqueCustomerId = `cus_test_${Date.now()}`;
  const uniqueSessionId = `cs_test_session_${Date.now()}`;
  
  const checkoutEvent = {
    id: 'evt_test_webhook',
    object: 'event',
    api_version: '2020-08-27',
    created: Math.floor(Date.now() / 1000),
    type: 'checkout.session.completed',
    data: {
      object: {
        id: uniqueSessionId,
        object: 'checkout.session',
        mode: 'subscription',
        customer: uniqueCustomerId,
        customer_details: {
          email: uniqueEmail
        },
        subscription_data: {
          metadata: {
            plan: 'starter',
            billingCycle: 'monthly'
          }
        }
      }
    }
  };

  try {
    const webhookResponse = await axios.post('http://localhost:4001/webhook', JSON.stringify(checkoutEvent), {
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': 'test_signature'
      }
    });
    console.log('✅ Webhook response:', webhookResponse.status);
  } catch (error) {
    console.log('❌ Webhook error:', error.response?.status, error.response?.data);
    return;
  }

  // Step 2: Create subscription for the user
  console.log('\n📝 Step 2: Creating subscription for temporary user...');
  const uniqueSubscriptionId = `sub_test_subscription_${Date.now()}`;
  const subscriptionEvent = {
    id: 'evt_test_subscription',
    object: 'event',
    api_version: '2020-08-27',
    created: Math.floor(Date.now() / 1000),
    type: 'customer.subscription.created',
    data: {
      object: {
        id: uniqueSubscriptionId,
        object: 'subscription',
        customer: uniqueCustomerId,
        status: 'trialing',
        trial_start: Math.floor(Date.now() / 1000),
        trial_end: Math.floor(Date.now() / 1000) + (3 * 24 * 60 * 60),
        metadata: {
          plan: 'starter',
          billingCycle: 'monthly'
        }
      }
    }
  };

  try {
    const subResponse = await axios.post('http://localhost:4001/webhook', JSON.stringify(subscriptionEvent), {
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': 'test_signature'
      }
    });
    console.log('✅ Subscription webhook response:', subResponse.status);
  } catch (error) {
    console.log('❌ Subscription webhook error:', error.response?.status, error.response?.data);
    return;
  }

  // Step 3: Test subscription status check
  console.log('\n📝 Step 3: Testing subscription status check...');
  try {
    const statusResponse = await axios.get(`http://localhost:4001/api/stripe/subscription-by-session/${uniqueSessionId}`);
    console.log('✅ Subscription status:', statusResponse.data);
  } catch (error) {
    console.log('❌ Status check error:', error.response?.status, error.response?.data);
  }

  // Step 4: Test linking with Clerk (simulate)
  console.log('\n📝 Step 4: Testing linking with Clerk...');
  try {
    // Simulate linking with a test Clerk user ID
    const linkResponse = await axios.post('http://localhost:4001/api/auth/link-temp-user', {
      email: uniqueEmail
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test_token'
      }
    });
    console.log('✅ Linking response:', linkResponse.data);
  } catch (error) {
    console.log('❌ Linking error:', error.response?.status, error.response?.data);
  }

  console.log('\n🎉 Linking flow test completed!');
  console.log(`📧 Test email: ${uniqueEmail}`);
  console.log(`💳 Customer ID: ${uniqueCustomerId}`);
  console.log(`🎫 Session ID: ${uniqueSessionId}`);
  console.log(`📋 Subscription ID: ${uniqueSubscriptionId}`);
}

testLinkingFlow();
