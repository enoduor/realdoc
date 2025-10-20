import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PreviewEnhancements from './PreviewEnhancements';
import { useContent } from '../context/ContentContext';
import { useUser, useAuth } from '@clerk/clerk-react';

const API_URL = process.env.REACT_APP_AI_API?.replace(/\/$/, '') || 'https://reelpostly.com/ai';

const VideoGenerator = () => {
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
      setFormData(prev => ({
        ...prev,
        error: 'Insufficient credits. Please purchase more credits to generate videos.'
      }));
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
            else message = 'Finalizing...';
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-xl font-bold">AI Video Generator (Sora-2)</h1>
          <Link
            to="/app/sora"
            className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-md"
          >
            Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg p-6">
          {/* Info Banner */}
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-semibold text-blue-900">🎬 AI Video Generation</h3>
              <div className="bg-green-100 px-3 py-1 rounded-lg">
                <span className="text-sm font-medium text-green-700">{soraCredits} Credits</span>
              </div>
            </div>
            <p className="text-sm text-blue-800">
              Generate professional videos using Sora-2 AI. Describe what you want to see, 
              and AI will create a unique video. Generation takes 1-2 minutes. Each video costs 1 credit.
            </p>
          </div>

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
                <option value="sora-2-pro">Sora-2 Pro (Highest Quality)</option>
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
                <option value="12">12 seconds</option>
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
                <option value="720x1280">Portrait (720x1280) - Instagram/TikTok</option>
                <option value="1280x720">Landscape (1280x720) - YouTube/Twitter</option>
                <option value="1024x1792">Tall Portrait (1024x1792)</option>
                <option value="1792x1024">Wide Landscape (1792x1024)</option>
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
                placeholder="Describe your video (e.g., 'A golden retriever catching a frisbee in slow motion on a sunny beach')"
                className="w-full p-3 border rounded-lg resize-none"
                rows="4"
                disabled={formData.generating}
              />
              <p className="mt-1 text-xs text-gray-500">
                Be specific and describe what you want to see. Include the scene, mood, and style.
              </p>
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

          {/* Video Enhancement Controls with Preview */}
          {content.mediaUrl && content.mediaType === 'video' && !formData.generating && (
            <div className="mt-6">
              <PreviewEnhancements
                mediaUrl={content.mediaUrl}
                mediaType={content.mediaType}
                onDownload={handleEnhancedDownload}
                onClose={() => {
                  updateContent({ mediaUrl: null, mediaType: null, mediaFile: null });
                }}
              />
            </div>
          )}

          {/* Navigation Buttons */}
          {content.mediaUrl && content.mediaType === 'video' && !formData.generating && (
            <div className="mt-6 flex justify-between gap-4">
              <Link
                to="/app/sora/platform-preview"
                className="flex-1 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-medium text-center"
              >
                Preview & Publish
              </Link>
              {/* <Link
                to="/app/sora/scheduler"
                className="flex-1 px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg font-medium text-center"
              >
                Go to Publish
              </Link> */}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default VideoGenerator;

