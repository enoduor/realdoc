import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useUser, useSession } from '@clerk/clerk-react';
import ClerkUserProfile from './Auth/ClerkUserProfile';
import { checkSubscriptionStatus, checkSubscriptionBySession, linkTempUser, createOrLinkClerkUser } from '../api';

const Dashboard = () => {
  const [hasSubscription, setHasSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useUser();
  const { session } = useSession();

  // Debug: Log Clerk session info
  useEffect(() => {
    console.log('🔍 Dashboard Debug Info:');
    console.log('- User:', user ? 'Authenticated' : 'Not authenticated');
    console.log('- Session:', session ? 'Active' : 'No session');
    if (user) {
      console.log('- User ID:', user.id);
      console.log('- User Email:', user.primaryEmailAddress?.emailAddress);
    }
    if (session) {
      console.log('- Session ID:', session.id);
      // Test token generation
      session.getToken().then(token => {
        console.log('- Token generated:', token ? 'Yes' : 'No');
        if (token) {
          console.log('- Token preview:', token.substring(0, 20) + '...');
        }
      }).catch(err => {
        console.error('- Token generation failed:', err);
      });
    }
  }, [user, session]);

  // Helper function to get user-specific localStorage keys
  const getUserStorageKey = (key) => {
    const userEmail = user?.primaryEmailAddress?.emailAddress || 'anonymous';
    return `${key}_${userEmail}`;
  };

  // Helper function to clear subscription status for current user
  const clearSubscriptionStatus = () => {
    const hasSubscriptionKey = getUserStorageKey('hasSubscription');
    const sessionIdKey = getUserStorageKey('subscriptionSessionId');
    localStorage.removeItem(hasSubscriptionKey);
    localStorage.removeItem(sessionIdKey);
    setHasSubscription(false);
  };

  useEffect(() => {
    const checkSubscription = async () => {
      try {
        // Check if user just completed payment (has session_id)
        const sessionId = searchParams.get('session_id');
        
        if (sessionId) {
          // User just completed payment - check MongoDB for subscription status
          console.log('🎉 Payment completed! Checking subscription status...');
          const subscriptionStatus = await checkSubscriptionBySession(sessionId);
          
          if (subscriptionStatus.hasActiveSubscription) {
            console.log('✅ Subscription found in database!');
            const hasSubscriptionKey = getUserStorageKey('hasSubscription');
            const sessionIdKey = getUserStorageKey('subscriptionSessionId');
            localStorage.setItem(hasSubscriptionKey, 'true');
            localStorage.setItem(sessionIdKey, sessionId);
            setHasSubscription(true);
          } else {
            console.log('❌ No subscription found in database');
            setHasSubscription(false);
          }
          setLoading(false);
          return;
        }

        // Check localStorage first for subscription status (user-specific)
        const hasSubscriptionKey = getUserStorageKey('hasSubscription');
        const sessionIdKey = getUserStorageKey('subscriptionSessionId');
        const storedSubscription = localStorage.getItem(hasSubscriptionKey);
        const storedSessionId = localStorage.getItem(sessionIdKey);
        
        if (storedSubscription === 'true' && storedSessionId) {
          // Verify subscription status from database
          console.log('✅ Found stored subscription, verifying with database...');
          const subscriptionStatus = await checkSubscriptionBySession(storedSessionId);
          
          if (subscriptionStatus.hasActiveSubscription) {
            console.log('✅ Subscription verified in database!');
            setHasSubscription(true);
          } else {
            console.log('❌ Subscription not found in database, clearing localStorage');
            clearSubscriptionStatus();
          }
          setLoading(false);
          return;
        }

        // Normal subscription check for authenticated users
        console.log('🔍 Checking subscription status for authenticated user...');
        
        // First, create or link Clerk user with database user
        try {
          console.log('🔗 Creating/linking Clerk user with database...');
          const linkResult = await createOrLinkClerkUser();
          console.log('✅ Clerk user linked:', linkResult);
        } catch (error) {
          console.log('ℹ️ Clerk user linking failed:', error.message);
        }
        
        // Now check subscription status
        const status = await checkSubscriptionStatus();
        setHasSubscription(status.hasActiveSubscription);
        
        // Store the result in localStorage (user-specific)
        if (status.hasActiveSubscription) {
          localStorage.setItem(hasSubscriptionKey, 'true');
          console.log('✅ User has active subscription, stored in localStorage');
        } else {
          console.log('❌ User does not have active subscription');
        }

        // If user is authenticated but no subscription found, try to link with temporary user
        if (!status.hasActiveSubscription && user) {
          const userEmail = user.primaryEmailAddress?.emailAddress;
          if (userEmail) {
            try {
              console.log('🔗 Attempting to link temporary user with email:', userEmail);
              const linkResult = await linkTempUser(userEmail);
              if (linkResult.success && linkResult.user.hasActiveSubscription) {
                console.log('✅ Successfully linked temporary user!');
                setHasSubscription(true);
                localStorage.setItem(hasSubscriptionKey, 'true');
              }
            } catch (error) {
              console.log('ℹ️ No temporary user found to link:', error.message);
            }
          }
        }
      } catch (error) {
        console.error('Error checking subscription:', error);
        setHasSubscription(false);
      } finally {
        setLoading(false);
      }
    };

    // Only check subscription if user is loaded
    if (user) {
      checkSubscription();
    } else {
      setLoading(false);
    }
  }, [searchParams, user]);

  // Clear subscription status when user changes
  useEffect(() => {
    if (user) {
      // Clear any old subscription data when user changes
      const hasSubscriptionKey = getUserStorageKey('hasSubscription');
      const sessionIdKey = getUserStorageKey('subscriptionSessionId');
      
      // Only clear if the keys don't match current user
      const currentHasSubscription = localStorage.getItem(hasSubscriptionKey);
      const currentSessionId = localStorage.getItem(sessionIdKey);
      
      if (!currentHasSubscription && !currentSessionId) {
        // Clear any old generic keys that might exist
        localStorage.removeItem('hasSubscription');
        localStorage.removeItem('subscriptionSessionId');
      }
    }
  }, [user]);

  // Cleanup old generic localStorage keys on component mount
  useEffect(() => {
    // Remove any old generic keys that might exist from previous implementation
    const oldKeys = ['hasSubscription', 'subscriptionSessionId'];
    oldKeys.forEach(key => {
      if (localStorage.getItem(key)) {
        console.log(`🧹 Cleaning up old localStorage key: ${key}`);
        localStorage.removeItem(key);
      }
    });
  }, []);

    const handleFeatureClick = (e, feature) => {
      // Only block navigation if we've confirmed the user doesn't have a subscription
      // Allow navigation if subscription status is still loading (null) or if user has subscription
      if (hasSubscription === false) {
        e.preventDefault();
        alert('You must subscribe to use this feature. Redirecting to pricing...');
        navigate('/pricing');
      }
      // If hasSubscription is null (loading) or true, allow navigation to proceed
    };

  const features = [
    {
      name: 'Caption Generator',
      description: 'Create engaging AI-powered captions for your social media posts',
      icon: '✍️',
      link: '/app/caption-generator'
    },
    {
      name: 'Hashtag Generator',
      description: 'Generate relevant hashtags to increase your content reach',
      icon: '#️⃣',
      link: '/app/hashtag-generator'
    },
    {
      name: 'Media Upload',
      description: 'Upload and manage your media content',
      icon: '📸',
      link: '/app/media-upload'
    },
    {
              name: 'Platform Preview',
              description: 'Preview and publish your content to different platforms',
              icon: '🚀',
                      link: '/app/platform-preview'
    },
    {
      name: 'Publish Now',
      description: 'Publish posts immediately across multiple platforms',
      icon: '🚀',
      link: '/app/scheduler'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-bold">Reelpostly</h1>
              </div>
            </div>
            <div className="flex items-center">
              <ClerkUserProfile />
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h2 className="text-2xl font-bold mb-8">Welcome to Reelpostly</h2>
          
          {/* Payment Success Message */}
          {(searchParams.get('session_id') || localStorage.getItem('hasSubscription') === 'true') && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-800">
                    {searchParams.get('session_id') ? 'Payment Successful! 🎉' : 'Subscription Active! ✅'}
                  </h3>
                  <div className="mt-2 text-sm text-green-700">
                    <p>Your subscription is now active. You can access all features and start creating posts!</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {features.map((feature) => (
              <Link
                key={feature.name}
                to={feature.link}
                onClick={(e) => handleFeatureClick(e, feature)}
                className={`block p-6 rounded-lg shadow transition-shadow ${
                  hasSubscription 
                    ? 'bg-white hover:shadow-md cursor-pointer' 
                    : 'bg-gray-100 cursor-not-allowed opacity-75'
                }`}
              >
                <div className="flex items-center">
                  <span className="text-4xl mr-4">{feature.icon}</span>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">
                      {feature.name}
                      {hasSubscription && <span className="ml-2 text-green-500">✅</span>}
                    </h3>
                    <p className="mt-1 text-gray-500">
                      {feature.description}
                    </p>
                    {!hasSubscription && (
                      <p className="mt-2 text-sm text-red-500">
                        ⚠️ Subscription required
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard; 