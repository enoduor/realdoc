import React, { useState } from 'react';
import { useClerk, useUser } from '@clerk/clerk-react';
import ErrorModal from './ErrorModal';
import './PricingSection.css';

// API functions moved inline
const getApiUrl = () => {
  // Always use current origin (ALB routes /api/* to node backend)
  // This works in both production and development when running locally
  if (typeof window !== 'undefined' && window.location) {
    return window.location.origin;
  }
  
  // Fallback only for non-browser environments (should never happen in React)
  throw new Error('Unable to determine API URL: window.location is not available');
};

const getPriceId = async (plan, cycle) => {
  const API_URL = getApiUrl();
  const r = await fetch(`${API_URL}/api/stripe/get-price-id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan, billingCycle: cycle })
  });
  const text = await r.text();
  const isJson = (r.headers.get("content-type") || "").includes("application/json");
  const data = isJson ? JSON.parse(text) : text;
  if (!r.ok) {
    if (r.status === 400 && typeof data === "object" && data.varName) {
      throw new Error(`Pricing configuration error: ${data.error}. Please contact support.`);
    }
    throw new Error(`getPriceId: ${r.status} ${typeof data === "string" ? data : data?.error || 'Unknown error'}`);
  }
  return data;
};

const createSubscriptionSession = async (priceId, { plan, billingCycle, promoCode, email, clerkUserId } = {}, authToken) => {
  try {
    const API_URL = getApiUrl();
    const headers = {
      "Content-Type": "application/json",
    };
    
    // Add Authorization header if auth token is provided
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }
    
    const res = await fetch(`${API_URL}/api/billing/create-checkout-session`, {
      method: "POST",
      headers,
      body: JSON.stringify({ priceId, plan, billingCycle, promoCode, email, clerkUserId }),
    });
    const text = await res.text();
    const isJson = (res.headers.get("content-type") || "").includes("application/json");
    const data = isJson ? JSON.parse(text) : text;
    if (!res.ok) {
      throw new Error(typeof data === "string" ? data : data?.error || res.statusText);
    }
    return data;
  } catch (error) {
    console.error('Error creating subscription session:', error);
    throw error;
  }
};

const PricingSection = () => {
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [errorModal, setErrorModal] = useState({ 
    show: false, 
    title: '', 
    message: '', 
    type: 'error'
  });

  const plan = {
    name: 'All in One',
    monthlyPrice: 18,
    originalPrice: 36,
    yearlyPrice: 10.75,
    yearlyTotal: 129,
    yearlySavings: 87,
    features: [
      'Unlimited documentation generation',
      'All documentation types (User guides, API docs, Developer guides, etc.)',
      'SEO analysis & recommendations',
      'Website analytics & competitor insights',
      'Multiple output formats (Markdown, HTML, Text)',
      'Advanced customization options',
      'Code examples support',
      'Priority support'
    ]
  };

  const [loading, setLoading] = useState(false);
  const { isSignedIn } = useUser();
  const { openSignUp } = useClerk();

  const handleStartTrial = async () => {
    // If user is not signed in, open Clerk signup
    if (!isSignedIn) {
      openSignUp();
      return;
    }

    // User is signed in - proceed to Stripe checkout
    try {
      setLoading(true);
      
      // Get price ID from backend
      const { priceId } = await getPriceId('creator', billingCycle);
      
      // Get Clerk auth token
      let authToken = null;
      let clerkUserId = null;
      if (window.Clerk && window.Clerk.user) {
        clerkUserId = window.Clerk.user.id;
        if (window.Clerk.session) {
          try {
            authToken = await window.Clerk.session.getToken();
          } catch (error) {
            console.error('Error getting Clerk token:', error);
          }
        }
      }
      
      // Create checkout session
      const response = await createSubscriptionSession(priceId, {
        plan: 'creator',
        billingCycle,
        clerkUserId,
      }, authToken);
      
      // Redirect to Stripe checkout
      window.location.href = response.url;
      
    } catch (error) {
      console.error('❌ Error starting trial:', error);
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
          <h2 className="pricing-title">Pricing</h2>
          <p className="pricing-subtitle">Start your free trial. No credit card required.</p>
          
          {/* Billing Toggle */}
          <div className="billing-toggle">
            <span className={billingCycle === 'monthly' ? 'active' : ''}>Monthly</span>
            <button 
              className="toggle-switch"
              onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
              aria-label="Toggle billing cycle"
            >
              <div className={`toggle-slider ${billingCycle === 'yearly' ? 'yearly' : ''}`}></div>
            </button>
            <span className={billingCycle === 'yearly' ? 'active' : ''}>
              Yearly
              {billingCycle === 'yearly' && <span className="discount-badge">Save 40%</span>}
            </span>
          </div>
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
                    <span className="price">
                      {billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice}
                    </span>
                    {billingCycle === 'monthly' && plan.originalPrice && (
                      <span className="original-price-inline">
                        <span className="strikethrough">${plan.originalPrice}/monthly</span>
                      </span>
                    )}
                    {billingCycle === 'yearly' && (
                      <span className="yearly-savings-inline">
                        Billed ${plan.yearlyTotal}/year • Save ${plan.yearlySavings}
                      </span>
                    )}
                  </div>
                </div>

                <div className="plan-cta">
                  <button 
                    className="cta-button"
                    onClick={handleStartTrial}
                    disabled={loading}
                  >
                    {loading ? 'Loading...' : (
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
