import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useUser, useSession } from '@clerk/clerk-react';
import { 
  Linkedin, 
  Twitter, 
  Instagram, 
  Youtube, 
  Music,
  Facebook
} from 'lucide-react';
import ClerkUserProfile from './Auth/ClerkUserProfile';
import { checkSubscriptionStatus, checkSubscriptionByEmail, createOrLinkClerkUser, getUserUsageStatus } from '../api';

const Dashboard = () => {
  const [hasSubscription, setHasSubscription] = useState(null);
  const [usageStatus, setUsageStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useUser();
  const { session } = useSession();



  useEffect(() => {
    const checkSubscription = async () => {
      try {
        
        // First, create or link Clerk user with database user
        try {
          const linkResult = await createOrLinkClerkUser();
        } catch (error) {
        }
        
        // Check subscription status using email lookup (main process)
        const userEmail = user.primaryEmailAddress?.emailAddress;
        if (userEmail) {
          const status = await checkSubscriptionByEmail(userEmail);
          setHasSubscription(status.hasActiveSubscription);
          
          // Get usage status if user has subscription
          if (status.hasActiveSubscription) {
            try {
              const usage = await getUserUsageStatus();
              setUsageStatus(usage);
            } catch (error) {
              console.error('Error getting usage status:', error);
            }
          }
        } else {
          setHasSubscription(false);
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
  }, [user]);


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
      name: 'Generate Captions',
      description: 'Create engaging AI-powered captions for your social media posts',
      icon: '✍️',
      link: '/app/caption-generator'
    },
    {
      name: 'Generate Hashtags',
      description: 'Generate relevant hashtags to increase your content reach',
      icon: '#️⃣',
      link: '/app/hashtag-generator'
    },
    {
      name: 'Upload Media',
      description: 'Upload and manage your media content',
      icon: '📸',
      link: '/app/media-upload'
    },
    {
      name: 'Edit & Publish',
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
          
          {/* Daily Usage Status */}
          {hasSubscription && usageStatus && (
            <div className="mb-6 bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Daily Usage</h3>
                  <p className="text-sm text-gray-600">
                    Plan: <span className="font-medium capitalize">{usageStatus.plan}</span>
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600">
                    {usageStatus.usage.used}/{usageStatus.usage.limit}
                  </div>
                  <p className="text-sm text-gray-500">posts today</p>
                  {usageStatus.usage.remaining === 0 && (
                    <p className="text-xs text-red-500 mt-1">
                      Resets in {Math.ceil((new Date(usageStatus.usage.resetAt) - new Date()) / (1000 * 60 * 60))} hours
                    </p>
                  )}
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="mt-4">
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>Posts Used</span>
                  <span>{usageStatus.usage.remaining} remaining</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      usageStatus.usage.remaining === 0 ? 'bg-red-500' : 
                      usageStatus.usage.remaining <= 1 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ 
                      width: `${(usageStatus.usage.used / usageStatus.usage.limit) * 100}%` 
                    }}
                  ></div>
                </div>
              </div>
            </div>
          )}
          
          {/* Payment Success Message */}
          {hasSubscription && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-center">
              <div className="flex justify-center">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-800">
                    Subscription Active! ✅
                  </h3>
                  <div className="mt-2 text-sm text-green-700">
                    <p>Your subscription is now active. You can access all features and start creating posts!</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* OAuth Connection Buttons */}
          <div className="mb-8 p-6 bg-white rounded-lg shadow text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Connect Your Social Media Accounts</h3>
            <p className="text-sm text-gray-600 mb-4">Connect your accounts to start publishing content across platforms.</p>
            <div className="flex flex-wrap gap-4 justify-center">
              <a
                href={`/api/auth/linkedin/oauth2/start/linkedin?userId=${user?.id}&email=${user?.primaryEmailAddress?.emailAddress}`}
                className="inline-flex items-center justify-center w-12 h-12 bg-[#0A66C2] text-white rounded-lg hover:bg-[#004182] transition-colors"
                title="Connect LinkedIn"
              >
                <Linkedin size={24} />
              </a>
              <a
                href={`/api/auth/twitter/oauth/start/twitter?userId=${user?.id}&email=${user?.primaryEmailAddress?.emailAddress}`}
                className="inline-flex items-center justify-center w-12 h-12 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                title="Connect Twitter"
              >
                <Twitter size={24} />
              </a>
              <a
                href={`/api/auth/facebook/oauth/start/facebook?userId=${user?.id}&email=${user?.primaryEmailAddress?.emailAddress}`}
                className="inline-flex items-center justify-center w-12 h-12 bg-[#1877F2] text-white rounded-lg hover:bg-[#0d5dbf] transition-colors"
                title="Connect Facebook"
              >
                <Facebook size={24} />
              </a>
              <a
                href={`/api/auth/instagram/oauth/start/instagram?userId=${user?.id}&email=${user?.primaryEmailAddress?.emailAddress}`}
                className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-colors"
                title="Connect Instagram"
              >
                <Instagram size={24} />
              </a>
              <a
                href={`/api/auth/youtube/oauth2/start/google?userId=${user?.id}&email=${user?.primaryEmailAddress?.emailAddress}`}
                className="inline-flex items-center justify-center w-12 h-12 bg-[#FF0000] text-white rounded-lg hover:bg-[#cc0000] transition-colors"
                title="Connect YouTube"
              >
                <Youtube size={24} />
              </a>
              <div
                className="inline-flex items-center justify-center w-12 h-12 bg-gray-400 text-white rounded-lg cursor-not-allowed"
                title="TikTok - Coming Soon"
              >
                <Music size={24} />
              </div>
            </div>
          </div>
          
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