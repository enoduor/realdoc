// Quick test for the new billing endpoint
const testBilling = async () => {
  try {
    const response = await fetch('http://localhost:4001/api/billing/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        priceId: 'price_1RvVcmLPiEjYBNcQZA0kFux4', // starter monthly
        clerkUserId: 'user_test_123',
        plan: 'starter',
        billingCycle: 'monthly'
      })
    });
    
    const result = await response.json();
    console.log('✅ Billing endpoint response:', result);
    
    if (result.url) {
      console.log('✅ Checkout URL created successfully');
      console.log('🔗 URL:', result.url);
    } else {
      console.log('❌ No checkout URL in response');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
};

testBilling();
