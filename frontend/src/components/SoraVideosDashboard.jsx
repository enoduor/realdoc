import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser, useSession, useAuth } from '@clerk/clerk-react';
import { Linkedin, Twitter, Instagram, Youtube, Music, Facebook } from 'lucide-react';
import ClerkUserProfile from './Auth/ClerkUserProfile';
import ErrorModal from './ErrorModal';
import VideoDownloader from './VideoDownloader';
import { useAuthContext } from '../context/AuthContext';

const SoraVideosDashboard = () => {
  const navigate = useNavigate();
  const { isSignedIn, getToken } = useAuth();
  const { user } = useUser();

  // 🔌 from AuthContext (DB-backed)
  const { me, loading, refresh } = useAuthContext();

  // Set sora dashboard preference when user visits
  useEffect(() => {
    localStorage.setItem('preferredDashboard', 'sora');
  }, []);

  // local UI state
  const [usageStatus, setUsageStatus] = useState(null);
  const [welcomeMsg, setWelcomeMsg] = useState('');
  const [checking, setChecking] = useState(false);
  const [showVideoDownloader, setShowVideoDownloader] = useState(false);
  const [soraCredits, setSoraCredits] = useState(0);
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


  // Handle URL parameters for success/error messages
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const connected = urlParams.get('connected');
    const error = urlParams.get('error');

    if (connected) {
      const platformNames = {
        'linkedin': 'LinkedIn',
        // 'twitter': 'Twitter', 
        'youtube': 'YouTube',
        // 'tiktok': 'TikTok',
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
        // 'twitter_auth_failed': 'Twitter connection failed. Please try again.',
        'youtube_auth_failed': 'YouTube connection failed. Please try again.',
        // 'tiktok_auth_failed': 'TikTok connection failed. Please try again.',
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

  // Fetch Sora video credits balance
  const fetchSoraCredits = useCallback(async () => {
    if (!isSignedIn) return;
    
    try {
      const token = await getToken();
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setSoraCredits(data.soraVideoCredits || 0);
      }
    } catch (error) {
      console.error('Error fetching Sora credits:', error);
    }
  }, [isSignedIn, getToken]);

  // Fetch credits when component mounts
  useEffect(() => {
    if (isSignedIn) {
      fetchSoraCredits();
    }
  }, [isSignedIn, fetchSoraCredits]);

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

    // Clean URL and refresh without showing welcome message
    sessionStorage.setItem(shownKey, '1');
    url.searchParams.delete('session_id');
    window.history.replaceState({}, '', url.toString());
    
    // 📥 pull latest DB state after Stripe redirect
    refresh();
  }, [refresh]);

  // 2) Bootstrap: once signed-in, ensure we have fresh /auth/me
  useEffect(() => {
    const boot = async () => {
      if (!isSignedIn || !user) return;
      await refresh(); // pulls /auth/me into context
    };
    // run after first render + whenever `isSignedIn` changes
    boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, user]);

  // 3) Refresh /auth/me on tab focus (stay in sync with webhooks)
  useEffect(() => {
    const onFocus = async () => {
      try {
        await refresh();
      } catch {}
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  // 4) Gentle polling for ~20s if we don't yet see the sub (bridges webhook delay)
  useEffect(() => {
    let tries = 0;
    const maxTries = 10;
    let timer = null;

    const tick = async () => {
      try {
        await refresh();
        return;
      } catch {}
      tries += 1;
      if (tries >= maxTries && timer) clearInterval(timer);
    };

    timer = setInterval(tick, 2000);
    return () => timer && clearInterval(timer);
  }, [refresh]);


  // Handle Sora video credit purchase
    const handleSoraVideoPurchase = async () => {
        try {
            const token = await getToken();
            const response = await fetch('/api/stripe/create-checkout-session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    priceId: 'price_1SIyQSLPiEjYBNcQyq9gryxu'
                })
            });

            const { url } = await response.json();
            window.location.href = url;
        } catch (error) {
            console.error('Payment error:', error);
        }
    };

  // Sora-specific features
  const features = [
    { name: 'Generate Your Video', description: 'Create and share stunning AI-generated videos in seconds', icon: '🎬', link: '/app/sora/video-generator', price: '$20', credits: '8 Credits' },
    { name: 'Upload Media', description: 'Upload images and videos for your social media content', icon: '📤', link: '/app/sora/upload-media', hidden: true },
    { name: 'Edit & Publish', description: 'Edit and publish content across social media platforms', icon: '✏️', link: '/app/sora/platform-preview', hidden: true },
    { name: 'Publish Now', description: 'Publish content immediately with scheduling options', icon: '🚀', link: '/app/sora/scheduler', hidden: true }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
 
      {welcomeMsg && (
        <div style={{ margin: '12px auto', maxWidth: '1200px', padding: '12px 16px', borderRadius: 10, background: '#e8f5e9', border: '1px solid #c8e6c9', textAlign: 'center' }}>
          {welcomeMsg}
        </div>
      )}

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Watermark Free Sora Videos</h1>
            <p className="text-gray-600">Create, manage and personalize your AI-generated videos</p>
          </div>
          
          {/* User Profile and Sign Out */}
          <div className="flex justify-end mb-6">
            <ClerkUserProfile />
          </div>
      

            <div
              style={{
                margin: '12px auto',
                maxWidth: '1200px',
                padding: '12px 16px',
                borderRadius: 10,
                border: '1px solid',
                background: '#fff8e1',
                borderColor: '#ffe0b2',
                color: '#8d6e63',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div>
                {false && (
                  <span>
                    ✅ <strong style={{ textTransform: 'capitalize' }}>{me.selectedPlan ?? '—'}</strong> Plan ({me.billingCycle ?? '—'})
                  </span>
                )}
                {false && <span>⚠️ Payment issue — please update your payment method.</span>}
                {false && <span>⚠️ No active subscription.</span>}
              </div>

              {false && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  {/* Show "Activate Now" button only during trial */}
                  {false && (
                    <button
                      onClick={async () => {
                        // Show confirmation dialog
                        setErrorModal({
                          show: true,
                          title: 'Activate Subscription Now?',
                          message: 'This will end your trial immediately and charge your card. You will get full access to your plan limits right away. Continue?',
                          type: 'warning',
                          onConfirm: async () => {
                            setErrorModal({ show: false, title: '', message: '', type: 'error', onConfirm: null, confirmText: 'OK', showCancel: false, cancelText: 'Cancel' });
                            try {
                              const token = await getToken();
                              const res = await fetch('/api/stripe/activate-subscription', {
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
                              if (!res.ok) throw new Error(typeof data === 'string' ? data : data?.error || 'Failed to activate subscription');
                              
                              // Show success message
                              setSuccessModal({
                                show: true,
                                title: 'Subscription Activated!',
                                message: data.message || 'Your subscription is now active. Refreshing...',
                                type: 'success'
                              });
                              
                              // Refresh user data to show new status
                              setTimeout(async () => {
                                await refresh();
                                setSuccessModal({ show: false, title: '', message: '', type: 'success' });
                              }, 2000);
                            } catch (err) {
                              console.error('Unable to activate subscription:', err);
                              setErrorModal({
                                show: true,
                                title: 'Activation Failed',
                                message: err.message || 'Failed to activate subscription. Please try again or contact support.',
                                type: 'error',
                                onConfirm: () => setErrorModal({ show: false, title: '', message: '', type: 'error', onConfirm: null, confirmText: 'OK', showCancel: false, cancelText: 'Cancel' }),
                                confirmText: 'OK',
                                showCancel: false,
                                cancelText: 'Cancel'
                              });
                            }
                          },
                          confirmText: 'Activate & Pay Now',
                          showCancel: true,
                          cancelText: 'Cancel'
                        });
                      }}
                      style={{ background: '#10b981', color: 'white', border: 0, borderRadius: 8, padding: '8px 12px', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: '600' }}
                    >
                      Activate Now
                    </button>
                  )}
                  
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
                </div>
              )}
            </div>
          

        

            {/* Info Banner */}
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-semibold text-blue-900">🎬 Download or Share Your Videos Videos</h3>
              <div className="bg-green-100 px-3 py-1 rounded-lg">
                <span className="text-sm font-medium text-green-700">{soraCredits} Credits</span>
              </div>
            </div>
            <p className="text-sm text-blue-800">
              
            Once you your ideas come to life. You can download or share your videos in one click.
            </p>
          </div>
      

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 mb-8">
            {/* Left Panel - Connect to Share Your Videos */}
            <div className="lg:col-span-2 bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium mb-4">Share Videos</h3>
              <div className="space-y-4">
                <a href={`/api/auth/linkedin/oauth2/start/linkedin?userId=${user?.id}&amp;email=${user?.primaryEmailAddress?.emailAddress}`} className="flex items-center p-3 border rounded-lg hover:bg-gray-50 transition-colors" title="Connect LinkedIn">
                  <Linkedin size={24} className="mr-3 text-[#0A66C2]" />
                  <span className="text-sm">LinkedIn</span>
                </a>
                <a href={`/api/auth/youtube/oauth2/start/google?userId=${user?.id}&amp;email=${user?.primaryEmailAddress?.emailAddress}`} className="flex items-center p-3 border rounded-lg hover:bg-gray-50 transition-colors" title="Connect YouTube">
                  <Youtube size={24} className="mr-3 text-[#FF0000]" />
                  <span className="text-sm">YouTube</span>
                </a>
                <a href={`/api/auth/facebook/oauth/start/facebook?userId=${user?.id}&amp;email=${user?.primaryEmailAddress?.emailAddress}`} className="flex items-center p-3 border rounded-lg hover:bg-gray-50 transition-colors" title="Connect Facebook">
                  <Facebook size={24} className="mr-3 text-[#1877F2]" />
                  <span className="text-sm">Facebook</span>
                </a>
                <a href={`/api/auth/instagram/oauth/start/instagram?userId=${user?.id}&amp;email=${user?.primaryEmailAddress?.emailAddress}`} className="flex items-center p-3 border rounded-lg hover:bg-gray-50 transition-colors" title="Connect Instagram">
                  <Instagram size={24} className="mr-3 text-purple-500" />
                  <span className="text-sm">Instagram</span>
                </a>
              </div>
            </div>

            {/* Right Panel - Features */}
            <div className="lg:col-span-3 bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium mb-4">Download Videos</h3>
              <div className="space-y-4">
                {features.filter(feature => !feature.hidden).map((feature) => {
                  const isAction = feature.action && !feature.link;
                  // For Generate AI Videos, disable the entire component when no credits
                  const shouldDisableGenerateAI = (feature.name === 'Generate AI Videos' || feature.name === 'Generate Your Video') && soraCredits === 0;
                  const Component = isAction ? 'div' : (shouldDisableGenerateAI ? 'div' : Link);
                  const props = isAction 
                    ? { 
                        onClick: (e) => {
                          if (shouldDisableGenerateAI) {
                            e.preventDefault();
                            return;
                          }
                          feature.action();
                        },
                        className: `block p-4 rounded-lg border shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer ${
                          feature.name === 'Generate Captions' 
                            ? 'bg-white hover:border-blue-200 border-blue-100' 
                            : feature.name === 'Download Videos'
                              ? 'bg-white hover:border-blue-200 border-blue-100'
                              : feature.name === 'Generate AI Videos'
                                ? shouldDisableGenerateAI
                                  ? 'text-[#1976d2] border-[#2196f3] cursor-not-allowed opacity-75'
                                  : 'text-[#1976d2] hover:border-[#2196f3] border-[#2196f3]'
                                : 'bg-white hover:border-gray-300 border-gray-200'
                        }`
                      }
                    : {
                        ...(shouldDisableGenerateAI ? {} : { to: feature.link }),
                        onClick: (e) => {
                          if (shouldDisableGenerateAI) {
                            e.preventDefault();
                            return;
                          }
                        },
                        className: `block p-4 rounded-lg border shadow-sm hover:shadow-md transition-all duration-300 ${
                          feature.name === 'Generate Captions' 
                            ? 'bg-white hover:border-blue-200 border-blue-100 cursor-pointer' 
                            : feature.name === 'Download Videos'
                              ? 'bg-white hover:border-blue-200 border-blue-100 cursor-pointer'
                              : feature.name === 'Generate AI Videos' || feature.name === 'Generate Your Video'
                                ? shouldDisableGenerateAI
                                  ? 'text-[#1976d2] border-[#2196f3] cursor-not-allowed opacity-75 bg-blue-50'
                                  : 'text-[#1976d2] hover:border-[#2196f3] border-[#2196f3] cursor-pointer bg-blue-50'
                                : 'bg-white hover:border-gray-300 border-gray-200 cursor-pointer'
                        }`
                      };

                  return (
                    <Component 
                      key={feature.name} 
                      {...props}
                    >
                      <div className="flex items-center">
                        <span className="text-2xl mr-3">{feature.icon}</span>
                        <div className="flex-1">
                          <h4 className={`text-sm font-semibold ${
                            feature.name === 'Generate Captions' 
                              ? 'text-gray-900' 
                              : feature.name === 'Download Videos'
                                ? 'text-gray-900'
                                : feature.name === 'Generate AI Videos'
                                  ? 'text-[#1976d2]'
                                  : 'text-gray-900'
                          }`}>
                            {feature.name}
                          </h4>
                          <p className={`text-xs mt-1 ${
                            feature.name === 'Generate Captions' 
                              ? 'text-gray-600' 
                              : feature.name === 'Download Videos'
                                ? 'text-gray-600'
                                : feature.name === 'Generate AI Videos'
                                  ? 'text-[#424242]'
                                  : 'text-gray-600'
                          }`}>{feature.description}</p>
                          
                          {(feature.name === 'Generate AI Videos' || feature.name === 'Generate Your Video') && soraCredits === 0 && (
                            <div className="mt-2 flex items-center justify-between">
                              <div>
                                <span className="text-sm font-bold text-green-600">{feature.price}</span>
                                <span className="ml-1 text-xs text-gray-600">{feature.credits}</span>
                              </div>
                              <button
                                onClick={handleSoraVideoPurchase}
                                className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                              >
                                Purchase
                              </button>
                            </div>
                          )}
                          
                        </div>
                      </div>
                    </Component>
                  );
                })}
              </div>
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

export default SoraVideosDashboard;
