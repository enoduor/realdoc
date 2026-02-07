import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser, useClerk } from '@clerk/clerk-react';
import usePaymentModal from './PaymentModal';
import './PricingSection.css';


const PricingSection = () => {
  const navigate = useNavigate();
  const { isLoaded, isSignedIn, user } = useUser();
  const { openSignIn } = useClerk();
  const [billingCycle, setBillingCycle] = useState('monthly');

  const plan = {
    name: 'All in One',
    monthlyPrice: 18,
    originalPrice: 36, // Show discount
    yearlyPrice: null, // Yearly pricing not shown
    yearlyTotal: null,
    yearlySavings: null,
    features: [
      'Unlimited documentation generation',
      'Generate User guides, API docs, Developer guides, etc.',
      'AI Optimized SEO Recommendations with code examples',
      'Production-ready meta tags & schema markup',
      'Keyword ranking & competitor analysis',
      'Automatic website analysis & content discovery',
      'Website analytics & competitor insights',
      'Generate AI Powered UGC content'
    ]
  };

  // Use payment modal hook for subscription checkout
  // For subscriptions, we'll use minimal formData since it's just a subscription signup
  const { createCheckoutSession, loading: paymentLoading, ErrorModalComponent } = usePaymentModal({
    formData: {
      subscription_type: 'monthly',
      plan: 'all-in-one'
    },
    validateForm: () => {
      // No validation needed for subscription signup
      return { valid: true };
    },
    onPaymentSuccess: async () => {
      // After successful payment, redirect to dashboard or home
      navigate('/dashboard');
    },
    successRedirectPath: '/pricing',
    cancelRedirectPath: '/pricing'
  });

  const handleStartTrial = () => {
    if (!isLoaded) {
      return;
    }

    if (!isSignedIn) {
      // If user signs in from pricing, take them straight to the dashboard
      openSignIn({ redirectUrl: `${window.location.origin}/dashboard` });
      return;
    }

    createCheckoutSession({
      clerkUserId: user.id,
      email: user.primaryEmailAddress?.emailAddress || '',
      firstName: user.firstName || '',
      lastName: user.lastName || ''
    });
  };

  return (
    <section className="pricing-section">
      <div className="pricing-container">
        {/* Header */}
        <div className="pricing-header">
          <h2 className="pricing-title">Pricing</h2>
          <p className="pricing-subtitle">Start your free trial. No credit card required.</p>
        </div>

        {/* Pricing Card */}
        <div className="pricing-cards">
          <div className="pricing-card single-card">
            <div className="pricing-card-content">
              {/* Left Column - Pricing & CTA */}
              <div className="pricing-left">
                <h3 className="plan-name">{plan.name}</h3>
                
                <div className="plan-pricing">
                  <div className="price-container">
                    <span className="currency">$</span>
                    <span className="price">{plan.monthlyPrice}</span>
                    {plan.originalPrice && (
                      <span className="original-price-inline">
                        <span className="strikethrough">${plan.originalPrice}/monthly</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="plan-cta">
                  <button 
                    className="cta-button"
                    onClick={handleStartTrial}
                    disabled={paymentLoading}
                  >
                    {paymentLoading ? 'Processing...' : (
                      <>
                        Start Growing Traffic Today
                        <svg className="arrow-icon" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </>
                    )}
                  </button>
                  <p className="cancel-text">Cancel anytime. No questions asked!</p>
                </div>

                <div className="guarantee-box">
                  <svg className="shield-icon" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>7-Day Money-Back Guarantee</span>
                </div>
              </div>

              {/* Right Column - Features */}
              <div className="pricing-right">
                <h4 className="features-title">What's included:</h4>
                <ul className="plan-features">
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
            </div>
          </div>
        </div>
      </div>

      {/* Payment Error Modal */}
      {ErrorModalComponent}
    </section>
  );
};

export default PricingSection;
