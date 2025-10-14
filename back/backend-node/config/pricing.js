// config/pricing.js

// Subscription price IDs (recurring)
function getPriceId(plan, cycle) {
  const table = {
    starter: {
      monthly: process.env.STRIPE_STARTER_MONTHLY_PRICE_ID,
      yearly:  process.env.STRIPE_STARTER_YEARLY_PRICE_ID
    },
    creator: {
      monthly: process.env.STRIPE_CREATOR_MONTHLY_PRICE_ID,
      yearly:  process.env.STRIPE_CREATOR_YEARLY_PRICE_ID
    }
  };
  return table?.[plan]?.[cycle] || null;
}

// Sora API credit price IDs (one-time payments)
function getSoraApiPriceId(amount) {
  const priceMap = {
    10: process.env.STRIPE_SORA_10_PRICE_ID,
    20: process.env.STRIPE_SORA_20_PRICE_ID,
    50: process.env.STRIPE_SORA_50_PRICE_ID,
    100: process.env.STRIPE_SORA_100_PRICE_ID
  };
  return priceMap[amount] || null;
}

// Get all Sora API price options
function getSoraApiPrices() {
  return {
    10: process.env.STRIPE_SORA_10_PRICE_ID,
    20: process.env.STRIPE_SORA_20_PRICE_ID,
    50: process.env.STRIPE_SORA_50_PRICE_ID,
    100: process.env.STRIPE_SORA_100_PRICE_ID
  };
}

module.exports = { getPriceId, getSoraApiPriceId, getSoraApiPrices };
