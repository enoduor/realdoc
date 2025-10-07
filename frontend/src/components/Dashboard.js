import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser, useSession, useAuth } from '@clerk/clerk-react';
import { Linkedin, Twitter, Instagram, Youtube, Music, Facebook } from 'lucide-react';
import ClerkUserProfile from './Auth/ClerkUserProfile';
import ErrorModal from './ErrorModal';
import VideoDownloader from './VideoDownloader';
import { getUserUsageStatus, getCheckoutSession } from '../api';
import { useAuthContext } from '../context/AuthContext';

const Dashboard = () => {
  const navigate = useNavigate();
  const { isSignedIn, getToken } = useAuth();
  const { user } = useUser();

  // 🔌 from AuthContext (DB-backed)
  const { me, loading, refresh } = useAuthContext();

  // local UI state
  const [usageStatus, setUsageStatus] = useState(null);
  const [welcomeMsg, setWelcomeMsg] = useState('');
  const [checking, setChecking] = useState(false);
  const [showVideoDownloader, setShowVideoDownloader] = useState(false);
  const [errorModal, setErrorModal] = useState({ 
    show: false, 
    title: '', 
    message: '', 
    type: 'error',
    onConfirm: null,
    confirmText: 'OK',
    showCancel: false,
    cancelText: 'Cancel'
  });
  const [successModal, setSuccessModal] = useState({
    show: false,
    title: '',
    message: '',
    type: 'success'
  });

  // Convenience: derive hasSubscription from /auth/me snapshot
  const sub = (me?.subscriptionStatus || 'none').toLowerCase();
  const hasSubscription = sub === 'active' || sub === 'trialing';

  // Handle URL parameters for success/error messages
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const connected = urlParams.get('connected');
    const error = urlParams.get('error');

    if (connected) {
      const platformNames = {
        'linkedin': 'LinkedIn',
        'twitter': 'Twitter', 
        'youtube': 'YouTube',
        'tiktok': 'TikTok',
        'facebook': 'Facebook',
        'instagram': 'Instagram'
      };
      
      const platformName = platformNames[connected] || connected;
      setSuccessModal({
        show: true,
        title: 'Success!',
        message: `${platformName} account connected successfully!`,
        type: 'success'
      });
      
      // Clean up URL parameters
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }

    if (error) {
      const errorMessages = {
        'linkedin_auth_failed': 'LinkedIn connection failed. Please try again.',
        'twitter_auth_failed': 'Twitter connection failed. Please try again.',
        'youtube_auth_failed': 'YouTube connection failed. Please try again.',
        'tiktok_auth_failed': 'TikTok connection failed. Please try again.',
        'facebook_auth_failed': 'Facebook connection failed. Please try again.',
        'instagram_auth_failed': 'Instagram connection failed. Please try again.'
      };
      
      setErrorModal({
        show: true,
        title: 'Connection Failed',
        message: errorMessages[error] || 'Connection failed. Please try again.',
        type: 'error',
        onConfirm: () => setErrorModal({ ...errorModal, show: false }),
        confirmText: 'OK'
      });
      
      // Clean up URL parameters
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, []);

  // Handle account deletion
  const handleDeleteAccount = async () => {
    try {
      const token = await getToken();
      if (!token) {
        setErrorModal({
          show: true,
          title: 'Error',
          message: 'Authentication required to delete account.',
          type: 'error',
          onConfirm: () => setErrorModal({ ...errorModal, show: false }),
          confirmText: 'OK'
        });
        return;
      }

      const response = await fetch('/api/auth/delete-account', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // Account deleted successfully, redirect to confirmation page
        window.location.href = '/account-deleted';
      } else {
        const errorData = await response.json();
        setErrorModal({
          show: true,
          title: 'Error',
          message: errorData.error || 'Failed to delete account. Please try again.',
          type: 'error',
          onConfirm: () => setErrorModal({ ...errorModal, show: false }),
          confirmText: 'OK'
        });
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      setErrorModal({
        show: true,
        title: 'Error',
        message: 'An error occurred while deleting your account. Please try again.',
        type: 'error',
        onConfirm: () => setErrorModal({ ...errorModal, show: false }),
        confirmText: 'OK'
      });
    }
  };
  

  // 1) Handle ?session_id banner + refresh DB snapshot afterward
  useEffect(() => {
    const url = new URL(window.location.href);
    const sessionId = url.searchParams.get('session_id');
    if (!sessionId) return;

    const shownKey = `welcome_for_${sessionId}`;
    if (sessionStorage.getItem(shownKey)) {
      url.searchParams.delete('session_id');
      window.history.replaceState({}, '', url.toString());
      return;
    }

    setChecking(true);
    getCheckoutSession(sessionId)
      .then(async (data) => {
        if (data.subscriptionStatus === 'trialing') {
          setWelcomeMsg(`🎉 Welcome to the ${data.plan} plan! Your trial is active.`);
        } else if (data.subscriptionStatus === 'active') {
          setWelcomeMsg(`✅ Subscription active: ${data.plan} (${data.billingCycle}).`);
        } else {
          setWelcomeMsg('⏳ Processing your subscription… this may take a moment.');
        }
        // mark as shown + clean URL
        sessionStorage.setItem(shownKey, '1');
        url.searchParams.delete('session_id');
        window.history.replaceState({}, '', url.toString());

        // 📥 pull latest DB state after Stripe redirect
        await refresh();
      })
      .catch(() => {
        setWelcomeMsg("⚠️ We couldn't confirm your subscription yet. Please refresh in a minute.");
      })
      .finally(() => setChecking(false));
  }, [refresh]);

  // 2) Bootstrap: once signed-in, ensure we have fresh /auth/me and usage (if subscribed)
  useEffect(() => {
    const boot = async () => {
      if (!isSignedIn || !user) return;
      await refresh(); // pulls /auth/me into context
      const status = (me?.subscriptionStatus || 'none').toLowerCase();
      if (status === 'active' || status === 'trialing') {
        try {
          const usage = await getUserUsageStatus();
          setUsageStatus(usage);
        } catch (e) {
          console.error('Error getting usage status:', e);
        }
      } else {
        setUsageStatus(null);
      }
    };
    // run after first render + whenever `isSignedIn` changes
    // also run when `me` changes to populate usage after webhook
    boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, user, me?.subscriptionStatus]);

  // 3) Refresh /auth/me on tab focus (stay in sync with webhooks)
  useEffect(() => {
    const onFocus = async () => {
      try {
        await refresh();
        const status = (me?.subscriptionStatus || 'none').toLowerCase();
        if (status === 'active' || status === 'trialing') {
          const usage = await getUserUsageStatus().catch(() => null);
          if (usage) setUsageStatus(usage);
        }
      } catch {}
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh, me?.subscriptionStatus]);

  // 4) Gentle polling for ~20s if we don’t yet see the sub (bridges webhook delay)
  useEffect(() => {
    let tries = 0;
    const maxTries = 10;
    let timer = null;

    const tick = async () => {
      try {
        await refresh();
        const status = (me?.subscriptionStatus || 'none').toLowerCase();
        if (status === 'active' || status === 'trialing') {
          clearInterval(timer);
          const usage = await getUserUsageStatus().catch(() => null);
          if (usage) setUsageStatus(usage);
          return;
        }
      } catch {}
      tries += 1;
      if (tries >= maxTries && timer) clearInterval(timer);
    };

    if (!hasSubscription) {
      timer = setInterval(tick, 2000);
    }
    return () => timer && clearInterval(timer);
  }, [hasSubscription, refresh, me?.subscriptionStatus]);

  // Gate features if not subscribed
  const handleFeatureClick = (e) => {
    if (!hasSubscription) {
      e.preventDefault();
      setErrorModal({
        show: true,
        title: 'Subscription Required',
        message: 'You need an active subscription to access this feature. Would you like to view our pricing plans?',
        type: 'warning',
        onConfirm: () => {
          setErrorModal({ show: false, title: '', message: '' });
          navigate('/pricing');
        },
        confirmText: 'View Pricing',
        showCancel: true,
        cancelText: 'Cancel'
      });
    }
  };

  const features = [
    { name: 'Start Creating', description: 'Complete content creation workflow - captions, hashtags, media, and publishing', icon: '🎯', link: '/app/caption-generator' },
    { name: 'Download Videos', description: 'Find Videos to download and repurpose', icon: '📥', action: () => setShowVideoDownloader(true) },
    { name: 'Generate Captions', description: 'Create engaging AI-powered captions for your social media posts', icon: '✍️', link: '/app/caption-generator', hidden: true },
    { name: 'Generate Hashtags', description: 'Generate relevant hashtags to increase your content reach', icon: '#️⃣', link: '/app/hashtag-generator', hidden: true },
    { name: 'Upload Media', description: 'Upload and manage your media content', icon: '📸', link: '/app/media-upload', hidden: true },
    { name: 'Edit & Publish', description: 'Preview and publish your content to different platforms', icon: '🚀', link: '/app/platform-preview', hidden: true },
    { name: 'Publish Now', description: 'Publish posts immediately across multiple platforms', icon: '🚀', link: '/app/scheduler', hidden: true }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {welcomeMsg && (
        <div style={{ margin: '12px auto', maxWidth: '1200px', padding: '12px 16px', borderRadius: 10, background: '#e8f5e9', border: '1px solid #c8e6c9', textAlign: 'center' }}>
          {welcomeMsg}
        </div>
      )}

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
          <div className="mb-8">
            <h2 className="text-2xl font-bold">Welcome to Reelpostly</h2>
          </div>

          {/* Daily Usage */}
          {hasSubscription && usageStatus && (
            <div className="mb-6 bg-white rounded-lg shadow p-6 overflow-hidden">
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
              <div className="mt-4">
                <div className="flex justify-between text-sm text-gray-600 mb-1 min-w-0">
                  <span className="truncate flex-1 mr-2">Posts Used</span>
                  <span className="truncate flex-shrink-0">{usageStatus.usage.remaining} remaining</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1 overflow-hidden">
                  <div
                    className={`h-1 rounded-full ${
                      usageStatus.usage.remaining === 0 ? 'bg-red-500' :
                      usageStatus.usage.remaining <= 1 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ 
                      width: `${Math.min((usageStatus.usage.used / usageStatus.usage.limit) * 100, 100)}%`,
                      maxWidth: '100%'
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Subscription banner */}
          {!loading && me && (
            <div
              style={{
                margin: '12px auto',
                maxWidth: '1200px',
                padding: '12px 16px',
                borderRadius: 10,
                border: '1px solid',
                background: hasSubscription ? '#e8f5e9' : '#fff8e1',
                borderColor: hasSubscription ? '#c8e6c9' : '#ffe0b2',
                color: hasSubscription ? '#1b5e20' : '#8d6e63',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div>
                {sub === 'active' && (
                  <span>
                    ✅ Subscription active — <strong>{me.selectedPlan ?? '—'}</strong> ({me.billingCycle ?? '—'})
                  </span>
                )}
                {sub === 'trialing' && (
                  <span>
                    🎉 Trialing — <strong>{me.selectedPlan ?? '—'}</strong> ({me.billingCycle ?? '—'})
                    {Number.isFinite(me.trialDaysRemaining)
                      ? ` • ${me.trialDaysRemaining} day${me.trialDaysRemaining === 1 ? '' : 's'} left`
                      : ''}
                  </span>
                )}
                {sub === 'past_due' && <span>⚠️ Past due — please update your payment method.</span>}
                {(sub === 'none' || !me.subscriptionStatus) && <span>⚠️ No active subscription.</span>}
              </div>

              {(me.stripeCustomerId || me.hasActiveSubscription) && (
                <button
                  onClick={async () => {
                    try {
                      const token = await getToken();
                      const res = await fetch('/api/stripe/portal-session', {
                        method: 'POST',
                        credentials: 'include',
                        headers: {
                          'Content-Type': 'application/json',
                          Authorization: `Bearer ${token}`,
                        },
                      });
                      const text = await res.text();
                      const isJson = (res.headers.get('content-type') || '').includes('application/json');
                      const data = isJson ? JSON.parse(text) : text;
                      if (!res.ok) throw new Error(typeof data === 'string' ? data : data?.error || 'Failed to create billing portal session');
                      window.location.href = data.url;
                    } catch (err) {
                      console.error('Unable to open billing portal:', err);
                      setErrorModal({
                        show: true,
                        title: 'Unable to Open Billing Portal',
                        message: err.message || 'An unexpected error occurred while trying to access your billing information. Please try again later.',
                        type: 'error',
                        onConfirm: () => setErrorModal({ show: false, title: '', message: '', type: 'error', onConfirm: null, confirmText: 'OK', showCancel: false, cancelText: 'Cancel' }),
                        confirmText: 'OK',
                        showCancel: false,
                        cancelText: 'Cancel'
                      });
                    }
                  }}
                  style={{ background: '#0ea5e9', color: 'white', border: 0, borderRadius: 8, padding: '8px 12px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  Manage Billing
                </button>
              )}
            </div>
          )}

          {/* OAuth Connections */}
          <div className="mb-8 p-6 bg-white rounded-lg shadow text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Connect Your Social Media Accounts</h3>
            <p className="text-sm text-gray-600 mb-4">Connect your accounts to start publishing content across platforms.</p>
            <div className="flex flex-wrap gap-4 justify-center">
              <a href={`/api/auth/linkedin/oauth2/start/linkedin?userId=${user?.id}&amp;email=${user?.primaryEmailAddress?.emailAddress}`} className="inline-flex items-center justify-center w-12 h-12 bg-[#0A66C2] text-white rounded-lg hover:bg-[#004182] transition-colors" title="Connect LinkedIn">
                <Linkedin size={24} />
              </a>
              <a href={`/api/auth/twitter/oauth/start/twitter?userId=${user?.id}&amp;email=${user?.primaryEmailAddress?.emailAddress}`} className="inline-flex items-center justify-center w-12 h-12 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors" title="Connect Twitter">
                <Twitter size={24} />
              </a>
              <a href={`/api/auth/youtube/oauth2/start/google?userId=${user?.id}&amp;email=${user?.primaryEmailAddress?.emailAddress}`} className="inline-flex items-center justify-center w-12 h-12 bg-[#FF0000] text-white rounded-lg hover:bg-[#cc0000] transition-colors" title="Connect YouTube">
                <Youtube size={24} />
              </a>
              <a href={`/api/auth/facebook/oauth/start/facebook?userId=${user?.id}&amp;email=${user?.primaryEmailAddress?.emailAddress}`} className="inline-flex items-center justify-center w-12 h-12 bg-[#1877F2] text-white rounded-lg hover:bg-[#166FE5] transition-colors" title="Connect Facebook">
                <Facebook size={24} />
              </a>
              <a href={`/api/auth/instagram/oauth/start/instagram?userId=${user?.id}&amp;email=${user?.primaryEmailAddress?.emailAddress}`} className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-colors" title="Connect Instagram">
                <Instagram size={24} />
              </a>
              
              <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-400 text-white rounded-lg cursor-not-allowed opacity-50" title="TikTok - Coming Soon">
                <Music size={24} />
              </div>
            </div>
          </div>

          {/* Feature cards - Centered both horizontally and vertically */}
          <div className="flex justify-center items-center min-h-[400px]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
            {features.filter(feature => !feature.hidden).map((feature) => {
              const isAction = feature.action && !feature.link;
              const Component = isAction ? 'div' : Link;
              const props = isAction 
                ? { 
                    onClick: (e) => {
                      if (!hasSubscription) {
                        handleFeatureClick(e);
                        return;
                      }
                      feature.action();
                    },
                    className: `block p-8 rounded-2xl border shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer ${
                      feature.name === 'Start Creating' 
                        ? 'bg-white hover:border-blue-200 border-blue-100' 
                        : feature.name === 'Download Videos'
                          ? 'bg-white hover:border-blue-200 border-blue-100'
                          : hasSubscription 
                            ? 'bg-white hover:border-gray-300 border-gray-200' 
                            : 'bg-gray-100 cursor-not-allowed opacity-75 border-gray-200'
                    }`
                  }
                : {
                    to: feature.link,
                    onClick: (e) => handleFeatureClick(e),
                    className: `block p-8 rounded-2xl border shadow-sm hover:shadow-md transition-all duration-300 ${
                      feature.name === 'Start Creating' 
                        ? 'bg-white hover:border-blue-200 border-blue-100 cursor-pointer' 
                        : feature.name === 'Download Videos'
                          ? 'bg-white hover:border-blue-200 border-blue-100 cursor-pointer'
                          : hasSubscription 
                            ? 'bg-white hover:border-gray-300 border-gray-200 cursor-pointer' 
                            : 'bg-gray-100 cursor-not-allowed opacity-75 border-gray-200'
                    }`
                  };

              return (
                <Component key={feature.name} {...props}>
                  <div className="flex items-center">
                    <span className="text-4xl mr-4">{feature.icon}</span>
                    <div>
                      <h3 className={`text-lg font-semibold ${
                        feature.name === 'Start Creating' 
                          ? 'text-gray-900' 
                          : feature.name === 'Download Videos'
                            ? 'text-gray-900'
                            : 'text-gray-900'
                      }`}>
                        {feature.name}
                        {hasSubscription && <span className="ml-2 text-green-500">✅</span>}
                      </h3>
                      <p className={`text-sm mt-1 ${
                        feature.name === 'Start Creating' 
                          ? 'text-gray-600' 
                          : feature.name === 'Download Videos'
                            ? 'text-gray-600'
                            : 'text-gray-600'
                      }`}>{feature.description}</p>
                      {!hasSubscription && <p className="mt-2 text-sm text-red-500">⚠️ Subscription required</p>}
                    </div>
                  </div>
                </Component>
              );
            })}
            </div>
          </div>

          {/* Video Downloader Modal */}
          {showVideoDownloader && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center p-4 border-b">
                  <h3 className="text-lg font-semibold">Video Downloader</h3>
                  <button
                    onClick={() => setShowVideoDownloader(false)}
                    className="text-gray-500 hover:text-gray-700 text-xl"
                  >
                    ×
                  </button>
                </div>
                <div className="p-4">
                  <VideoDownloader />
                </div>
              </div>
            </div>
          )}

          {/* Account Settings */}
          <div className="mb-8 p-6 bg-white rounded-lg shadow">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 text-sm">This will clear your data from the app database</span>
              <button
                onClick={() => setErrorModal({
                  show: true,
                  title: 'Delete Account',
                  message: 'Are you sure you want to delete your account? This action cannot be undone and will remove all your data, including connected social media accounts and posts.',
                  type: 'warning',
                  onConfirm: handleDeleteAccount,
                  confirmText: 'Delete Account',
                  showCancel: true,
                  cancelText: 'Cancel'
                })}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Error Modal */}
      <ErrorModal
        isOpen={errorModal.show}
        onClose={() => setErrorModal({ show: false, title: '', message: '', type: 'error', onConfirm: null, confirmText: 'OK', showCancel: false, cancelText: 'Cancel' })}
        title={errorModal.title}
        message={errorModal.message}
        type={errorModal.type}
        onConfirm={errorModal.onConfirm}
        confirmText={errorModal.confirmText}
        showCancel={errorModal.showCancel}
        cancelText={errorModal.cancelText}
      />

      {/* Success Modal */}
      <ErrorModal
        isOpen={successModal.show}
        onClose={() => setSuccessModal({ show: false, title: '', message: '', type: 'success' })}
        title={successModal.title}
        message={successModal.message}
        type={successModal.type}
        onConfirm={() => setSuccessModal({ show: false, title: '', message: '', type: 'success' })}
        confirmText="OK"
        showCancel={false}
        cancelText="Cancel"
      />

    </div>
  );
};

export default Dashboard;