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

module.exports = { getPriceId };
