const Stripe = require('stripe');
const mongoose = require('mongoose');
require('dotenv').config(); // Load from current directory

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const User = require('./models/User');

async function syncStripeCustomers() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Fetch all customers from Stripe
    console.log('📥 Fetching customers from Stripe...');
    const customers = await stripe.customers.list({
      limit: 100,
      expand: ['data.subscriptions']
    });

    console.log(`Found ${customers.data.length} customers in Stripe`);

    // Process each customer
    for (const customer of customers.data) {
      console.log(`\n👤 Processing customer: ${customer.email}`);
      
      // Check if user already exists in MongoDB
      let user = await User.findOne({ email: customer.email });
      
      if (!user) {
        console.log(`📝 Creating new user for ${customer.email}`);
        user = new User({
          email: customer.email,
          stripeCustomerId: customer.id,
          subscriptionStatus: 'none',
          selectedPlan: 'starter',
          billingCycle: 'monthly'
        });
      } else {
        console.log(`🔄 Updating existing user for ${customer.email}`);
        user.stripeCustomerId = customer.id;
      }

      // Check if customer has subscriptions
      if (customer.subscriptions && customer.subscriptions.data.length > 0) {
        const subscription = customer.subscriptions.data[0]; // Get first subscription
        console.log(`💳 Found subscription: ${subscription.id} (${subscription.status})`);
        
        user.stripeSubscriptionId = subscription.id;
        user.subscriptionStatus = subscription.status;
        user.selectedPlan = subscription.metadata?.plan || 'starter';
        user.billingCycle = subscription.metadata?.billingCycle || 'monthly';
        
        if (subscription.trial_start) {
          user.trialStartDate = new Date(subscription.trial_start * 1000);
        }
        if (subscription.trial_end) {
          user.trialEndDate = new Date(subscription.trial_end * 1000);
        }
      }

      await user.save();
      console.log(`✅ Saved user: ${user.email} (${user.subscriptionStatus})`);
    }

    console.log('\n🎉 Stripe customers synced successfully!');
    
    // Show summary
    const totalUsers = await User.countDocuments();
    const subscribedUsers = await User.countDocuments({ subscriptionStatus: { $in: ['trialing', 'active'] } });
    
    console.log(`\n📊 Summary:`);
    console.log(`Total users in database: ${totalUsers}`);
    console.log(`Users with active subscriptions: ${subscribedUsers}`);

  } catch (error) {
    console.error('❌ Error syncing customers:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed');
  }
}

syncStripeCustomers();
