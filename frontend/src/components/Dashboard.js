import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser, useSession, useAuth } from '@clerk/clerk-react';
import { 
  Linkedin, 
  Twitter, 
  Instagram, 
  Youtube, 
  Music,
  Facebook
} from 'lucide-react';
import ClerkUserProfile from './Auth/ClerkUserProfile';
import { 
  createOrLinkClerkUser, 
  getUserUsageStatus, 
  getCheckoutSession 
} from '../api';

/**
 * Small helper to fetch JSON with credentials and friendlier errors
 * Supports Authorization header and defaults to /api paths.
 */
async function getJSON(url, token) {
  const isAbsolute = /^https?:/i.test(url);
  const fullUrl = isAbsolute ? url : (url.startsWith('/api') ? url : `/api${url.startsWith('/') ? '' : '/'}${url}`);
  const res = await fetch(fullUrl, {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j?.error) msg += `: ${j.error}`;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

const Dashboard = () => {
  const [hasSubscription, setHasSubscription] = useState(null); // null = loading, true/false afterwards
  const [usageStatus, setUsageStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [welcomeMsg, setWelcomeMsg] = useState('');
  const [checking, setChecking] = useState(false);
  const [me, setMe] = useState(null); // full /auth/me snapshot for banner/detail
  const navigate = useNavigate();
  const { user } = useUser();
  const { session } = useSession();
  const { getToken, isSignedIn } = useAuth();

  /**
   * Load /auth/me (fresh DB-backed snapshot)
   * Decides hasSubscription based on subscriptionStatus from DB synced by webhook.
   * Uses Clerk token for Authorization.
   */
  const loadMe = useCallback(async () => {
    const token = await getToken().catch(() => undefined);
    const data = await getJSON('/auth/me', token); // becomes /api/auth/me via helper
    setMe(data);
    const status = (data?.subscriptionStatus || 'none').toLowerCase();
    setHasSubscription(status === 'active' || status === 'trialing');
    return data;
  }, [getToken]);

  /**
   * 1) Handle successful checkout session banner + light polling while webhook writes.
   * If a user lands on /app?session_id=..., show a friendly message using
   * GET /api/billing/checkout-session and then poll /auth/me until we see the update.
   */
  useEffect(() => {
    const url = new URL(window.location.href);
    const sessionId = url.searchParams.get('session_id');
    if (!sessionId) return;

    const shownKey = `welcome_for_${sessionId}`;
    if (sessionStorage.getItem(shownKey)) {
      // Clean URL to drop the param if user refreshes
      url.searchParams.delete('session_id');
      window.history.replaceState({}, '', url.toString());
      return;
    }

    setChecking(true);
    getCheckoutSession(sessionId)
      .then((data) => {
        if (data.subscriptionStatus === 'trialing') {
          setWelcomeMsg(`🎉 Welcome to the ${data.plan} plan! Your trial is active.`);
        } else if (data.subscriptionStatus === 'active') {
          setWelcomeMsg(`✅ Subscription active: ${data.plan} (${data.billingCycle}).`);
        } else {
          setWelcomeMsg('⏳ Processing your subscription… this may take a moment.');
        }
        // Mark as shown & clean URL
        sessionStorage.setItem(shownKey, '1');
        url.searchParams.delete('session_id');
        window.history.replaceState({}, '', url.toString());
      })
      .catch(() => {
        setWelcomeMsg("⚠️ We couldn't confirm your subscription yet. Please refresh in a minute.");
      })
      .finally(() => setChecking(false));
  }, []);

  /**
   * 2) Bootstrap: link Clerk user → DB (idempotent) then fetch /auth/me,
   * and if subscribed, also fetch usage.
   */
  useEffect(() => {
    const boot = async () => {
      if (!isSignedIn || !user) {
        setLoading(false);
        return;
      }
      try {
        // Ensure DB user exists / is linked (no-op if already exists)
        await createOrLinkClerkUser().catch(() => {});
        // Pull latest DB state
        const snapshot = await loadMe();

        // Load usage if subscribed
        const status = (snapshot?.subscriptionStatus || 'none').toLowerCase();
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
      } catch (e) {
        console.error('Error during dashboard bootstrap:', e);
        setHasSubscription(false);
      } finally {
        setLoading(false);
      }
    };
    boot();
  }, [user, isSignedIn, loadMe]);

  /**
   * 3) Refresh /auth/me whenever the tab regains focus (keeps UI in sync after webhooks)
   */
  useEffect(() => {
    const onFocus = async () => {
      try {
        const snapshot = await loadMe();
        const status = (snapshot?.subscriptionStatus || 'none').toLowerCase();
        if (status === 'active' || status === 'trialing') {
          const usage = await getUserUsageStatus().catch(() => null);
          if (usage) setUsageStatus(usage);
        }
      } catch (e) {
        // ignore transient errors
      }
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadMe]);

  /**
   * 4) Gentle polling for 20s after mount if we are not yet subscribed
   *    (helps bridge the short delay between checkout redirect and webhook write)
   */
  useEffect(() => {
    let tries = 0;
    const maxTries = 10; // 10 * 2s = ~20s
    let timer = null;

    const tick = async () => {
      try {
        const snapshot = await loadMe();
        const status = (snapshot?.subscriptionStatus || 'none').toLowerCase();
        if (status === 'active' || status === 'trialing') {
          clearInterval(timer);
          // load usage once we're subscribed
          const usage = await getUserUsageStatus().catch(() => null);
          if (usage) setUsageStatus(usage);
          return;
        }
      } catch {}
      tries += 1;
      if (tries >= maxTries && timer) clearInterval(timer);
    };

    // Start polling only if we don't yet have a subscription
    if (hasSubscription === false || hasSubscription === null) {
      timer = setInterval(tick, 2000);
    }
    return () => timer && clearInterval(timer);
  }, [hasSubscription, loadMe]);

  /**
   * Click-guard for gated features:
   * - If hasSubscription === false -> block and redirect to pricing
   * - If null (loading) or true -> allow
   */
  const handleFeatureClick = (e, feature) => {
    if (hasSubscription === false) {
      e.preventDefault();
      alert('You must subscribe to use this feature. Redirecting to pricing...');
      navigate('/pricing');
    }
  };

  const features = [
    { name: 'Generate Captions', description: 'Create engaging AI-powered captions for your social media posts', icon: '✍️', link: '/app/caption-generator' },
    { name: 'Generate Hashtags', description: 'Generate relevant hashtags to increase your content reach', icon: '#️⃣', link: '/app/hashtag-generator' },
    { name: 'Upload Media', description: 'Upload and manage your media content', icon: '📸', link: '/app/media-upload' },
    { name: 'Edit & Publish', description: 'Preview and publish your content to different platforms', icon: '🚀', link: '/app/platform-preview' },
    { name: 'Publish Now', description: 'Publish posts immediately across multiple platforms', icon: '🚀', link: '/app/scheduler' }
  ];

  // Render
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Welcome message from checkout-session */}
      {welcomeMsg && (
        <div style={{
          margin: '12px auto',
          maxWidth: '1200px',
          padding: '12px 16px',
          borderRadius: 10,
          background: '#e8f5e9',
          border: '1px solid #c8e6c9',
          textAlign: 'center'
        }}>
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
          <h2 className="text-2xl font-bold mb-8">Welcome to Reelpostly</h2>

          {/* Daily Usage Status (only when subscribed) */}
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
                  />
                </div>
              </div>
            </div>
          )}

           {/* Realtime subscription banner from /auth/me */}
{!loading && me && (
  <div
    style={{
      margin: '12px auto',
      maxWidth: '1200px',
      padding: '12px 16px',
      borderRadius: 10,
      textAlign: 'center',
      border: '1px solid',
      background:
        (me.subscriptionStatus === 'active' || me.subscriptionStatus === 'trialing')
          ? '#e8f5e9'
          : '#fff8e1',
      borderColor:
        (me.subscriptionStatus === 'active' || me.subscriptionStatus === 'trialing')
          ? '#c8e6c9'
          : '#ffe0b2',
      color:
        (me.subscriptionStatus === 'active' || me.subscriptionStatus === 'trialing')
          ? '#1b5e20'
          : '#8d6e63',
    }}
  >
    {me.subscriptionStatus === 'active' && (
      <span>
        ✅ Subscription active — <strong>{me.selectedPlan ?? '—'}</strong> ({me.billingCycle ?? '—'})
      </span>
    )}

    {me.subscriptionStatus === 'trialing' && (
      <span>
        🎉 Trialing — <strong>{me.selectedPlan ?? '—'}</strong> ({me.billingCycle ?? '—'})
        {Number.isFinite(me.trialDaysRemaining)
          ? ` • ${me.trialDaysRemaining} day${me.trialDaysRemaining === 1 ? '' : 's'} left`
          : ''}
      </span>
    )}

    {me.subscriptionStatus === 'past_due' && (
      <span>⚠️ Past due — please update your payment method.</span>
    )}

    {(me.subscriptionStatus === 'none' || !me.subscriptionStatus) && (
      <span>⚠️ No active subscription.</span>
    )}
  </div>
)}

          {/* OAuth Connection Buttons */}
          <div className="mb-8 p-6 bg-white rounded-lg shadow text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Connect Your Social Media Accounts</h3>
            <p className="text-sm text-gray-600 mb-4">Connect your accounts to start publishing content across platforms.</p>
            <div className="flex flex-wrap gap-4 justify-center">
              <a
                href={`/api/auth/linkedin/oauth2/start/linkedin?userId=${user?.id}&amp;email=${user?.primaryEmailAddress?.emailAddress}`}
                className="inline-flex items-center justify-center w-12 h-12 bg-[#0A66C2] text-white rounded-lg hover:bg-[#004182] transition-colors"
                title="Connect LinkedIn"
              >
                <Linkedin size={24} />
              </a>
              <a
                href={`/api/auth/twitter/oauth/start/twitter?userId=${user?.id}&amp;email=${user?.primaryEmailAddress?.emailAddress}`}
                className="inline-flex items-center justify-center w-12 h-12 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                title="Connect Twitter"
              >
                <Twitter size={24} />
              </a>
              <a
                href={`/api/auth/facebook/oauth/start/facebook?userId=${user?.id}&amp;email=${user?.primaryEmailAddress?.emailAddress}`}
                className="inline-flex items-center justify-center w-12 h-12 bg-[#1877F2] text-white rounded-lg hover:bg-[#0d5dbf] transition-colors"
                title="Connect Facebook"
              >
                <Facebook size={24} />
              </a>
              <a
                href={`/api/auth/instagram/oauth/start/instagram?userId=${user?.id}&amp;email=${user?.primaryEmailAddress?.emailAddress}`}
                className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-colors"
                title="Connect Instagram"
              >
                <Instagram size={24} />
              </a>
              <a
                href={`/api/auth/youtube/oauth2/start/google?userId=${user?.id}&amp;email=${user?.primaryEmailAddress?.emailAddress}`}
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