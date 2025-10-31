import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PreviewEnhancements from './PreviewEnhancements';
import { useContent } from '../context/ContentContext';
import { useUser, useAuth } from '@clerk/clerk-react';
import { SignIn, SignUp } from '@clerk/clerk-react';
import ErrorModal from './ErrorModal';

const API_URL = process.env.REACT_APP_AI_API?.replace(/\/$/, '') || 'https://reelpostly.com/ai';

const SoraVideoGenerator = () => {
  const { updateContent, content } = useContent();
  const { user } = useUser();
  const { getToken, isSignedIn } = useAuth();
  const [formData, setFormData] = useState({
    prompt: '',
    model: 'sora-2',
    seconds: '8', // backend accepts int; we will send as provided
    size: '720x1280',
    generating: false,
    error: null,
    progress: null,
    progressMessage: ''
  });

  // Remix state
  const [currentVideoId, setCurrentVideoId] = useState(null);
  const [remixPrompt, setRemixPrompt] = useState('');
  const [remixBusy, setRemixBusy] = useState(false);
  const [remixProgress, setRemixProgress] = useState(0);

  // Credits error modal state
  const [creditsErrorModal, setCreditsErrorModal] = useState({
    show: false,
    title: '',
    message: '',
    type: 'warning'
  });
  const [subscriptionInfo, setSubscriptionInfo] = useState(null);
  const [soraCredits, setSoraCredits] = useState(0);
  
  // Auth modal state - show when credits are 0 and user clicks Download & Share
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('signin'); // 'signin' or 'signup'
  const [pendingNavigation, setPendingNavigation] = useState(false); // Track if user wants to go to platform preview

  // Move purchase flow here (Stripe checkout for Sora credits)
  const handleSoraVideoPurchase = async () => {
    // This function is only called when user is signed in (button only shows when isSignedIn is true)
    if (!isSignedIn) {
      console.error('User must be signed in to purchase credits');
      return;
    }

    try {
      const token = await getToken();
      if (!token) {
        console.error('Failed to get authentication token');
        alert('Authentication required. Please sign in again.');
        return;
      }

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

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to create checkout session:', errorData);
        alert('Failed to start checkout. Please try again.');
        return;
      }

      const { url } = await response.json();
      if (url) {
        // Persist generator state and pending navigation so it survives the Stripe redirect roundtrip
        try {
          sessionStorage.setItem('reelpostly.generatorContent', JSON.stringify(content || {}));
          if (currentVideoId) sessionStorage.setItem('reelpostly.currentVideoId', String(currentVideoId));
          if (pendingNavigation) sessionStorage.setItem('reelpostly.pendingNavigation', 'true');
        } catch (_) {}
        window.location.href = url;
      } else {
        console.error('No checkout URL returned from server');
        alert('Failed to start checkout. Please try again.');
      }
    } catch (error) {
      console.error('Payment error:', error);
      alert('An error occurred while processing your payment. Please try again.');
    }
  };

  // Fetch subscription information
  useEffect(() => {
    const fetchSubscriptionInfo = async () => {
      try {
        const response = await fetch('/api/auth/subscription-status', {
          headers: {
            'Authorization': `Bearer ${await getToken()}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setSubscriptionInfo(data);
          setSoraCredits(data.soraVideoCredits || 0);
        }
      } catch (error) {
        console.error('Failed to fetch subscription info:', error);
      }
    };

    if (user) {
      fetchSubscriptionInfo();
    }
  }, [user, getToken]);

  // Handle authentication success - close auth modal and refresh credits
  useEffect(() => {
    if (isSignedIn && showAuthModal) {
      // Close auth modal
      setShowAuthModal(false);
      // Refresh credits after authentication
      const fetchCredits = async () => {
        try {
          const token = await getToken();
          const response = await fetch('/api/auth/subscription-status', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (response.ok) {
            const data = await response.json();
            setSoraCredits(data.soraVideoCredits || 0);
            // If user had pending navigation and now has credits, navigate to platform preview
            if (pendingNavigation && data.soraVideoCredits > 0) {
              setPendingNavigation(false);
              window.location.href = '/app/sora/platform-preview';
            }
          }
        } catch (error) {
          console.error('Failed to refresh credits after auth:', error);
        }
      };
      fetchCredits();
    }
  }, [isSignedIn, showAuthModal, pendingNavigation, getToken]);

  // Handle payment success
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const checkout = urlParams.get('checkout');
    const sessionId = urlParams.get('session_id');
    
    if (checkout === 'success' && sessionId) {
      // Restore pending navigation from sessionStorage
      try {
        const pendingNav = sessionStorage.getItem('reelpostly.pendingNavigation');
        if (pendingNav === 'true') {
          setPendingNavigation(true);
          sessionStorage.removeItem('reelpostly.pendingNavigation');
        }
      } catch (_) {}
      
      // Show success message
      setFormData(prev => ({
        ...prev,
        progressMessage: 'Payment successful! Credits have been added to your account.'
      }));
      
      // Refresh credits
      setTimeout(async () => {
        try {
          const response = await fetch('/api/auth/subscription-status', {
            headers: {
              'Authorization': `Bearer ${await getToken()}`
            }
          });
          if (response.ok) {
            const data = await response.json();
            setSoraCredits(data.soraVideoCredits || 0);
            // Notify other components (like SoraVideosDashboard) that credits were updated
            window.dispatchEvent(new CustomEvent('reelpostly:credits-updated', { detail: { credits: data.soraVideoCredits || 0 } }));
            
            // If user had pending navigation and now has credits, navigate to platform preview
            // Check sessionStorage since state might not be updated yet
            const hasPendingNav = sessionStorage.getItem('reelpostly.pendingNavigation') === 'true';
            if (hasPendingNav && data.soraVideoCredits > 0) {
              setPendingNavigation(false);
              sessionStorage.removeItem('reelpostly.pendingNavigation');
              window.location.href = '/app/sora/platform-preview';
            }
          }
        } catch (error) {
          console.error('Failed to refresh credits:', error);
        }
      }, 1000);

      // Restore generator state if it was stashed pre-checkout
      try {
        if (!content?.mediaUrl) {
          const cached = sessionStorage.getItem('reelpostly.generatorContent');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && (parsed.mediaUrl || parsed.mediaFile)) {
              updateContent(parsed);
            }
          }
        }
        const cachedId = sessionStorage.getItem('reelpostly.currentVideoId');
        if (cachedId) setCurrentVideoId(cachedId);
        // Clear cache after restore
        sessionStorage.removeItem('reelpostly.generatorContent');
        sessionStorage.removeItem('reelpostly.currentVideoId');
      } catch (_) {}
      
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [getToken]);

  // On first mount, if we have a stashed state and no current content, restore (covers cancel flow or manual back)
  useEffect(() => {
    try {
      if (!content?.mediaUrl) {
        const cached = sessionStorage.getItem('reelpostly.generatorContent');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && (parsed.mediaUrl || parsed.mediaFile)) {
            updateContent(parsed);
          }
        }
      }
      const cachedId = sessionStorage.getItem('reelpostly.currentVideoId');
      if (cachedId && !currentVideoId) setCurrentVideoId(cachedId);
      
      // Restore pending navigation if it exists
      const pendingNav = sessionStorage.getItem('reelpostly.pendingNavigation');
      if (pendingNav === 'true') {
        setPendingNavigation(true);
      }
    } catch (_) {}
  }, [content, currentVideoId, updateContent]);

  // Check if user can proceed after auth (has credits and pending navigation)
  useEffect(() => {
    if (isSignedIn && pendingNavigation && soraCredits > 0 && content?.mediaUrl) {
      // User is signed in, has credits, and wants to navigate to platform preview
      setPendingNavigation(false);
      sessionStorage.removeItem('reelpostly.pendingNavigation');
      window.location.href = '/app/sora/platform-preview';
    }
  }, [isSignedIn, pendingNavigation, soraCredits, content?.mediaUrl]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Helper to build payload with optional fields
  const buildPayload = () => {
    return {
      prompt: formData.prompt,
      model: formData.model,
      seconds: formData.seconds,
      size: formData.size
    };
  };

  const handleEnhancedDownload = async () => {
    // This would handle downloading the enhanced version with watermark, text, and filters
    // For now, we'll use the existing media URL
    if (content.mediaUrl) {
      const link = document.createElement('a');
      link.href = content.mediaUrl;
      link.download = `enhanced_${Date.now()}.${content.mediaType === 'video' ? 'mp4' : 'jpg'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleGenerate = async () => {
    if (!formData.prompt.trim()) {
      setFormData(prev => ({
        ...prev,
        error: 'Please enter a video prompt'
      }));
      return;
    }

    // Note: Do not block generation based on credits here. Backend will enforce limits
    // and we handle any 402/insufficient-credit responses below.

    let pollInterval = null;

    try {
      setFormData(prev => ({
        ...prev,
        generating: true,
        error: null,
        progress: 0,
        progressMessage: 'Starting video generation...'
      }));

      // Step 1: Create video (returns immediately with video_id)
      const createResponse = await fetch(`${API_URL}/api/v1/video/generate-video-simple`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(buildPayload())
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json().catch(() => ({}));
        
        if (createResponse.status === 402) {
          throw new Error('⚠️ Insufficient API credits. Please add credits to your OpenAI account to generate videos.');
        }
        
        throw new Error(errorData.detail || `HTTP error! status: ${createResponse.status}`);
      }

      const createData = await createResponse.json();
      console.log('[Sora-2] Video creation started:', createData);

      if (!createData.success || !createData.video_id) {
        throw new Error('Failed to start video generation');
      }

      const videoId = createData.video_id;
      setCurrentVideoId(videoId);
      setRemixPrompt(prev => formData.prompt || '');
      
      setFormData(prev => ({
        ...prev,
        progress: 10,
        progressMessage: 'Video queued for generation...'
      }));

      // Step 2: Poll for completion
      let consecutiveErrors = 0;
      const MAX_ERRORS = 3;
      
      const pollStatus = async () => {
        try {
          const statusResponse = await fetch(`${API_URL}/api/v1/video/check-video-status/${videoId}`);
          
          if (!statusResponse.ok) {
            consecutiveErrors++;
            console.warn(`[Sora-2] Status check failed (${consecutiveErrors}/${MAX_ERRORS}): ${statusResponse.status}`);
            
            if (consecutiveErrors >= MAX_ERRORS) {
              throw new Error(`Status check failed after ${MAX_ERRORS} attempts: ${statusResponse.status}`);
            }
            return; // Continue polling
          }

          const statusData = await statusResponse.json();
          console.log('[Sora-2] Status update:', statusData);
          
          // Reset error counter on successful response
          consecutiveErrors = 0;

          // Update progress (ensure we have a valid number)
          const progress = Math.max(0, Math.min(100, statusData.progress || 0));
          const status = (statusData.status || 'processing').toLowerCase();
          
          // Status-to-message mapping
          let message = 'Generating video...';
          if (status === 'queued') message = 'Queued for generation...';
          else if (status === 'processing') message = 'Generating video with AI...';
          else if (status === 'downloading') message = 'Downloading result...';
          else if (status === 'uploading') message = 'Uploading to storage...';
          else if (status === 'completed' || status === 'success') message = 'Video ready!';
          else {
            if (progress < 25) message = 'Queued for generation...';
            else if (progress < 50) message = 'Generating video with AI...';
            else if (progress < 75) message = 'Processing video...';
            else if (progress < 100) message = 'Almost done...';
            else message = 'Sora-2 has blcoked this prompt...';
          }

          setFormData(prev => ({
            ...prev,
            progress: Math.max(10, progress), // Keep at least 10% to show activity
            progressMessage: message
          }));

          // Check if completed
          if ((status === 'completed' || status === 'success') && statusData.url) {
            // Stop polling
            if (pollInterval) clearInterval(pollInterval);

            setFormData(prev => ({
              ...prev,
              progress: 100,
              progressMessage: 'Video ready!'
            }));

            // Update content context with the generated video
            updateContent({
              mediaUrl: statusData.url,
              mediaType: 'video',
              mediaFile: null,
              mediaFilename: statusData.filename,
              mediaDimensions: null
            });

            // Deduct 1 credit from database after successful video generation
            try {
              const token = await getToken();
              const deductResponse = await fetch('/api/auth/deduct-sora-credits', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ creditsToDeduct: 1 })
              });

              if (deductResponse.ok) {
                const deductData = await deductResponse.json();
                setSoraCredits(deductData.remainingCredits);
                console.log(`✅ Credits deducted. Remaining: ${deductData.remainingCredits}`);
              } else {
                console.error('Failed to deduct credits:', await deductResponse.text());
              }
            } catch (deductError) {
              console.error('Error deducting credits:', deductError);
            }

            // Reset form after a short delay
            setTimeout(() => {
              setFormData(prev => ({
                ...prev,
                generating: false,
                progress: null,
                progressMessage: '',
                prompt: ''
              }));
            }, 2000);
          } else if (status === 'failed' || status === 'canceled' || (statusData.error && statusData.success === false)) {
            // Stop polling only on confirmed failure
            if (pollInterval) clearInterval(pollInterval);
            
            // Show user-friendly error message
            const errorMsg = statusData.error || 'Video generation failed. Your prompt may have been blocked by content moderation.';
            throw new Error(errorMsg);
          }
          // Otherwise keep polling (status is queued or processing)
          
        } catch (pollError) {
          console.error('[Sora-2] Polling error:', pollError);
          if (pollInterval) clearInterval(pollInterval);
          throw pollError;
        }
      };

      // Start polling every 3 seconds
      pollInterval = setInterval(pollStatus, 3000);
      
      // Do first poll immediately
      await pollStatus();

    } catch (err) {
      console.error('Video generation error:', err);
      let errorMessage = 'Video generation failed';

      if (err.message) {
        errorMessage = err.message;
      }

      // Prefix credit errors clearly
      if (/credits/i.test(errorMessage)) {
        errorMessage = '⚠️ ' + errorMessage;
      }

      setFormData(prev => ({
        ...prev,
        error: errorMessage,
        generating: false,
        progress: null,
        progressMessage: ''
      }));
      
      if (pollInterval) clearInterval(pollInterval);
    }
  };

  // === Remix helpers START ===
  const remixVideo = async (videoId, prompt) => {
 
    const resp = await fetch(`${API_URL}/api/v1/video/remix-video/${videoId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    if (!resp.ok) throw new Error(await resp.text());
    const data = await resp.json();
    return data.id || data.video_id || (data.raw && data.raw.id);
  };

  const pollRemixStatus = async (newId) => {
    while (true) {
      const r = await fetch(`${API_URL}/api/v1/video/check-video-status/${newId}`);
      if (!r.ok) throw new Error(await r.text());
      const s = await r.json();
      const p = typeof s.progress === 'number' ? s.progress : 0;
      setRemixProgress(p);
      if (s.status === 'completed' || s.status === 'success') return s;
      if (['failed', 'canceled', 'error'].includes((s.status || '').toLowerCase())) {
        throw new Error(s.error || 'Remix failed');
      }
      await new Promise(res => setTimeout(res, 2500));
    }
  };

  const startRemix = async () => {
    if (!currentVideoId || !remixPrompt.trim() || remixBusy) return;
    try {
      setRemixBusy(true);
      setRemixProgress(0);
      // 1) Start remix
      const newId = await remixVideo(currentVideoId, remixPrompt.trim());
      // 2) Poll status
      const result = await pollRemixStatus(newId);

      // 3) Update global content with the remixed video
      if (result && result.url) {
        updateContent({
          mediaUrl: result.url,
          mediaType: 'video',
          mediaFile: null,
          mediaFilename: result.filename,
          mediaDimensions: null
        });
      }

      // 4) Deduct 1 credit for the remix (same as initial generation)
      try {
        const token = await getToken();
        const deductResponse = await fetch('/api/auth/deduct-sora-credits', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ creditsToDeduct: 1 })
        });
        if (deductResponse.ok) {
          const deductData = await deductResponse.json();
          setSoraCredits(deductData.remainingCredits);
          console.log(`✅ Credits deducted (remix). Remaining: ${deductData.remainingCredits}`);
        } else {
          console.error('Failed to deduct credits (remix):', await deductResponse.text());
        }
      } catch (deductError) {
        console.error('Error deducting credits (remix):', deductError);
      }
    } catch (err) {
      console.error('Remix error:', err);
      alert('Remix error: ' + (err.message || String(err)));
    } finally {
      setRemixBusy(false);
    }
  };
  // === Remix helpers END ===

  // When an enhanced asset is ready, persist it so the Preview & Publish step uses it
  const handleEnhancedAsset = (asset) => {
    if (!asset?.url || !asset?.key) return;
    // Update global content context so downstream pages read the enhanced asset
    updateContent({
      mediaUrl: asset.url,
      mediaType: 'video',
      mediaFile: null,
      mediaFilename: asset.key,
      mediaKey: asset.key,
      enhanced: true,
    });
    // Store video data in localStorage through content context (no need for sessionStorage)
  };

  // Pick up enhanced asset from in-app event
  useEffect(() => {
    const handler = (e) => {
      const asset = e?.detail;
      if (asset?.url && asset?.key) handleEnhancedAsset(asset);
    };
    window.addEventListener('reelpostly:enhanced-video-ready', handler);
    return () => window.removeEventListener('reelpostly:enhanced-video-ready', handler);
  }, []);

  // Restore enhanced video data when component mounts
  useEffect(() => {
    // First check sessionStorage for enhanced video (from PreviewEnhancements)
    const sessionAsset = sessionStorage.getItem('reelpostly.publishAsset');
    if (sessionAsset) {
      try {
        const asset = JSON.parse(sessionAsset);
        if (asset?.url && asset?.key) {
          // Enhanced video exists in sessionStorage, restore it
          updateContent({
            mediaUrl: asset.url,
            mediaType: 'video',
            mediaFile: null,
            mediaFilename: asset.key,
            mediaKey: asset.key,
            enhanced: true
          });
          return;
        }
      } catch (error) {
        console.error('Error parsing sessionStorage asset:', error);
      }
    }

    // Fallback: Check localStorage for enhanced video
    const savedContent = localStorage.getItem('repostly-content');
    if (savedContent) {
      try {
        const parsedContent = JSON.parse(savedContent);
        if (parsedContent.mediaUrl && parsedContent.mediaType === 'video' && parsedContent.enhanced) {
          updateContent({
            mediaUrl: parsedContent.mediaUrl,
            mediaType: parsedContent.mediaType,
            mediaFile: null,
            mediaFilename: parsedContent.mediaFilename,
            mediaKey: parsedContent.mediaKey,
            enhanced: parsedContent.enhanced
          });
        }
      } catch (error) {
        console.error('Error parsing saved enhanced video content:', error);
      }
    }
  }, []); // Run only once when component mounts

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-xl font-bold">Create Video</h1>
          <Link
            to="/app/sora"
            className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-md"
          >
            Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left Column - Controls */}
          <div className="lg:col-span-2 bg-white shadow rounded-lg p-6">
            <form onSubmit={(e) => { e.preventDefault(); handleGenerate(); }} className="space-y-4">
            {/* Model Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Video Quality
              </label>
              <select
                name="model"
                value={formData.model}
                onChange={handleInputChange}
                className="w-full p-3 border rounded-lg"
                disabled={formData.generating}
              >
                {/* <option value="sora-2-pro">Sora-2 Pro (Highest Quality)</option> */}
                <option value="sora-2">Sora-2 </option>
              </select>
            </div>

            {/* Duration Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Video Duration
              </label>
              <select
                name="seconds"
                value={formData.seconds}
                onChange={handleInputChange}
                className="w-full p-3 border rounded-lg"
                disabled={formData.generating}
              >
                <option value="4">4 secs</option>
                <option value="8">8 secs</option>
                <option value="12">12 secs</option>
              </select>
            </div>

            {/* Size/Orientation Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Video Orientation
              </label>
              <select
                name="size"
                value={formData.size}
                onChange={handleInputChange}
                className="w-full p-3 border rounded-lg"
                disabled={formData.generating}
              >
                <option value="720x1280">Portrait - Instagram</option>
                <option value="1280x720">Landscape - YouTube</option>
              
              </select>
            </div>

            {/* Video Prompt */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Video Description
              </label>
              <textarea
                name="prompt"
                value={formData.prompt}
                onChange={handleInputChange}
                placeholder="Describe your video (e.g., 'Waves gently washing over smooth rocks on a misty morning beach, filmed in 4K slow motion')"
                className="w-full p-3 border rounded-lg resize-none"
                rows="4"
                disabled={formData.generating}
              />
              <p className="mt-1 text-xs text-gray-500">
                Describe the scene, mood, and style you would llke.
              </p>
              {/* Remix panel: visible when original video exists and generation is not in progress */}
              {(content.mediaUrl && content.mediaType === 'video' && !formData.generating && currentVideoId) && (
                <div className="mt-3 p-3 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-gray-900">Remix Video</span>
                    <span className="text-xs text-gray-500">Edit description and re-generate result.</span>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={remixPrompt}
                      onChange={(e) => setRemixPrompt(e.target.value)}
                      placeholder="Describe your change… e.g., switch to night with neon lights"
                      className="flex-1 p-2 border rounded-lg"
                      aria-label="Remix prompt"
                    />
                    <button
                      type="button"
                      onClick={startRemix}
                      disabled={remixBusy || !remixPrompt.trim()}
                      className={`px-4 py-2 rounded-lg text-white font-medium transition-colors ${
                        (remixBusy || !remixPrompt.trim())
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                      aria-label="Start remix"
                    >
                      {remixBusy ? `Remixing… ${remixProgress}%` : 'Remix'}
                    </button>
                  </div>
                  {/* <p className="mt-1 text-xs text-gray-500">
                    No need to wait for storage — remix starts immediately and appears here when ready.
                  </p> */}
                  {/* Removed inline credits modal; credits prompt only appears on Preview & Publish click */}
                </div>
              )}
            </div>


            {/* Error Display */}
            {formData.error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{formData.error}</p>
              </div>
            )}

            {/* Progress Display */}
            {formData.generating && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="mb-2">
                  <p className="text-sm font-medium text-blue-900">{formData.progressMessage}</p>
                </div>
                {formData.progress !== null && (
                  <div className="w-full bg-blue-200 rounded-full h-2.5">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${formData.progress}%` }}
                    ></div>
                  </div>
                )}
                <p className="text-xs text-blue-700 mt-2">
                  This may take 1-2 minutes. Please wait...
                </p>
              </div>
            )}

            {/* Generate Button */}
            <button
              type="submit"
              disabled={formData.generating || !formData.prompt.trim()}
              className={`w-full px-4 py-2 rounded-lg text-white font-medium transition-colors
                ${formData.generating || !formData.prompt.trim()
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'}`}
            >
              {formData.generating ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating Video...
                </span>
              ) : (
                '🎬 Generate Video'
              )}
            </button>
            </form>

            {/* Preview & Publish + (moved) Purchase Button */}
            {content.mediaUrl && content.mediaType === 'video' && !formData.generating && (
              <div className="mt-8 flex items-center justify-center gap-3">
                <Link
                  to="/app/sora/platform-preview"
                  onClick={(e) => {
                    if (soraCredits < 1) {
                      e.preventDefault();
                      // If not signed in, show auth modal
                      if (!isSignedIn) {
                        setPendingNavigation(true);
                        // Persist to sessionStorage in case of redirect
                        try {
                          sessionStorage.setItem('reelpostly.pendingNavigation', 'true');
                        } catch (_) {}
                        setShowAuthModal(true);
                        setAuthMode('signin');
                      } else {
                        // If signed in but no credits, show error modal with purchase option
                        setCreditsErrorModal({
                          show: true,
                          title: 'Out of Credits',
                          message: 'You\'re out of credits. Add credits to continue.',
                          type: 'warning'
                        });
                      }
                    }
                  }}
                  className="px-8 py-3 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-medium text-center"
                  >Download & Share
                </Link>
                {soraCredits < 1 && isSignedIn && (
                  <button
                    onClick={handleSoraVideoPurchase}
                    className="px-4 py-3 bg-amber-500 text-white hover:bg-amber-600 rounded-lg font-medium text-center text-sm"
                    title="Purchase credits to generate more videos"
                  >
                    Purchase Credits
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right Column - Video Enhancement Controls */}
          <div className="lg:col-span-3 bg-white shadow rounded-lg p-6">
            {content.mediaUrl && content.mediaType === 'video' && !formData.generating ? (
              <PreviewEnhancements
                mediaUrl={content.mediaUrl}
                mediaType={content.mediaType}
                videoSize={formData.size}
                onDownload={handleEnhancedDownload}
                onClose={() => {
                  updateContent({ mediaUrl: null, mediaType: null, mediaFile: null });
                }}
                onAssetChange={handleEnhancedAsset}
              />
            ) : (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Generated Video</h3>
                <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <div className="text-center">
                    <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m0 0V3a1 1 0 011 1v6.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 011.414-1.414L15 10.586V4z" />
                    </svg>
                    <p className="mt-2 text-sm text-gray-500">Generate a video to enhance</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

      </main>

      {/* Credits Error Modal */}
      <ErrorModal
        isOpen={creditsErrorModal.show}
        onClose={() => setCreditsErrorModal({ show: false, title: '', message: '', type: 'warning' })}
        title={creditsErrorModal.title}
        message={creditsErrorModal.message}
        type={creditsErrorModal.type}
        confirmText="Add Credits"
        onConfirm={async () => {
          setCreditsErrorModal({ show: false, title: '', message: '', type: 'warning' });
          await handleSoraVideoPurchase();
        }}
      />

      {/* Auth Modal - Show when user clicks Download & Share with 0 credits and not signed in */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 relative">
            <button
              onClick={() => {
                setShowAuthModal(false);
                setPendingNavigation(false);
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
            <h2 className="text-2xl font-bold mb-4 text-center">
              {authMode === 'signin' ? 'Sign In' : 'Sign Up'}
            </h2>
            <p className="text-sm text-gray-600 mb-6 text-center">
              {authMode === 'signin' 
                ? 'Sign in to purchase credits and download your video'
                : 'Create an account to purchase credits and download your video'}
            </p>
            
            <div className="mb-4">
              {authMode === 'signin' ? (
                <SignIn 
                  redirectUrl="/app/sora/video-generator"
                  afterSignInUrl="/app/sora/video-generator"
                  appearance={{
                    elements: {
                      formButtonPrimary: 'bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md w-full',
                      card: 'bg-transparent shadow-none',
                      headerTitle: 'text-xl font-bold text-gray-900',
                      headerSubtitle: 'text-gray-600',
                      socialButtonsBlockButton: 'bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium py-2 px-4 rounded-md w-full mb-2',
                    }
                  }}
                />
              ) : (
                <SignUp 
                  redirectUrl="/app/sora/video-generator"
                  afterSignUpUrl="/app/sora/video-generator"
                  appearance={{
                    elements: {
                      formButtonPrimary: 'bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md w-full',
                      card: 'bg-transparent shadow-none',
                      headerTitle: 'text-xl font-bold text-gray-900',
                      headerSubtitle: 'text-gray-600',
                      socialButtonsBlockButton: 'bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium py-2 px-4 rounded-md w-full mb-2',
                    }
                  }}
                />
              )}
            </div>
            
            <div className="text-center mt-4">
              <button
                onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}
                className="text-blue-600 hover:text-blue-500 text-sm"
              >
                {authMode === 'signin' 
                  ? "Don't have an account? Sign up" 
                  : 'Already have an account? Sign in'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SoraVideoGenerator;
