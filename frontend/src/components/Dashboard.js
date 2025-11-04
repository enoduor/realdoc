import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
// import { useUser, useSession, useAuth } from '@clerk/clerk-react';

import ClerkUserProfile from './Auth/ClerkUserProfile';
import ErrorModal from './ErrorModal';
import { useAuthContext } from '../context/AuthContext';

// API functions moved inline
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:4001";

const getAuthHeaders = async () => {
  let token = null;
  try {
    if (window.Clerk && window.Clerk.session) {
      token = await window.Clerk.session.getToken();
    }
  } catch (error) {
    console.error('Error getting Clerk token:', error);
  }
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
};

const getUserUsageStatus = async () => {
  try {
    const response = await fetch(`${API_URL}/api/publisher/usage/status`, {
      method: 'GET',
      headers: await getAuthHeaders()
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error getting usage status:', error);
    throw error;
  }
};

const getCheckoutSession = async (sessionId) => {
  const res = await fetch(`${API_URL}/api/stripe/subscription-by-session/${sessionId}`);
  const text = await res.text();
  const isJson = (res.headers.get("content-type") || "").includes("application/json");
  const data = isJson ? JSON.parse(text) : text;
  if (!res.ok) {
    throw new Error(typeof data === "string" ? data : data?.error || "Failed to fetch checkout session");
  }
  return data;
};

const Dashboard = () => {
  const navigate = useNavigate();
  // COMMENTED OUT: Clerk authentication
  // const { isSignedIn, getToken } = useAuth();
  // const { user } = useUser();
  const isSignedIn = false;
  const getToken = async () => null;
  const user = null;

  // 🔌 from AuthContext (DB-backed)
  const { me, loading, refresh } = useAuthContext();

  // Dashboard component - no localStorage needed

  // local UI state
  const [usageStatus, setUsageStatus] = useState(null);
  const [welcomeMsg, setWelcomeMsg] = useState('');
  const [checking, setChecking] = useState(false);

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

    // Clean URL and refresh without showing welcome message
    sessionStorage.setItem(shownKey, '1');
    url.searchParams.delete('session_id');
    window.history.replaceState({}, '', url.toString());
    
    // 📥 pull latest DB state after Stripe redirect
    refresh();
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
    { name: 'Documentation Generator', description: 'Generate comprehensive documentation for your online applications', icon: '📚', link: '/app/documentation-generator' }
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
          
          {/* User Profile and Sign Out */}
          <div className="flex justify-end mb-6">
            <ClerkUserProfile />
          </div>
      
          {/* Daily Usage */}
          {hasSubscription && usageStatus && (
            <div className="mb-6 bg-white rounded-lg shadow p-6 overflow-hidden">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Documentation Generated Today</h3>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-blue-600">
                    {usageStatus.usage.used}/{usageStatus.usage.limit}
                  </div>
                  {usageStatus.usage.remaining === 0 && (
                    <p className="text-xs text-red-500 mt-1">
                      Resets in {Math.ceil((new Date(usageStatus.usage.resetAt) - new Date()) / (1000 * 60 * 60))} hours
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-4">
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
                    ✅ <strong style={{ textTransform: 'capitalize' }}>{me.selectedPlan ?? '—'}</strong> Plan ({me.billingCycle ?? '—'})
                  </span>
                )}
                {sub === 'trialing' && (
                  <span>
                    🎉 <strong style={{ textTransform: 'capitalize' }}>{me.selectedPlan ?? '—'}</strong> Trial
                    {Number.isFinite(me.trialDaysRemaining)
                      ? ` • ${me.trialDaysRemaining} day${me.trialDaysRemaining === 1 ? '' : 's'} left`
                      : ''}
                  </span>
                )}
                {sub === 'past_due' && <span>⚠️ Payment issue — please update your payment method.</span>}
                {(sub === 'none' || !me.subscriptionStatus) && <span>⚠️ No active subscription.</span>}
              </div>

              {(me.stripeCustomerId || me.hasActiveSubscription) && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  {/* Show "Activate Now" button only during trial */}
                  {sub === 'trialing' && (
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
          )}

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
                      hasSubscription 
                        ? 'bg-white hover:border-blue-200 border-blue-100' 
                        : 'bg-gray-100 cursor-not-allowed opacity-75 border-gray-200'
                    }`
                  }
                : {
                    to: feature.link,
                    onClick: (e) => handleFeatureClick(e),
                    className: `block p-8 rounded-2xl border shadow-sm hover:shadow-md transition-all duration-300 ${
                      hasSubscription 
                        ? 'bg-white hover:border-blue-200 border-blue-100 cursor-pointer' 
                        : 'bg-gray-100 cursor-not-allowed opacity-75 border-gray-200'
                    }`
                  };

              return (
                <Component key={feature.name} {...props}>
                  <div className="flex items-center">
                    <span className="text-4xl mr-4">{feature.icon}</span>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {feature.name}
                        {hasSubscription && <span className="ml-2 text-green-500">✅</span>}
                      </h3>
                      <p className="text-sm mt-1 text-gray-600">{feature.description}</p>
                      {!hasSubscription && <p className="mt-2 text-sm text-red-500">⚠️ Subscription required</p>}
                    </div>
                  </div>
                </Component>
              );
            })}
            </div>
          </div>



          {/* Account Settings */}
          <div className="mb-8 p-6 bg-white rounded-lg shadow">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 text-sm">This will clear your data from the app database</span>
              <button
                onClick={() => setErrorModal({
                  show: true,
                  title: 'Delete Account',
                  message: 'Are you sure you want to delete your account? This action cannot be undone and will remove all your data, including generated documentation.',
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
        onConfirm={successModal.onConfirm || (() => setSuccessModal({ show: false, title: '', message: '', type: 'success' }))}
        confirmText={successModal.confirmText || "OK"}
        showCancel={false}
        cancelText="Cancel"
      />

    </div>
  );
};

export default Dashboard;