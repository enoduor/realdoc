import React, { useState } from 'react';
import { createSubscriptionSession, getPriceId } from '../api';
import ErrorModal from './ErrorModal';
import './PricingSection.css';

const PricingSection = () => {
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [errorModal, setErrorModal] = useState({ 
    show: false, 
    title: '', 
    message: '', 
    type: 'error'
  });

  const plans = [
    {
      name: 'Starter',
      description: 'Perfect for solo creators',
      monthlyPrice: 9,
      yearlyPrice: 5.33,
      yearlyTotal: 64,
      yearlySavings: 44,
      features: [
        'Free public video downloads',
        '6 connected social accounts',
        '1 Post → 6 platform posts',
        'AI captions & hashtags',
        '1 post per day limit',
        '6 platform posts per day'
        
      ],
      popular: false,
      bestDeal: false
    },
    {
      name: 'Creator',
      description: 'For growing creators & startups',
      monthlyPrice: 18,
      yearlyPrice: 10.75,
      yearlyTotal: 129,
      yearlySavings: 87,
      features: [
        'Free public video downloads',
        '6 connected social accounts',
        '1 Post → 6 platform posts',
        'AI captions & hashtags',
        'Content studio access',
        '5 posts per day limit',
        '30 platform posts per day'
      ],
      popular: true,
      bestDeal: false
    },
    {
      name: 'Enterprise',
      description: 'For organizations & institutions',
      isEnterprise: true,
      features: [
        'Custom integrations & workflows',
        'Dedicated account manager',
        'White-label solutions',
        'Customized analytics & reporting',
        'Custom training & onboarding',
        'Priority technical support'
      ],
      popular: false,
      bestDeal: false
    }
  ];

  const [loading, setLoading] = useState(false);

  const handleStartTrial = async (plan) => {
    try {
      setLoading(true);
      
      // Debug logging (removed for security)
      
      // Get price ID from backend (not hardcoded)
      const { priceId } = await getPriceId(plan.name.toLowerCase(), billingCycle);
      const { id: clerkUserId } = window.Clerk?.user || {};  // or from your auth context
      
      const response = await createSubscriptionSession(priceId, {
        clerkUserId,
        plan: plan.name.toLowerCase(),
        billingCycle,
        // promoCode: 'FIRSTPURCHASE' // optional
      });
      
      // API response received (logging removed for security)
      
      // Redirect to Stripe checkout (browser will log navigation)
      window.location.replace(response.url);
      
    } catch (error) {
      console.error('❌ Error starting trial:', error);
      console.error('❌ Error details:', error.message, error.stack);
      setErrorModal({
        show: true,
        title: 'Trial Start Failed',
        message: `Failed to start trial: ${error.message}`,
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="pricing-section">
      <div className="pricing-container">
        {/* Header */}
        <div className="pricing-header">
          <h2 className="pricing-title">Eliminate Platform Fragmentation</h2>
          <p className="pricing-subtitle">Start your 3-day free trial and cancel anytime. 30-day money-back guarantee</p>
          
          {/* Billing Toggle */}
          <div className="billing-toggle">
            <span className={billingCycle === 'monthly' ? 'active' : ''}>Monthly</span>
            <button 
              className="toggle-switch"
              onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
            >
              <div className={`toggle-slider ${billingCycle === 'yearly' ? 'yearly' : ''}`}></div>
            </button>
            <span className={billingCycle === 'yearly' ? 'active' : ''}>
              Yearly
              {billingCycle === 'yearly' && <span className="discount-badge">40% OFF</span>}
            </span>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="pricing-cards">
          {plans.map((plan, index) => (
            <div 
              key={index} 
              className={`pricing-card ${plan.popular ? 'popular' : ''} ${plan.bestDeal ? 'best-deal' : ''}`}
            >
              {/* Badges */}
              {plan.popular && <div className="badge popular-badge">Most Popular</div>}
              {plan.bestDeal && <div className="badge best-deal-badge">Best Deal</div>}
              {billingCycle === 'yearly' && !plan.isEnterprise && (
                <div className="badge discount-badge">40% OFF</div>
              )}

              {/* Plan Header */}
              <div className="plan-header">
                <h3 className="plan-name">{plan.name}</h3>
                <p className="plan-description">{plan.description}</p>
              </div>

              {/* Pricing */}
              {!plan.isEnterprise ? (
                <div className="plan-pricing">
                  <div className="price-container">
                    <span className="currency">$</span>
                    <span className="price">
                      {billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice}
                    </span>
                    <span className="period">/month</span>
                  </div>
                  
                  {billingCycle === 'yearly' && (
                    <div className="yearly-info">
                      <p className="yearly-total">Billed as ${plan.yearlyTotal}/year</p>
                      <p className="yearly-savings">Save ${plan.yearlySavings} with yearly pricing</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="plan-pricing enterprise-pricing">
                  <div className="enterprise-price">
                    <span className="custom-text">Custom</span>
                    <p className="enterprise-subtitle">Tailored to your organization's needs</p>
                  </div>
                </div>
              )}

              {/* Features */}
              <div className="plan-features">
                <ul>
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex}>
                      <svg className="check-icon" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              {/* CTA */}
              <div className="plan-cta">
                {!plan.isEnterprise ? (
                  <>
                    <p className="trial-info">Start your 3-day free trial and cancel anytime.</p>
                    <button 
                      className={`cta-button ${plan.popular ? 'popular' : ''} ${plan.bestDeal ? 'best-deal' : ''}`}
                      onClick={() => handleStartTrial(plan)}
                      disabled={loading}
                    >
                      {loading ? 'Loading...' : 'Start Free Trial'}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="trial-info">Get personalized guidance and custom solutions for your organization.</p>
                    <a 
                      href="https://docs.google.com/forms/d/e/1FAIpQLSdXGiQBAVMQy3lXGkNdRwqgfWw20E_VlXODYloiMo7L3bwYCw/viewform"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cta-button enterprise"
                    >
                      Contact Us
                    </a>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="pricing-footer">
          <p className="guarantee">
            <svg className="shield-icon" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            30-day money-back guarantee
          </p>
        </div>
      </div>

      {/* Error Modal */}
      <ErrorModal
        isOpen={errorModal.show}
        onClose={() => setErrorModal({ show: false, title: '', message: '', type: 'error' })}
        title={errorModal.title}
        message={errorModal.message}
        type={errorModal.type}
      />
    </section>
  );
};

export default PricingSection;
