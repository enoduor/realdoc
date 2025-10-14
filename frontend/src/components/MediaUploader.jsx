import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { PLATFORMS } from '../constants/platforms';
import { useContent } from '../context/ContentContext';
import { useUser, useAuth } from '@clerk/clerk-react';
// Subscription check removed - users are already verified at dashboard level

const API_URL = process.env.REACT_APP_AI_API?.replace(/\/$/, '') || 'https://reelpostly.com/ai';

const MediaUploader = () => {
  const { updateContent, content } = useContent();
  const { user } = useUser();
  const { getToken } = useAuth();
  const [formData, setFormData] = useState({
    platform: content?.platform || 'instagram',
    files: null,
    uploading: false,
    error: null,
    preview: null
  });
  const [subscriptionInfo, setSubscriptionInfo] = useState(null);

  const platformLimits = PLATFORMS[formData.platform.toUpperCase()];

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
          console.log('[MediaUploader] Subscription info fetched:', data);
          console.log('[MediaUploader] Selected plan:', data?.selectedPlan);
          setSubscriptionInfo(data);
        } else {
          console.error('[MediaUploader] Subscription fetch failed:', response.status);
        }
      } catch (error) {
        console.error('Failed to fetch subscription info:', error);
      }
    };

    if (user) {
      fetchSubscriptionInfo();
    }
  }, [user, getToken]);

  useEffect(() => {
    if (content?.platform !== formData.platform) {
      setFormData(prev => ({
        ...prev,
        platform: content?.platform || 'instagram'
      }));
    }
  }, [content?.platform, formData.platform]);

  // Detect downloaded videos and auto-populate form data
  useEffect(() => {
    if (content?.mediaFile && content?.mediaType === 'video' && !formData.files) {
      console.log('🎬 MediaUploader: Detected downloaded video, auto-populating form data');
      
      // Create a FileList-like object from the downloaded video
      const videoFile = content.mediaFile;
      const fileList = {
        0: videoFile,
        length: 1,
        item: (index) => index === 0 ? videoFile : null,
        [Symbol.iterator]: function* () {
          yield videoFile;
        }
      };
      
      // Auto-populate form data with downloaded video
      setFormData(prev => ({
        ...prev,
        files: fileList,
        preview: content.mediaUrl,
        error: null
      }));
      
      console.log('🎬 MediaUploader: Auto-populated with downloaded video:', {
        filename: content.mediaFilename,
        mediaType: content.mediaType,
        mediaUrl: content.mediaUrl
      });
    }
  }, [content?.mediaFile, content?.mediaType, content?.mediaUrl, content?.mediaFilename, formData.files]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (name === 'platform') {
      updateContent({ platform: value });
    }
  };

  useEffect(() => {
    // Check if server is running
    const checkServer = async () => {
      try {
        const res = await axios.get(`${API_URL}/ping`);
        // Clear any previous errors
        setFormData(prev => ({
          ...prev,
          error: null
        }));
      } catch (err) {
        console.error('Server check failed:', err.message);
        // Don't set error on initial load, let user try upload
      }
    };

    checkServer();
  }, []);

  const validateFile = (file) => {
    const fileType = (file.type || '').split('/')[0];
    const fileExtension = (file.name || '').split('.').pop().toLowerCase();

    // Check if platformLimits exists
    if (!platformLimits || !platformLimits.supportedMedia) {
      throw new Error('Platform configuration not found');
    }

    // Check if file type is supported by the platform
    const isSupportedType = platformLimits.supportedMedia.some(type => {
      if (type === 'image') return fileType === 'image' || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension);
      if (type === 'video') return fileType === 'video' || ['mp4', 'mov', 'avi', 'webm'].includes(fileExtension);
      if (type === 'carousel') return fileType === 'image';
      if (type === 'gif') return fileExtension === 'gif';
      if (type === 'document') return ['pdf', 'doc', 'docx'].includes(fileExtension);
      return false;
    });

    if (!isSupportedType) {
      throw new Error(`Unsupported file type for ${formData.platform}. Supported: ${platformLimits.supportedMedia.join(', ')}`);
    }

    // Check file size based on platform and subscription
    let maxSize = 100 * 1024 * 1024; // Default 100MB
    
    // Debug logging
    console.log('[MediaUploader] File validation:', {
      fileSize: file.size,
      fileSizeMB: Math.floor(file.size / (1024 * 1024)),
      subscriptionInfo,
      selectedPlan: subscriptionInfo?.selectedPlan,
      platform: formData.platform
    });
    
    // Apply subscription-based limits
    if (subscriptionInfo?.selectedPlan === 'starter') {
      maxSize = 3 * 1024 * 1024; // 3MB for Starter plan
      console.log('[MediaUploader] Applying Starter plan limit: 3MB');
    } else if (subscriptionInfo?.selectedPlan === 'creator') {
      maxSize = 50 * 1024 * 1024; // 50MB for Creator plan
      console.log('[MediaUploader] Applying Creator plan limit: 50MB');
    } else {
      // Enterprise or other plans - use platform-specific limits
      if (formData.platform === 'instagram') maxSize = 100 * 1024 * 1024;
      if (formData.platform === 'twitter') maxSize = 100 * 1024 * 1024;
      if (formData.platform === 'facebook') maxSize = 100 * 1024 * 1024;
      if (formData.platform === 'linkedin') maxSize = 100 * 1024 * 1024;
      if (formData.platform === 'youtube') maxSize = 100 * 1024 * 1024;
      if (formData.platform === 'tiktok') maxSize = 72 * 1024 * 1024;
      console.log('[MediaUploader] Applying platform limit:', Math.floor(maxSize / (1024 * 1024)) + 'MB');
    }

    console.log('[MediaUploader] Final maxSize:', Math.floor(maxSize / (1024 * 1024)) + 'MB');

    if (file.size > maxSize) {
      const planName = subscriptionInfo?.selectedPlan || 'starter';
      throw new Error(`File too large for ${formData.platform} on ${planName} plan. Maximum size is ${Math.floor(maxSize / (1024 * 1024))}MB`);
    }
  };

  const handleFileChange = (e) => {
    const selectedFiles = e.target.files;
    try {
      if (selectedFiles.length > 0) {
        validateFile(selectedFiles[0]);
        setFormData(prev => ({
          ...prev,
          files: selectedFiles,
          error: null
        }));

        const file = selectedFiles[0];
        const fileType = (file.type || '').split('/')[0];
        const fileExtension = (file.name || '').split('.').pop().toLowerCase();

        // Determine media type based on file extension and MIME type
        let mediaType = fileType;
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension)) mediaType = 'image';
        if (['mp4', 'mov', 'avi', 'webm'].includes(fileExtension)) mediaType = 'video';

        // Create preview URL
        const previewUrl = URL.createObjectURL(file);
        setFormData(prev => ({
          ...prev,
          preview: previewUrl
        }));

        // Update content with preview URL immediately
        updateContent({
          mediaUrl: previewUrl,
          mediaType: mediaType,
          mediaFile: file,
          mediaDimensions: null // Will be set after upload
        });
      }
    } catch (err) {
      setFormData(prev => ({
        ...prev,
        error: err.message,
        files: null,
        preview: null
      }));
      updateContent({
        mediaUrl: null,
        mediaType: null,
        mediaFile: null,
        mediaDimensions: null
      });
    }
  };

  const handleUpload = async () => {
    // Media upload is available to all authenticated users

    if (!formData.files || formData.files.length === 0) {
      setFormData(prev => ({
        ...prev,
        error: 'Please select files to upload'
      }));
      return;
    }

    try {
      setFormData(prev => ({
        ...prev,
        uploading: true
      }));
      const file = formData.files[0];

      const uploadFormData = new FormData();
      // Always pass a filename for robustness
      uploadFormData.append('file', file, file.name || 'upload');
      if (formData.platform) {
        uploadFormData.append('platform', formData.platform);
      }
      // Include subscription plan for backend validation
      if (subscriptionInfo?.selectedPlan) {
        uploadFormData.append('subscription_plan', subscriptionInfo.selectedPlan);
      }

      const res = await axios.post(`${API_URL}/api/v1/upload`, uploadFormData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        timeout: 30000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });


      if (res.data && res.data.url) {
        // Update content based on media type
        const updatedContent = {
          mediaUrl: res.data.url,
          mediaType: res.data.type || content.mediaType,
          mediaDimensions: res.data.dimensions || null,
          mediaFile: null,
          mediaFilename: res.data.filename // Store filename for URL refresh
        };

        // Update content with S3 URL IMMEDIATELY to prevent race condition
        updateContent(updatedContent);

        // Then verify URL accessibility and update dimensions asynchronously
        if (updatedContent.mediaType === 'image') {
          const img = new Image();
          img.onload = () => {
            // Update dimensions only (URL already set above)
            updateContent({
              mediaDimensions: {
                width: img.naturalWidth,
                height: img.naturalHeight
              }
            });
          };
          img.onerror = () => {
            console.error('Image URL not accessible:', res.data.url);
            setFormData(prev => ({
              ...prev,
              error: 'Image URL not accessible - Please try uploading again'
            }));
          };
          img.src = res.data.url;
        } else if (updatedContent.mediaType === 'video') {
          const video = document.createElement('video');
          video.onloadedmetadata = () => {
            // Update dimensions only (URL already set above)
            updateContent({
              mediaDimensions: {
                width: video.videoWidth,
                height: video.videoHeight
              }
            });
          };
          video.onerror = () => {
            console.error('Video URL not accessible:', res.data.url);
            setFormData(prev => ({
              ...prev,
              error: 'Video URL not accessible - Please try uploading again'
            }));
          };
          video.src = res.data.url;
        }
      } else {
        throw new Error('Invalid server response - missing URL');
      }
    } catch (err) {
      console.error('Upload error:', err);
      let errorMessage = 'Upload failed';

      if (err.code === 'NETWORK_ERROR' || (err.message || '').includes('Network Error')) {
        errorMessage = 'Network error - Please check your connection and try again';
      } else if (err.response?.status === 413) {
        errorMessage = 'File too large - Please try a smaller file';
      } else if (err.response?.status === 415) {
        errorMessage = 'Unsupported file type - Please use images or videos';
      } else if (err.response?.data?.detail) {
        errorMessage = err.response.data.detail;
      } else if (err.message) {
        errorMessage = err.message;
      }

      console.error('Detailed error:', errorMessage);
      setFormData(prev => ({
        ...prev,
        error: errorMessage
      }));
    } finally {
      setFormData(prev => ({
        ...prev,
        uploading: false
      }));
    }
  };

  // Clean up preview URLs when component unmounts
  useEffect(() => {
    return () => {
      if (formData.preview) {
        URL.revokeObjectURL(formData.preview);
      }
    };
  }, [formData.preview]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-xl font-bold">Media Upload</h1>
          <Link
            to="/app"
            className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-md"
          >
            Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Subscription check removed - users are already verified at dashboard level */}

        <div className="bg-white shadow rounded-lg p-6">
          <form onSubmit={(e) => { e.preventDefault(); handleUpload(); }} className="space-y-4">
            {/* Platform Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Platform
              </label>
              <select
                name="platform"
                value={formData.platform}
                onChange={handleInputChange}
                className="w-full p-3 border rounded-lg"
              >
                {Object.values(PLATFORMS).map((platform) => (
                  <option key={platform.id} value={platform.id}>
                    {platform.icon} {platform.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Platform Requirements */}
            <div className="mb-6 bg-gray-50 p-4 rounded-lg">
              <h2 className="text-lg font-medium mb-3">{content?.platform || 'instagram'} Requirements</h2>
              <ul className="text-sm text-gray-600">
                <li>Supported Types: {platformLimits.supportedMedia.join(', ')}</li>
                <li>Image Size: {platformLimits.recommendedImageSize}</li>
                <li>Video Length: {platformLimits.recommendedVideoLength}</li>
                <li className="font-semibold text-blue-600">
                  Max File Size: {
                    subscriptionInfo?.selectedPlan === 'starter' ? '3 MB (Starter Plan)' :
                    subscriptionInfo?.selectedPlan === 'creator' ? '50 MB (Creator Plan)' :
                    formData.platform === 'tiktok' ? '72 MB (Full Access)' :
                    '100 MB (Full Access)'
                  }
                </li>
              </ul>
              {subscriptionInfo?.selectedPlan === 'starter' && (
                <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="text-xs text-yellow-800">
                    💡 Upgrade to Creator plan for 50 MB uploads, or Enterprise for full platform limits
                  </p>
                </div>
              )}
            </div>

            {/* Upload Area */}
            <div className="p-4 border rounded-lg shadow-sm">
              <div className="mb-4">
                <input
                  type="file"
                  id="fileInput"
                  accept={platformLimits.supportedMedia.map(type => {
                    if (type === 'image') return 'image/*';
                    if (type === 'video') return 'video/*';
                    if (type === 'gif') return '.gif';
                    if (type === 'document') return '.pdf,.doc,.docx';
                    return '';
                  }).filter(Boolean).join(',')}
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="fileInput"
                  className="cursor-pointer inline-block px-6 py-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  Choose File
                </label>
                {formData.files && formData.files[0] && (
                  <span className="ml-3 text-sm text-gray-600">
                    Selected: {formData.files[0].name}
                  </span>
                )}
              </div>

              {formData.error && (
                <div className="mb-4 text-red-500 text-sm">
                  {formData.error}
                </div>
              )}

              <button
                type="submit"
                disabled={formData.uploading || !formData.files}
                className={`px-4 py-2 rounded-md text-white
                  ${formData.uploading || !formData.files
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {formData.uploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </form>


          {/* Preview Area */}
          {(formData.preview || content.mediaUrl) && (
            console.log('🎬 MediaUploader Preview - content:', {
              mediaUrl: content.mediaUrl,
              mediaType: content.mediaType,
              mediaFilename: content.mediaFilename,
              formDataPreview: formData.preview
            }),
            <div className="mt-6">
              <h3 className="text-lg font-medium mb-2">
                Preview:
                {content.mediaFilename && content.mediaFilename.includes('downloaded-video') && (
                  <span className="ml-2 text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                    📥 Downloaded Video
                  </span>
                )}
              </h3>
              <div className="relative">
                {content.mediaType === 'image' && (
                  <div className="relative">
                    <img
                      src={content.mediaUrl || formData.preview}
                      alt="Upload preview"
                      className={`rounded-lg shadow mx-auto object-cover ${
                        content?.platform === 'instagram' ? 'aspect-square max-h-[500px]' :
                        content?.platform === 'facebook' ? 'aspect-[1200/630] max-h-[500px]' :
                        content?.platform === 'linkedin' ? 'aspect-[1200/627] max-h-[500px]' :
                        content?.platform === 'twitter' ? 'aspect-[16/9] max-h-[500px]' :
                        content?.platform === 'tiktok' ? 'aspect-[9/16] max-h-[600px]' : ''
                      }`}
                      style={{
                        maxWidth: '100%',
                        objectFit: 'contain'
                      }}
                    />
                    <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white text-xs p-1 rounded">
                      {platformLimits.recommendedImageSize}
                    </div>
                  </div>
                )}
                {content.mediaType === 'video' && (
                  <div className="relative">
                    <video
                      src={content.mediaUrl || formData.preview}
                      controls
                      className={`rounded-lg shadow mx-auto object-cover ${
                        content?.platform === 'instagram' ? 'aspect-[4/5] max-h-[500px]' :
                        content?.platform === 'facebook' ? 'aspect-[16/9] max-h-[500px]' :
                        content?.platform === 'linkedin' ? 'aspect-[16/9] max-h-[500px]' :
                        content?.platform === 'twitter' ? 'aspect-[16/9] max-h-[500px]' :
                        content?.platform === 'tiktok' ? 'aspect-[9/16] max-h-[600px]' : ''
                      }`}
                      style={{
                        maxWidth: '100%',
                        objectFit: 'contain'
                      }}
                    />
                    <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white text-xs p-1 rounded">
                      {platformLimits.recommendedVideoLength}
                    </div>
                  </div>
                )}
                {content.mediaType === 'audio' && (
                  <audio
                    src={formData.preview}
                    controls
                    className="w-full"
                  />
                )}
                {!['image', 'video', 'audio'].includes(content.mediaType) && (
                  <div className="p-4 bg-gray-100 rounded-lg">
                    <p className="text-gray-600">
                      Preview not available for this file type. Selected file: {formData.files[0].name}
                    </p>
                  </div>
                )}
                <button
                  onClick={() => {
                    setFormData(prev => ({
                      ...prev,
                      preview: null,
                      files: null
                    }));
                    updateContent({ mediaUrl: null, mediaType: null, mediaFile: null });
                  }}
                  className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          {(formData.preview || content.mediaUrl) && (
            <div className="mt-6 flex justify-between">
              <Link
                to="/app/platform-preview"
                className="px-6 py-3 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-medium"
              >
                Preview & Publish
              </Link>
              <Link
                to="/app/scheduler"
                className="px-6 py-3 bg-green-600 text-white hover:bg-green-700 rounded-lg font-medium"
              >
              Go to Publish
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default MediaUploader;