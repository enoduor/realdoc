import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PreviewEnhancements from './PreviewEnhancements';
import { useContent } from '../context/ContentContext';
import { useUser, useAuth } from '@clerk/clerk-react';
import ErrorModal from './ErrorModal';

const API_URL = process.env.REACT_APP_AI_API?.replace(/\/$/, '') || 'https://reelpostly.com/ai';

const SoraVideoGenerator = () => {
  const { updateContent, content } = useContent();
  const { user } = useUser();
  const { getToken } = useAuth();
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

  // Handle payment success
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const checkout = urlParams.get('checkout');
    const sessionId = urlParams.get('session_id');
    
    if (checkout === 'success' && sessionId) {
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
          }
        } catch (error) {
          console.error('Failed to refresh credits:', error);
        }
      }, 1000);
      
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [getToken]);

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

    // Check Sora video credits
    if (soraCredits < 1) {
      setCreditsErrorModal({
        show: true,
        title: 'Out of Credits',
        message: 'You\'re out of credits. Add credits to continue generating videos.',
        type: 'warning'
      });
      return;
    }

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
                <option value="sora-2">Sora-2 (Standard Quality)</option>
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
                <option value="4">4 seconds</option>
                <option value="8">8 seconds</option>
                {/* <option value="12">12 seconds</option> */}
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
                <option value="720x1280">Portrait (720x1280) - Instagram</option>
                <option value="1280x720">Landscape (1280x720) - YouTube</option>
              
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
                Be specific and describe what you want to see. Include the scene, mood, and style.
              </p>
              {/* Remix panel: visible when original video exists and generation is not in progress */}
              {(content.mediaUrl && content.mediaType === 'video' && !formData.generating && currentVideoId) && (
                <div className="mt-3 p-3 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-gray-900">Remix this video</span>
                    <span className="text-xs text-gray-500">Edit the description and re-generate from this result.</span>
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
                      disabled={remixBusy || !remixPrompt.trim() || soraCredits < 1}
                      className={`px-4 py-2 rounded-lg text-white font-medium transition-colors ${
                        (remixBusy || !remixPrompt.trim() || soraCredits < 1)
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                      aria-label="Start remix"
                    >
                      {remixBusy ? `Remixing… ${remixProgress}%` : 'Remix'}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    No need to wait for storage — remix starts immediately and appears here when ready.
                  </p>
                  {soraCredits < 1 && (
                    <button
                      onClick={() => setCreditsErrorModal({
                        show: true,
                        title: 'Out of Credits',
                        message: 'You\'re out of credits. Add credits to continue.',
                        type: 'warning'
                      })}
                      className="mt-1 text-xs text-red-600 hover:text-red-800 underline cursor-pointer"
                    >
                      You're out of credits. Add credits to continue.
                    </button>
                  )}
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

            {/* Preview & Publish Button - At bottom of left panel */}
            {content.mediaUrl && content.mediaType === 'video' && !formData.generating && (
              <div className="mt-8 flex justify-center">
                <Link
                  to="/app/sora/platform-preview"
                  className="px-8 py-3 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-medium text-center"
                >
                  Preview & Publish
                </Link>
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
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Video Enhancement</h3>
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
        onConfirm={() => {
          // Navigate to billing/pricing page
          window.location.href = '/app/billing';
        }}
      />
    </div>
  );
};

export default SoraVideoGenerator;
