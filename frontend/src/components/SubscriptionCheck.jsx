import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { checkSubscriptionByEmail } from '../api';

const SubscriptionCheck = ({ children, featureName = "this feature" }) => {
  const { user } = useUser();
  const navigate = useNavigate();
  const [hasSubscription, setHasSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSubscription = async () => {
      if (user?.primaryEmailAddress?.emailAddress) {
        try {
          const status = await checkSubscriptionByEmail(user.primaryEmailAddress.emailAddress);
          setHasSubscription(status.hasActiveSubscription);
        } catch (error) {
          console.error('Error checking subscription:', error);
          setHasSubscription(false);
        }
      }
      setLoading(false);
    };

    checkSubscription();
  }, [user]);

  const handleSubscriptionRequired = () => {
    alert(`You need an active subscription to use ${featureName}. Redirecting to pricing...`);
    navigate('/pricing');
  };

  if (loading) {
    return (
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-3"></div>
          <p className="text-blue-800">Checking subscription status...</p>
        </div>
      </div>
    );
  }

  if (hasSubscription === false) {
    return (
      <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <svg className="h-5 w-5 text-red-400 mr-3" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-red-800">Subscription Required</h3>
            <p className="text-sm text-red-700 mt-1">You need an active subscription to use {featureName}.</p>
          </div>
          <button
            onClick={handleSubscriptionRequired}
            className="ml-4 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
          >
            Subscribe Now
          </button>
        </div>
      </div>
    );
  }

  if (hasSubscription === true) {
    return (
      <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center">
          <svg className="h-5 w-5 text-green-400 mr-3" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <p className="text-green-800">✅ Active subscription - {featureName} available</p>
        </div>
      </div>
    );
  }

  return null;
};

// Hook for checking subscription status
export const useSubscriptionCheck = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const [hasSubscription, setHasSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSubscription = async () => {
      if (user?.primaryEmailAddress?.emailAddress) {
        try {
          const status = await checkSubscriptionByEmail(user.primaryEmailAddress.emailAddress);
          setHasSubscription(status.hasActiveSubscription);
        } catch (error) {
          console.error('Error checking subscription:', error);
          setHasSubscription(false);
        }
      }
      setLoading(false);
    };

    checkSubscription();
  }, [user]);

  const requireSubscription = (featureName = "this feature") => {
    if (hasSubscription === false) {
      alert(`You need an active subscription to use ${featureName}. Redirecting to pricing...`);
      navigate('/pricing');
      return false;
    }
    return true;
  };

  return { hasSubscription, loading, requireSubscription };
};

export default SubscriptionCheck;
