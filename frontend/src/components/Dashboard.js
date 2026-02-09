import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser, useClerk } from '@clerk/clerk-react';
import Navigation from './Navigation';
import ErrorModal from './ErrorModal';

const Dashboard = () => {
  const navigate = useNavigate();
  const { isLoaded, isSignedIn, user } = useUser();
  const { openSignIn } = useClerk();
  const [errorModal, setErrorModal] = useState({ 
    show: false, 
    title: '', 
    message: '', 
    type: 'error'
  });

  const [subscription, setSubscription] = useState({
    loading: true,
    hasActiveSubscription: false,
    subscriptionStatus: 'none',
    billingCycle: 'none',
  });

  // Protect dashboard route - redirect to sign-in if not authenticated
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      openSignIn({
        redirectUrl: `${window.location.origin}/dashboard`,
      });
    }
  }, [isLoaded, isSignedIn, openSignIn]);

  useEffect(() => {
    const fetchStatus = async () => {
      if (!isLoaded || !isSignedIn || !user) {
        setSubscription((prev) => ({ ...prev, loading: false }));
        return;
      }

      try {
        const base = window.location.origin;
        const res = await fetch(
          `${base}/api/dashboard/subscription-status?clerkUserId=${encodeURIComponent(
            user.id
          )}`
        );
        const data = await res.json();

        if (data && data.success) {
          setSubscription({
            loading: false,
            hasActiveSubscription: data.hasActiveSubscription,
            subscriptionStatus: data.subscriptionStatus,
            billingCycle: data.billingCycle,
          });
        } else {
          setSubscription((prev) => ({ ...prev, loading: false }));
        }
      } catch (err) {
        console.error('Error fetching subscription status', err);
        setSubscription((prev) => ({ ...prev, loading: false }));
      }
    };

    fetchStatus();
  }, [isLoaded, isSignedIn, user]);

  const buildAiSearchLink = () => {
    const baseUrl = process.env.REACT_APP_AI_SEARCH_URL || 'https://courses.reelpostly.com/ux/advisor.html';
    if (!user || !user.id) return baseUrl;
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}clerkUserId=${encodeURIComponent(user.id)}`;
  };

  const [aiSearchSessionReady, setAiSearchSessionReady] = useState(false);

  useEffect(() => {
    const createAiSearchSession = async () => {
      if (!isLoaded || !isSignedIn || !user || aiSearchSessionReady) return;
      if (!subscription.hasActiveSubscription) return;

      try {
        const base = window.location.origin;
        const res = await fetch(`${base}/api/ai-search/create-session`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clerkUserId: user.id })
        });
        const data = await res.json();
        if (data && data.hasActiveSubscription) {
          setAiSearchSessionReady(true);
        }
      } catch (err) {
        console.error('Error creating AI Search session', err);
      }
    };

    createAiSearchSession();
  }, [isLoaded, isSignedIn, user, subscription.hasActiveSubscription, aiSearchSessionReady]);

  const features = [
    {
      name: 'SEO Generator',
      description: 'Generate comprehensive SEO analysis and recommendations',
      icon: '🔍',
      link: '/seo-generator'
    },
    {
      name: 'Website Analytics',
      description: 'Analyze website traffic and competitor insights',
      icon: '📊',
      link: '/website-analytics'
    },
    {
      name: 'Documentation Generator',
      description: 'Generate comprehensive documentation for your online applications',
      icon: '📚',
      link: '/documentation-generator'
    },
    {
      name: 'AI Search',
      description: 'Search the web with AI-powered insights and answers',
      icon: '🤖',
      link: buildAiSearchLink(),
      external: true // Opens in new tab
    }
  ];

  // Don't render dashboard content if not signed in
  if (!isLoaded || !isSignedIn) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 pt-24">
          <div className="px-4 py-6 sm:px-0 text-center">
            <p className="text-gray-600">Please sign in to access your dashboard.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Global navigation with Clerk sign-in / dashboard / logout */}
      <Navigation />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 pt-24">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              {isLoaded && isSignedIn && user && (
                <p className="mt-1 text-sm text-gray-600">
                  Logged in as{' '}
                  <span className="font-medium">
                    {user.firstName && user.lastName
                      ? `${user.firstName} ${user.lastName}`
                      : user.primaryEmailAddress?.emailAddress || user.id}
                  </span>
                </p>
              )}
            </div>

            {isLoaded && isSignedIn && !subscription.loading && (
              <div className="mt-4 sm:mt-0">
                {subscription.hasActiveSubscription ? (
                  <span className="inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700 border border-green-200">
                    Subscribed ({subscription.subscriptionStatus}
                    {subscription.billingCycle && subscription.billingCycle !== 'none'
                      ? ` · ${subscription.billingCycle}`
                      : ''}
                    )
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center rounded-full bg-yellow-50 px-3 py-1 text-xs font-medium text-yellow-700 border border-yellow-200 cursor-pointer"
                    onClick={() => navigate('/pricing')}
                  >
                    No active subscription – View pricing
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Feature cards */}
          <div className="flex justify-center items-center min-h-[400px]">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-6xl">
              {features.map((feature) => {
                // Render external link for AI Search, internal Link for others
                if (feature.external) {
                  return (
                    <a
                      key={feature.name}
                      href={feature.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-8 rounded-2xl border shadow-sm hover:shadow-md transition-all duration-300 bg-white hover:border-blue-200 border-blue-100 cursor-pointer"
                    >
                      <div className="flex items-center">
                        <span className="text-4xl mr-4">{feature.icon}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {feature.name}
                            </h3>
                            <span className="text-xs text-gray-400">↗</span>
                          </div>
                          <p className="text-sm mt-1 text-gray-600">{feature.description}</p>
                        </div>
                      </div>
                    </a>
                  );
                }
                
                return (
                  <Link
                    key={feature.name}
                    to={feature.link}
                    className="block p-8 rounded-2xl border shadow-sm hover:shadow-md transition-all duration-300 bg-white hover:border-blue-200 border-blue-100 cursor-pointer"
                  >
                    <div className="flex items-center">
                      <span className="text-4xl mr-4">{feature.icon}</span>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {feature.name}
                        </h3>
                        <p className="text-sm mt-1 text-gray-600">{feature.description}</p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      {/* Error Modal */}
      <ErrorModal
        isOpen={errorModal.show}
        onClose={() => setErrorModal({ show: false, title: '', message: '', type: 'error' })}
        title={errorModal.title}
        message={errorModal.message}
        type={errorModal.type}
      />
    </div>
  );
};

export default Dashboard;
