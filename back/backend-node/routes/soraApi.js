const express = require('express');
const router = express.Router();
const { requireAuth } = require('@clerk/express');
const AWS = require('aws-sdk');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Initialize AWS clients
const apigateway = new AWS.APIGateway({ region: 'us-west-2' });
const dynamodb = new AWS.DynamoDB.DocumentClient({ region: 'us-west-2' });
const cloudwatch = new AWS.CloudWatch({ region: 'us-west-2' });

const TABLE_NAME = 'reelpostly-tenants';
const CREDITS_PER_USD = parseInt(process.env.CREDITS_PER_USD || '5', 10); // Default: $1 = 5 credits ($0.20 per video)

// Model-specific pricing (credits per video)
const MODEL_PRICING = {
  'sora-2': 1,      // $0.20 per video (1 credit)
  'sora-2-pro': 3   // $0.60 per video (3 credits) - 3x more expensive
};
const USAGE_PLAN_ID = '4865fg'; // Connected to api.reelpostly.com (API 88v4yak4v6)
const API_GATEWAY_ID = '88v4yak4v6'; // From deployment

// Helper: basic email validation to avoid Stripe 'email_invalid'
function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  const e = email.trim();
  if (!e) return false;
  return /.+@.+\..+/.test(e);
}

// Helper: Get API Gateway usage for an API key
async function getApiKeyUsage(apiKeyId) {
  try {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const usage = await apigateway.getUsage({
      usagePlanId: USAGE_PLAN_ID,
      keyId: apiKeyId,
      startDate,
      endDate
    }).promise();
    
    // Sum up all requests
    let totalRequests = 0;
    if (usage.items) {
      Object.values(usage.items).forEach(dayData => {
        if (Array.isArray(dayData)) {
          dayData.forEach(item => {
            totalRequests += item[1] || 0;
          });
        }
      });
    }
    
    return totalRequests;
  } catch (error) {
    console.error('Error fetching API key usage:', error);
    return 0;
  }
}

// Helper: Get Stripe customer balance
async function getStripeBalance(email) {
  try {
    if (!email || !process.env.STRIPE_SECRET_KEY) {
      return { balance: 0, currency: 'usd' };
    }
    
    // Find customer by email
    const customers = await stripe.customers.list({ email, limit: 1 });
    
    if (customers.data.length === 0) {
      return { balance: 0, currency: 'usd' };
    }
    
    const customer = customers.data[0];
    
    // Get customer balance (negative = credit, positive = they owe money)
    // Stripe stores balance in cents, negative means credits
    return {
      balance: Math.abs(customer.balance || 0),
      currency: customer.currency || 'usd'
    };
  } catch (error) {
    console.error('Error fetching Stripe balance:', error);
    return { balance: 0, currency: 'usd' };
  }
}

// Helper: read user-level Sora credits (hoisted)
async function getUserLevelCredits(userId) {
  const out = await dynamodb.get({
    TableName: TABLE_NAME,
    Key: { apiKeyId: `USER#${userId}` }
  }).promise();
  return Number(out?.Item?.soraCredits || 0);
}

// Helper: get credits cost for model
function getModelCreditsCost(model) {
  return MODEL_PRICING[model] || MODEL_PRICING['sora-2']; // Default to sora-2 if unknown model
}

// Get user's API keys
router.get('/keys', requireAuth(), async (req, res) => {
  try {
    const clerkUserId = req.auth.userId;
    
    // Find all API keys for this user in DynamoDB
    const result = await dynamodb.scan({
      TableName: TABLE_NAME,
      FilterExpression: 'tenantId = :userId',
      ExpressionAttributeValues: {
        ':userId': clerkUserId
      }
    }).promise();
    
    const keys = await Promise.all(result.Items.map(async (item) => {
      try {
        // Get API key details from API Gateway (without value for security)
        const keyDetails = await apigateway.getApiKey({
          apiKey: item.apiKeyId,
          includeValue: false
        }).promise();
        
        return {
          id: item.apiKeyId,
          key: `sk_...${item.apiKeyId.slice(-8)}`, // Masked key
          name: keyDetails.name,
          created: keyDetails.createdDate,
          lastUsed: keyDetails.lastUpdatedDate || keyDetails.createdDate,
          credits: item.credits,
          status: item.status
        };
      } catch (error) {
        console.error('Error fetching key details:', error);
        return null;
      }
    }));
    
    res.json({
      success: true,
      keys: keys.filter(k => k !== null)
    });
  } catch (error) {
    console.error('Error fetching API keys:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new API key
router.post('/keys/create', requireAuth(), async (req, res) => {
  try {
    const clerkUserId = req.auth.userId;
    const { name } = req.body;
    
    // Create API key in API Gateway
    const apiKey = await apigateway.createApiKey({
      name: name || `${clerkUserId}-key-${Date.now()}`,
      description: `API key for user ${clerkUserId}`,
      enabled: true
    }).promise();
    
    // Associate with usage plan
    await apigateway.createUsagePlanKey({
      usagePlanId: USAGE_PLAN_ID,
      keyType: 'API_KEY',
      keyId: apiKey.id
    }).promise();
    
    // Get the actual key value
    const keyWithValue = await apigateway.getApiKey({
      apiKey: apiKey.id,
      includeValue: true
    }).promise();
    
    // Check if user already has API keys (to determine if this is first key)
    const existingKeysResult = await dynamodb.scan({
      TableName: TABLE_NAME,
      FilterExpression: 'tenantId = :tenantId',
      ExpressionAttributeValues: {
        ':tenantId': clerkUserId
      }
    }).promise();
    
    const isFirstKey = existingKeysResult.Items.length === 0;
    const initialCredits = isFirstKey ? 10 : 0; // Only give free credits on first key
    
    // Add to DynamoDB with appropriate credits
    const timestamp = Math.floor(Date.now() / 1000);
    await dynamodb.put({
      TableName: TABLE_NAME,
      Item: {
        apiKeyId: apiKey.id,
        tenantId: clerkUserId,
        email: req.auth.sessionClaims?.email || '',
        planId: 'starter',
        credits: initialCredits,
        initialCredits: initialCredits, // Store initial credits for usage calculation
        status: 'active',
        createdAt: timestamp
      }
    }).promise();
    
    res.json({
      success: true,
      apiKey: keyWithValue.value, // Only shown once
      apiKeyId: apiKey.id,
      credits: initialCredits,
      message: isFirstKey 
        ? 'API key created successfully with 10 free credits! Save this key - you won\'t be able to see it again!'
        : 'API key created successfully! Save this key - you won\'t be able to see it again!'
    });
  } catch (error) {
    console.error('Error creating API key:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get dashboard stats
router.get('/stats', requireAuth(), async (req, res) => {
  try {
    const clerkUserId = req.auth.userId;
    const userEmail = req.auth.sessionClaims?.email || '';

    // Get all keys for this user
    const result = await dynamodb.scan({
      TableName: TABLE_NAME,
      FilterExpression: 'tenantId = :userId',
      ExpressionAttributeValues: {
        ':userId': clerkUserId
      }
    }).promise();

    // Calculate totals and fetch real usage
    let totalKeyCredits = 0;
    let totalKeys = 0;
    let totalRequests = 0;

    // Process each API key and calculate usage from credit deductions
    const usagePromises = result.Items.map(async (item) => {
      totalKeyCredits += parseInt(item.credits || 0, 10);
      totalKeys++;
      
      // Calculate usage based on credit deductions instead of API Gateway metrics
      // Each API key starts with initial credits and current credits show remaining
      const initialCredits = item.initialCredits || (item.credits >= 10 ? 10 : 0); // Fallback for existing keys
      const currentCredits = parseInt(item.credits || 0, 10);
      const creditsUsed = Math.max(0, initialCredits - currentCredits);
      
      // Fetch API Gateway usage as backup (may be 0 if not properly tracked)
      const gatewayRequests = await getApiKeyUsage(item.apiKeyId);
      
      // Use the higher of credit-based usage or gateway usage
      return Math.max(creditsUsed, gatewayRequests);
    });

    const usageResults = await Promise.all(usagePromises);
    totalRequests = usageResults.reduce((sum, count) => sum + count, 0);
    
    console.log('Usage calculation debug:', {
      totalKeys,
      totalKeyCredits,
      totalRequests,
      usageResults
    });

    // Fetch user-level wallet + payment totals
    const userItemResp = await dynamodb.get({
      TableName: TABLE_NAME,
      Key: { apiKeyId: `USER#${clerkUserId}` }
    }).promise();
    const userItem = userItemResp?.Item || {};
    const userLevelCredits = Number(userItem.soraCredits || 0);
    const totalPaidNet = Number(userItem.totalPaidNet || 0);
    const totalPaidGross = Number(userItem.totalPaidGross || 0);
    const totalPurchases = Number(userItem.totalPurchases || 0);
    const totalCreditsPurchased = Number(userItem.totalCreditsPurchased || 0);
    
    console.log('User item debug:', {
      clerkUserId,
      userItem: userItemResp?.Item,
      totalCreditsPurchased,
      totalPaidGross,
      totalPurchases
    });

    const totalCredits = totalKeyCredits + userLevelCredits;

    // Stripe balance (for visibility; not what's used for Sora credits)
    const stripeData = await getStripeBalance(userEmail);

    // Cost model (same as before)
    const costPerRequest = 10; // cents per request
    const thisMonthUsage = totalRequests * costPerRequest;

    res.json({
      success: true,
      stats: {
        credits: totalCredits,           // <-- includes user-level balance
        balance: stripeData.balance,     // stripe customer acct balance in cents (for display)
        thisMonthUsage,
        totalRequests,
        totalKeys,
        estimatedDays: thisMonthUsage > 0
          ? Math.floor((totalCredits / thisMonthUsage) * 30)
          : 999,
        totalPaidNet,
        totalPaidGross,
        totalPurchases,
        totalCreditsPurchased,
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add credits (Stripe checkout)
router.post('/credits/checkout', requireAuth(), async (req, res) => {
  try {
    const clerkUserId = req.auth.userId;

    // Prefer email explicitly passed from client; fall back to session claims
    const sessionEmail = req.auth.sessionClaims?.email || '';
    const { amount, successUrl, cancelUrl, email } = req.body || {};

    // Validate amount (USD dollars)
    const dollars = Number(amount);
    if (!Number.isFinite(dollars) || dollars < 10) {
      return res.status(400).json({ success: false, error: 'Minimum amount is $10' });
    }

    // Require Stripe configuration
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ success: false, error: 'Stripe not configured' });
    }

    // Determine redirect URLs: use provided ones or fall back to app URL
    const appBase = process.env.APP_URL?.replace(/\/$/, '') || 'https://reelpostly.com';
    const okSuccess = typeof successUrl === 'string' && successUrl.startsWith('http');
    const okCancel = typeof cancelUrl === 'string' && cancelUrl.startsWith('http');

    const finalSuccessUrl = okSuccess
      ? successUrl
      : `${appBase}/app/sora-api-dashboard?checkout=success&amount=${dollars}`;

    const finalCancelUrl = okCancel
      ? cancelUrl
      : `${appBase}/app/sora-api-dashboard?checkout=canceled`;

    // Credits conversion (e.g., $1 => CREDITS_PER_USD credits)
    const creditsToAdd = Math.round(dollars * CREDITS_PER_USD);

    // Build Checkout Session params
    const params = {
      mode: 'payment',
      payment_method_types: ['card'],
      allow_promotion_codes: true,
      client_reference_id: clerkUserId,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'ReelPostly API Credits',
              description: `${creditsToAdd} API credits`,
              images: ['https://reelpostly.com/logo.png'],
            },
            unit_amount: Math.round(dollars * 100), // cents
          },
          quantity: 1,
        },
      ],
      success_url: finalSuccessUrl,
      cancel_url: finalCancelUrl,
      metadata: {
        credits: String(creditsToAdd),
        userId: clerkUserId,
        productType: 'sora-api-credits',
      },
    };

    // Only include customer_email if valid to avoid StripeInvalidRequestError
    const chosenEmail = isValidEmail(email) ? email : (isValidEmail(sessionEmail) ? sessionEmail : undefined);
    if (chosenEmail) {
      params.customer_email = chosenEmail;
    }

    const session = await stripe.checkout.sessions.create(params);

    return res.json({
      success: true,
      url: session.url,
      sessionId: session.id,
      credits: creditsToAdd,
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    const message = error?.message || error?.raw?.message || 'Failed to create checkout session';
    return res.status(500).json({ success: false, error: message });
  }
});


// Simple credits balance endpoint (sum of keys + user-level)
router.get('/credits/balance', requireAuth(), async (req, res) => {
  try {
    const userId = req.auth.userId;

    // Sum key-level credits
    const result = await dynamodb.scan({
      TableName: TABLE_NAME,
      FilterExpression: 'tenantId = :userId',
      ExpressionAttributeValues: { ':userId': userId }
    }).promise();

    const keyCredits = (result.Items || []).reduce((sum, it) => sum + Number(it.credits || 0), 0);

    // Add user-level credits
    const userLevelCredits = await getUserLevelCredits(userId);

    res.json({ success: true, credits: keyCredits + userLevelCredits });
  } catch (err) {
    console.error('Error fetching balance:', err);
    res.status(500).json({ success: false, error: 'Unable to fetch credits balance' });
  }
});


// Consume credits for video generation
// Body: { amount?: number, apiKeyId?: string }
router.post('/credits/consume', requireAuth(), async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { amount, apiKeyId } = req.body || {};
    const amt = Math.max(1, parseInt(amount || 1, 10)); // minimum 1

    // If API key is provided, verify ownership and try to deduct from that key first
    if (apiKeyId) {
      const item = await dynamodb.get({
        TableName: TABLE_NAME,
        Key: { apiKeyId }
      }).promise();

      if (!item.Item || item.Item.tenantId !== userId) {
        return res.status(403).json({ success: false, message: 'Unauthorized API key' });
      }

      const current = Number(item.Item.credits || 0);
      if (current >= amt) {
        await dynamodb.update({
          TableName: TABLE_NAME,
          Key: { apiKeyId },
          UpdateExpression: 'ADD credits :neg',
          ExpressionAttributeValues: { ':neg': -amt },
          ReturnValues: 'UPDATED_NEW'
        }).promise();

        return res.json({ success: true, source: 'apiKey', remaining: current - amt });
      }
      // If key does not have enough, fall through to user-level balance
    }

    // Deduct from user-level balance
    const userItem = await dynamodb.get({
      TableName: TABLE_NAME,
      Key: { apiKeyId: `USER#${userId}` }
    }).promise();

    const wallet = Number(userItem?.Item?.soraCredits || 0);
    if (wallet < amt) {
      return res.status(402).json({ success: false, message: 'Insufficient credits' });
    }

    await dynamodb.update({
      TableName: TABLE_NAME,
      Key: { apiKeyId: `USER#${userId}` },
      UpdateExpression: 'ADD soraCredits :neg',
      ExpressionAttributeValues: { ':neg': -amt },
      ReturnValues: 'UPDATED_NEW'
    }).promise();

    return res.json({ success: true, source: 'user', remaining: wallet - amt });
  } catch (err) {
    console.error('Error consuming credits:', err);
    res.status(500).json({ success: false, message: 'Failed to consume credits' });
  }
});
// Note: Sora API credit webhook is handled in /webhook (stripeWebhook.js)
// to ensure raw body parsing for Stripe signature verification

// Get API key usage from API Gateway
router.get('/usage/:apiKeyId', requireAuth(), async (req, res) => {
  try {
    const { apiKeyId } = req.params;
    const clerkUserId = req.auth.userId;
    
    // Verify this key belongs to this user
    const item = await dynamodb.get({
      TableName: TABLE_NAME,
      Key: { apiKeyId }
    }).promise();
    
    if (!item.Item || item.Item.tenantId !== clerkUserId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    // Get usage from API Gateway
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const usage = await apigateway.getUsage({
      usagePlanId: USAGE_PLAN_ID,
      keyId: apiKeyId,
      startDate,
      endDate
    }).promise();
    
    res.json({
      success: true,
      usage: usage.items || []
    });
  } catch (error) {
    console.error('Error fetching usage:', error);
    res.status(500).json({ error: error.message });
  }
});



// =========================
//  STRIPE WEBHOOK (Per-route raw body for signature verification)
//  - Handles checkout.session.completed for API credits
//  - Idempotent: records processed session to avoid double-crediting
// =========================

const expressRaw = require('express').raw;

// Helper: mark session as processed to ensure idempotency
async function markSessionProcessed(sessionId) {
  const markerKey = `SESSION#${sessionId}`;
  try {
    await dynamodb.put({
      TableName: TABLE_NAME,
      Item: {
        apiKeyId: markerKey,
        tenantId: 'SYSTEM',
        status: 'processed',
        createdAt: Math.floor(Date.now() / 1000)
      },
      ConditionExpression: 'attribute_not_exists(apiKeyId)'
    }).promise();
    return true; // newly written
  } catch (err) {
    if (err && err.code === 'ConditionalCheckFailedException') {
      // already processed
      return false;
    }
    throw err;
  }
}

// Helper: credit the newest active API key for a user
async function creditUserLatestKey(clerkUserId, creditsToAdd) {
  // Fetch all keys for this user
  const scan = await dynamodb.scan({
    TableName: TABLE_NAME,
    FilterExpression: 'tenantId = :uid and begins_with(apiKeyId, :notSession)',
    ExpressionAttributeValues: {
      ':uid': clerkUserId,
      ':notSession': ''
    }
  }).promise();

  if (!scan.Items || scan.Items.length === 0) {
    // No API key yet — nothing to credit; frontend can prompt user to create a key
    return { credited: false, reason: 'NO_KEY' };
  }

  // Pick newest by createdAt (fallback to first)
  const latest = scan.Items.reduce((a, b) => (Number(a.createdAt || 0) > Number(b.createdAt || 0) ? a : b));

  await dynamodb.update({
    TableName: TABLE_NAME,
    Key: { apiKeyId: latest.apiKeyId },
    UpdateExpression: 'ADD credits :c',
    ExpressionAttributeValues: { ':c': Number(creditsToAdd) },
    ReturnValues: 'UPDATED_NEW'
  }).promise();

  return { credited: true, apiKeyId: latest.apiKeyId };
}

// Helper: credit user-level balance (for users with no API keys)
async function addSoraCreditsToUser(userId, credits) {
  // User-level item key: USER#userId
  await dynamodb.update({
    TableName: TABLE_NAME,
    Key: { apiKeyId: `USER#${userId}` },
    UpdateExpression: 'ADD soraCredits :inc',
    ExpressionAttributeValues: { ':inc': Number(credits) },
    ReturnValues: 'UPDATED_NEW'
  }).promise();
}

// Helper: track payments on the user record
async function addUserPaymentRecord(userId, amountNetUsd, amountGrossUsd, credits) {
  await dynamodb.update({
    TableName: TABLE_NAME,
    Key: { apiKeyId: `USER#${userId}` },
    UpdateExpression: 'ADD totalPaidNet :net, totalPaidGross :gross, totalCreditsPurchased :creds, totalPurchases :one SET lastPurchaseAt = :now',
    ExpressionAttributeValues: {
      ':net': Number(amountNetUsd || 0),
      ':gross': Number(amountGrossUsd || 0),
      ':creds': Number(credits || 0),
      ':one': 1,
      ':now': Math.floor(Date.now() / 1000)
    },
    ReturnValues: 'UPDATED_NEW'
  }).promise();
}

// Webhook route — must be mounted with raw body BEFORE any JSON body-parser at app level
router.post('/webhook/stripe', expressRaw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!whSecret) {
    console.error('Stripe webhook secret not set');
    return res.status(500).send('Webhook not configured');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, whSecret);
  } catch (err) {
    console.error('⚠️  Webhook signature verification failed.', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      // Idempotency: ensure we only process once
      const newlyProcessed = await markSessionProcessed(session.id);
      if (!newlyProcessed) {
        return res.status(200).send('Already processed');
      }

      // Always process sessions with payment_status === 'paid', even if amount_total is zero (for coupon cases)
      if (session.payment_status === 'paid') {
        const meta = session.metadata || {};
        const productType = meta.productType;
        const clerkUserId = meta.userId || session.client_reference_id;
        // Prefer credits from metadata, fallback to computed gross line items
        let credits = Number(meta.credits) || 0;
        if (!credits) {
          // Compute credits from line_items if possible
          if (session.amount_total && session.amount_total > 0) {
            credits = Math.round((Number(session.amount_total) / 100) * CREDITS_PER_USD); // $1 = CREDITS_PER_USD credits
          }
        }
        // Clamp to avoid fractional/NaN credits
        if (!Number.isFinite(credits) || credits < 0) credits = 0;
        // Optional logging: show conversion
        console.log(`[Sora Webhook] amount_total=${session.amount_total} → credits=${credits} (rate ${CREDITS_PER_USD}/USD)`);

        // Compute net and gross USD for reporting
        const netUsd = Number(session.amount_total || 0) / 100; // after discounts
        // Prefer total_details.amount_discount when present; fallback to credits/CREDITS_PER_USD
        const discountCents = Number(session.total_details?.amount_discount || 0);
        let grossUsd = netUsd + (discountCents / 100);
        if (!Number.isFinite(grossUsd) || grossUsd === 0) {
          // Fallback: infer from credits mapping if discounts not available
          grossUsd = Number(credits) / Number(CREDITS_PER_USD);
        }

        // Record payment totals on the user record (even if credits went to key)
        try {
          await addUserPaymentRecord(clerkUserId, netUsd, grossUsd, credits);
          console.log(`💰 [Sora Webhook] Payment recorded for ${clerkUserId}: net=$${netUsd.toFixed(2)}, gross=$${grossUsd.toFixed(2)}, credits=${credits}`);
        } catch (e) {
          console.warn('[Sora Webhook] Failed to update payment totals:', e.message);
        }

        if (productType === 'sora-api-credits' && clerkUserId && credits > 0) {
          // Try to credit user's latest API key
          const result = await creditUserLatestKey(clerkUserId, credits);
          if (result.credited) {
            console.log(`Credited ${credits} credits to API key ${result.apiKeyId} for user ${clerkUserId}`);
          } else if (result.reason === 'NO_KEY') {
            // If no API key, credit user-level balance
            await addSoraCreditsToUser(clerkUserId, credits);
            console.log(`No API keys found for user ${clerkUserId}. Credited ${credits} credits to user-level balance (USER#${clerkUserId})`);
          }
        } else if (productType === 'sora-api-credits' && clerkUserId && credits === 0) {
          // Log if no credits found
          console.log(`No credits to add for user ${clerkUserId} (session ${session.id})`);
        }
      }
    }

    // You can handle other event types here if needed
    return res.status(200).send('ok');
  } catch (err) {
    console.error('Error handling webhook event:', err);
    return res.status(500).send('Webhook handler error');
  }
});

// Get model pricing information
router.get('/pricing', requireAuth(), async (req, res) => {
  try {
    const pricing = {
      models: MODEL_PRICING,
      creditsPerUsd: CREDITS_PER_USD,
      // Convert to dollar amounts for display
      modelPricing: {
        'sora-2': {
          creditsPerVideo: MODEL_PRICING['sora-2'],
          costPerVideo: MODEL_PRICING['sora-2'] / CREDITS_PER_USD,
          description: 'Standard quality video generation'
        },
        'sora-2-pro': {
          creditsPerVideo: MODEL_PRICING['sora-2-pro'],
          costPerVideo: MODEL_PRICING['sora-2-pro'] / CREDITS_PER_USD,
          description: 'Professional quality video generation'
        }
      }
    };

    res.json({
      success: true,
      pricing
    });
  } catch (error) {
    console.error('Error fetching pricing:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete API key
router.delete('/keys/:apiKeyId', requireAuth(), async (req, res) => {
  try {
    const clerkUserId = req.auth.userId;
    const { apiKeyId } = req.params;

    console.log('Delete API key request:', { apiKeyId, clerkUserId }); // DEBUG

    // Verify the API key belongs to this user
    const keyResult = await dynamodb.get({
      TableName: TABLE_NAME,
      Key: { apiKeyId: apiKeyId }
    }).promise();

    console.log('Key lookup result:', keyResult.Item ? 'Found' : 'Not found'); // DEBUG

    if (!keyResult.Item) {
      console.log('API key not found in DynamoDB'); // DEBUG
      return res.status(404).json({ error: 'API key not found' });
    }

    if (keyResult.Item.tenantId !== clerkUserId) {
      console.log('API key does not belong to user'); // DEBUG
      return res.status(403).json({ error: 'Unauthorized: API key does not belong to you' });
    }

    // Delete from API Gateway usage plan
    try {
      await apigateway.deleteUsagePlanKey({
        usagePlanId: USAGE_PLAN_ID,
        keyId: apiKeyId
      }).promise();
    } catch (error) {
      console.log('Usage plan key deletion failed (may not exist):', error.message);
    }

    // Delete the API key from API Gateway
    try {
      await apigateway.deleteApiKey({
        apiKey: apiKeyId
      }).promise();
    } catch (error) {
      console.log('API key deletion failed (may not exist):', error.message);
    }

    // Delete from DynamoDB
    console.log('Deleting from DynamoDB...'); // DEBUG
    await dynamodb.delete({
      TableName: TABLE_NAME,
      Key: { apiKeyId: apiKeyId }
    }).promise();

    console.log('API key deleted successfully'); // DEBUG
    res.json({
      success: true,
      message: 'API key deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting API key:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

// =========================
//  NOTE: Deduct credits in your Sora video generation route!
//  Example (in /api/sora/generate or similar):
//
//  // At the top of your route handler:
//  // 1. Find the user's API key or user-level balance (USER#userId)
//  // 2. Deduct credits (e.g., via DynamoDB update with 'ADD credits :neg1')
//  // 3. If not enough credits, return error
//  //
//  // Example placeholder:
//  //   // Deduct 1 credit per video generation
//  //   // TODO: Implement credit deduction logic here
//  //
//  //   // If using API keys:
//  //   await dynamodb.update({ TableName: ..., Key: ..., UpdateExpression: 'ADD credits :neg1', ExpressionAttributeValues: { ':neg1': -1 } })
//  //   // If using user-level balance:
//  //   await dynamodb.update({ TableName: ..., Key: { apiKeyId: `USER#${userId}` }, UpdateExpression: 'ADD soraCredits :neg1', ExpressionAttributeValues: { ':neg1': -1 } })
//  //   // Check new value, if insufficient, return error
// =========================