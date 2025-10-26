import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { Linkedin, Twitter, Instagram, Youtube, Music, Facebook } from 'lucide-react';
import { PLATFORMS } from '../constants/platforms';
import { useContent } from '../context/ContentContext';
import { publishNow, getUserUsageStatus } from '../api';
import axios from 'axios';

// --- helpers (same as PostStatusTracker) -------------------------------------------------------------
const toPlatformId = (p) => {
  if (!p) return '';
  if (typeof p === 'string') return p.toLowerCase();
  if (typeof p === 'object') {
    const id = p.platform || p.id || p.name || '';
    return (id || '').toString().toLowerCase();
  }
  return '';
};

const normalizePlatforms = (platforms) =>
  (platforms || []).map(toPlatformId).filter(Boolean);

const getPlatformNames = (platforms) => {
  const ids = normalizePlatforms(platforms);
  return ids.map((id) => {
    const meta = PLATFORMS?.[id.toUpperCase()];
    return meta?.name || id;
  });
};

const PlatformPreviewPanel = ({ onPublishNow, bypassDailyLimits = false }) => {
    const { user } = useUser();
    const { updateContent, content } = useContent();
    const [formData, setFormData] = useState({
        platform: content?.platform || 'instagram'
    });
    
    // Multi-platform selection state
    const [platforms, setPlatforms] = useState([]);
    
    // Simple individual mode toggle
    const [isIndividualMode, setIsIndividualMode] = useState(false);
    const [activePlatform, setActivePlatform] = useState('instagram');
    const [individualContent, setIndividualContent] = useState({});
    const [originalIndividualContent, setOriginalIndividualContent] = useState({});
    
    // Editable content state
    const [editableContent, setEditableContent] = useState({
        captions: content?.captions || [content?.caption || ''],
        hashtags: content?.hashtags || []
    });
    
    // Edit mode state
    const [isEditing, setIsEditing] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    
    // Publishing state
    const [isPublishing, setIsPublishing] = useState(false);
    const [publishingProgress, setPublishingProgress] = useState({});
    const [publishStatus, setPublishStatus] = useState(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    
    // Usage tracking state
    const [usageStatus, setUsageStatus] = useState(null);
    const [usageLoading, setUsageLoading] = useState(false);

    const platformLimits = PLATFORMS[formData.platform.toUpperCase()];

    // Fetch usage status
    const fetchUsageStatus = async () => {
        try {
            setUsageLoading(true);
            const usage = await getUserUsageStatus();
            setUsageStatus(usage);
        } catch (error) {
            console.error('Error fetching usage status:', error);
        } finally {
            setUsageLoading(false);
        }
    };

    // Fetch usage status when component mounts and user is available
    useEffect(() => {
        if (user && !bypassDailyLimits) {
            fetchUsageStatus();
        }
    }, [user, bypassDailyLimits]);

    // Simple toggle function
    const toggleIndividualMode = () => {
        const newMode = !isIndividualMode;
        setIsIndividualMode(newMode);
        
        if (newMode) {
            // Initialize individual content with current content for all platforms
            initializeIndividualContent();
        }
    };

    // Initialize individual content for all selected platforms
    const initializeIndividualContent = () => {
        if (platforms.length > 0) {
            const newIndividualContent = {};
            const newOriginalContent = {};
            platforms.forEach(platform => {
                const platformContent = {
                    captions: [...editableContent.captions],
                    hashtags: [...editableContent.hashtags]
                };
                newIndividualContent[platform] = platformContent;
                newOriginalContent[platform] = { ...platformContent }; // Deep copy for comparison
            });
            setIndividualContent(newIndividualContent);
            setOriginalIndividualContent(newOriginalContent);
            setActivePlatform(platforms[0] || 'instagram');
        }
    };

    // Get current content based on mode
    const getCurrentContent = () => {
        if (isIndividualMode) {
            // In individual mode, return the platform-specific content or default structure
            return individualContent[activePlatform] || {
                captions: editableContent.captions,
                hashtags: editableContent.hashtags
            };
        }
        return editableContent;
    };

    // Update content based on mode
    const updateCurrentContent = (field, value) => {
        if (isIndividualMode) {
            setIndividualContent(prev => ({
                ...prev,
                [activePlatform]: {
                    captions: prev[activePlatform]?.captions || editableContent.captions,
                    hashtags: prev[activePlatform]?.hashtags || editableContent.hashtags,
                    ...prev[activePlatform],
                    [field]: value
                }
            }));
        } else {
            setEditableContent(prev => ({
                ...prev,
                [field]: value
            }));
        }
    };

    // Update editable content when content context changes
    useEffect(() => {
        setEditableContent({
            captions: content?.captions || [content?.caption || ''],
            hashtags: content?.hashtags || []
        });
    }, [content]);

    // Initialize individual content when platforms change in individual mode
    useEffect(() => {
        if (isIndividualMode && platforms.length > 0) {
            const newIndividualContent = {};
            const newOriginalContent = {};
            
            platforms.forEach(platform => {
                // Only initialize if this platform doesn't already have content
                if (!individualContent[platform]) {
                    const platformContent = {
                        captions: [...editableContent.captions],
                        hashtags: [...editableContent.hashtags]
                    };
                    newIndividualContent[platform] = platformContent;
                    newOriginalContent[platform] = { ...platformContent }; // Deep copy for comparison
                } else {
                    // Keep existing content
                    newIndividualContent[platform] = individualContent[platform];
                    newOriginalContent[platform] = originalIndividualContent[platform] || { ...individualContent[platform] };
                }
            });
            
            setIndividualContent(newIndividualContent);
            setOriginalIndividualContent(newOriginalContent);
            
            // Set active platform if not set or if current active platform is not in the list
            if (!activePlatform || !platforms.includes(activePlatform)) {
                setActivePlatform(platforms[0] || 'instagram');
            }
        }
    }, [platforms, isIndividualMode, editableContent, individualContent, originalIndividualContent, activePlatform]);

    // Check for changes
    useEffect(() => {
        if (isIndividualMode) {
            // In individual mode, check if current platform content differs from original
            const currentPlatformContent = individualContent[activePlatform];
            const originalPlatformContent = originalIndividualContent[activePlatform];
            
            if (currentPlatformContent && originalPlatformContent) {
                const hasCaptionChanges = currentPlatformContent.captions[0] !== originalPlatformContent.captions[0];
                const hasHashtagChanges = JSON.stringify(currentPlatformContent.hashtags) !== JSON.stringify(originalPlatformContent.hashtags);
                setHasChanges(hasCaptionChanges || hasHashtagChanges);
            } else {
                // If no original content, any content means changes
                setHasChanges(currentPlatformContent && (currentPlatformContent.captions[0] || currentPlatformContent.hashtags.length > 0));
            }
        } else {
            // Default mode - check editableContent against original content
            const hasCaptionChanges = editableContent.captions[0] !== (content?.captions?.[0] || content?.caption || '');
            const hasHashtagChanges = JSON.stringify(editableContent.hashtags) !== JSON.stringify(content?.hashtags || []);
            setHasChanges(hasCaptionChanges || hasHashtagChanges);
        }
    }, [editableContent, content, isIndividualMode, individualContent, originalIndividualContent, activePlatform]);

    // Debug function to check media URL
    const debugMediaUrl = () => {
        if (content.mediaUrl) {
        }
    };

    useEffect(() => {
        debugMediaUrl();
    }, [content.mediaUrl, formData.platform]);

    useEffect(() => {
        if (content?.platform !== formData.platform) {
            setFormData(prev => ({
                ...prev,
                platform: content?.platform || 'instagram'
            }));
        }
    }, [content?.platform, formData.platform]);

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

    // Multi-platform selection handler
    const handlePlatformChange = (e) => {
        const { value, checked } = e.target;
        if (checked) {
            setPlatforms(prev => [...prev, value]);
        } else {
            setPlatforms(prev => prev.filter(p => p !== value));
        }
        setPublishStatus(null);
    };

    const handleEditableContentChange = (field, value) => {
        setEditableContent(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleHashtagChange = (index, value) => {
        const currentHashtags = getCurrentContent().hashtags;
        const newHashtags = [...currentHashtags];
        newHashtags[index] = value;
        updateCurrentContent('hashtags', newHashtags);
    };

    const addHashtag = () => {
        const currentHashtags = getCurrentContent().hashtags;
        updateCurrentContent('hashtags', [...currentHashtags, '']);
    };

    const removeHashtag = (index) => {
        const currentHashtags = getCurrentContent().hashtags;
        updateCurrentContent('hashtags', currentHashtags.filter((_, i) => i !== index));
    };

    // Save changes function
    const saveChanges = () => {
        if (isIndividualMode) {
            // Individual mode: update original content to match current saved state
            setOriginalIndividualContent(prev => ({
                ...prev,
                [activePlatform]: {
                    captions: [...individualContent[activePlatform].captions],
                    hashtags: [...individualContent[activePlatform].hashtags]
                }
            }));
            setIsEditing(false);
            setHasChanges(false);
        } else {
            // Default mode: save to main content context
            updateContent({
                captions: editableContent.captions,
                hashtags: editableContent.hashtags.filter(tag => tag.trim() !== '')
            });
            setIsEditing(false);
            setHasChanges(false);
        }
    };


    const cancelChanges = () => {
        if (isIndividualMode) {
            // Reset individual platform content to original content
            setIndividualContent(prev => ({
                ...prev,
                [activePlatform]: {
                    captions: content?.captions || [content?.caption || ''],
                    hashtags: content?.hashtags || []
                }
            }));
        } else {
            // Reset unified content
            setEditableContent({
                captions: content?.captions || [content?.caption || ''],
                hashtags: content?.hashtags || []
            });
        }
        setIsEditing(false);
        setHasChanges(false);
    };

    const validateContent = () => {
        const errors = [];
        
        if (platforms.length === 0) {
            errors.push('Please select at least one platform');
        }

        // Check if any platform requires media but no media is provided
        const platformsRequiringMedia = platforms.filter(platformId => {
            const platform = PLATFORMS[platformId.toUpperCase()];
            return platform.requiresMedia && !content.mediaUrl;
        });

        if (platformsRequiringMedia.length > 0) {
            const platformNames = platformsRequiringMedia.map(platformId => 
                PLATFORMS[platformId.toUpperCase()].name
            ).join(', ');
            errors.push(`${platformNames} require media to be uploaded`);
        }

        return errors;
    };

    const handlePublishPost = async () => {
        // Clear previous messages
        setPublishStatus(null);

        // Check usage limits first (skip for Sora flow)
        if (!bypassDailyLimits && usageStatus && !usageStatus.usage.canPublish) {
            const resetTime = new Date(usageStatus.usage.resetAt);
            const hoursUntilReset = Math.ceil((resetTime - new Date()) / (1000 * 60 * 60));
            setError(`Daily limit reached! You've used ${usageStatus.usage.used}/${usageStatus.usage.limit} posts today. Resets in ${hoursUntilReset} hours.`);
            return;
        }

        // Validate inputs
        if (platforms.length === 0) {
            setPublishStatus({
                type: 'error',
                message: 'Please select at least one platform'
            });
            return;
        }

        // Check if mediaUrl is a blob URL (not uploaded to S3 yet)
        if (content.mediaUrl && content.mediaUrl.startsWith('blob:')) {
            setPublishStatus({
                type: 'error',
                message: '❌ Please upload your media file to the server before publishing. Currently showing local preview only.'
            });
            return;
        }

        // Validate content
        const validationErrors = validateContent();
        if (validationErrors.length > 0) {
            setPublishStatus({
                type: 'error',
                message: validationErrors.join('. ')
            });
            return;
        }

        // Check if any platform requires media but no media is provided (EXACT same as Scheduler)
        const platformsRequiringMedia = platforms.filter(platformId => {
            const platform = PLATFORMS[platformId.toUpperCase()];
            return platform.requiresMedia && !content.mediaUrl;
        });

        if (platformsRequiringMedia.length > 0) {
            const platformNames = platformsRequiringMedia.map(platformId => 
                PLATFORMS[platformId.toUpperCase()].name
            ).join(', ');
            setPublishStatus({
                type: 'error',
                message: `${platformNames} require media to be uploaded`
            });
            return;
        }

        if (!editableContent.captions[0] && editableContent.hashtags.filter(tag => tag.trim() !== '').length === 0 && !content.mediaUrl) {
            setPublishStatus({
                type: 'error',
                message: 'Please add a caption, hashtags, or media before publishing.'
            });
            return;
        }

        setIsPublishing(true);
        setPublishingProgress({});
        setError('');
        setSuccess('');

        // Initialize progress tracking for all selected platforms
        const initialProgress = {};
        platforms.forEach(platform => {
            initialProgress[platform] = 'pending';
        });
        setPublishingProgress(initialProgress);

        try {
            // Align payload with Scheduler behavior (use ContentContext values directly)
            let publishData;
            
            if (isIndividualMode) {
                // Individual mode: transform individual content to standard format for backend
                // Use the current active platform's content for now
                const currentPlatformContent = getCurrentContent();
                publishData = {
                    platforms,
                    content: {
                        mediaUrl: content.mediaUrl,
                        captions: currentPlatformContent.captions,
                        hashtags: currentPlatformContent.hashtags,
                        mediaType: content.mediaType,
                        privacyStatus: bypassDailyLimits ? 'public' : 'unlisted'
                    },
                    // Include individual content for backend to handle platform-specific publishing
                    individualContent: individualContent,
                    isIndividualMode: true,
                    refreshToken: user?.publicMetadata?.youtubeRefreshToken || null
                };
            } else {
                // Default mode: send unified content
                publishData = {
                    platforms,
                    content: {
                        mediaUrl: content.mediaUrl,
                        captions: editableContent.captions,
                        hashtags: editableContent.hashtags,
                        mediaType: content.mediaType,
                        privacyStatus: bypassDailyLimits ? 'public' : 'unlisted'
                    },
                    refreshToken: user?.publicMetadata?.youtubeRefreshToken || null
                };
            }

            const result = await onPublishNow(publishData);
            // Debug: log normalized response and expose globally (match Scheduler behavior)
            try {
            } catch (_) {
            }
            try {
                window.__lastPublish = { source: 'PlatformPreview', publishData, response: result, timestamp: Date.now() };
            } catch (_) {}
            
            if (result.success) {
                // Show detailed results
                const successCount = result.post.platforms.filter(r => r.success).length;
                const totalCount = result.post.platforms.length;
                
                let message = '';
                if (successCount === totalCount) {
                    message = `✅ Successfully published to all ${totalCount} platforms! Click "View Post →" to see your posts.`;
                } else {
                    message = `✅ Published to ${successCount}/${totalCount} platforms. Click "View Post →" to see your posts.`;
                }
                
                // Refresh usage status after successful publish
                fetchUsageStatus();

                setPublishStatus({
                    type: 'success',
                    message: message,
                    postId: result.post?.id,
                    platforms: result.post?.platforms || []
                });
                
                // Clear the form after successful publish
                setEditableContent({
                    captions: [''],
                    hashtags: []
                });
                updateContent({
                    captions: [''],
                    hashtags: [],
                    mediaUrl: null,
                    mediaType: null
                });
                setPlatforms([]);
            } else {
                setPublishStatus({
                    type: 'error',
                    message: `❌ Failed to publish: ${result.message || 'Unknown error'}`
                });
            }
        } catch (error) {
            console.error(`Error publishing to platforms:`, error);
            setPublishStatus({
                type: 'error',
                message: `❌ Error: ${error.message}`
            });
        } finally {
            setIsPublishing(false);
        }
    };

    // Media upload handler - EXACT same as MediaUploader
    const handleFileSelect = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        try {
            // Same validation as MediaUploader
            const fileType = file.type.split('/')[0];
            const fileExtension = file.name.split('.').pop().toLowerCase();
            
            // Determine media type based on file extension and MIME type
            let mediaType = fileType;
            if (['jpg', 'jpeg', 'png', 'gif'].includes(fileExtension)) mediaType = 'image';
            if (['mp4', 'mov', 'avi'].includes(fileExtension)) mediaType = 'video';
            
            // Create preview URL immediately (same as MediaUploader)
            const previewUrl = URL.createObjectURL(file);
            
            // Update content with preview URL immediately (EXACT same as MediaUploader)
            updateContent({ 
                mediaUrl: previewUrl,
                mediaType: mediaType,
                mediaFile: file,
                mediaDimensions: null // Will be set after upload
            });

            // Now upload to backend (same as MediaUploader)
            const formData = new FormData();
            formData.append('file', file);
            formData.append('platform', content.platform || 'instagram');

            const response = await axios.post(`${process.env.REACT_APP_AI_API?.replace(/\/$/, '') || 'https://reelpostly.com/ai'}/api/v1/upload`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                },
                timeout: 30000,
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });

            if (response.data && response.data.url) {
                // Update content based on media type (EXACT same as MediaUploader)
                const updatedContent = {
                    mediaUrl: response.data.url,
                    mediaType: response.data.type || mediaType,
                    mediaDimensions: response.data.dimensions || null,
                    mediaFile: null,
                    mediaFilename: response.data.filename
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
                        console.error('Image URL not accessible:', response.data.url);
                        setPublishStatus({
                            type: 'error',
                            message: 'Image URL not accessible - Please try uploading again'
                        });
                    };
                    img.src = response.data.url;
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
                        console.error('Video URL not accessible:', response.data.url);
                        setPublishStatus({
                            type: 'error',
                            message: 'Video URL not accessible - Please try uploading again'
                        });
                    };
                    video.src = response.data.url;
                }

                setPublishStatus({
                    type: 'success',
                    message: `✅ Media uploaded successfully: ${file.name}`
                });
            } else {
                setPublishStatus({
                    type: 'error',
                    message: `❌ Failed to upload media: Invalid server response`
                });
            }
        } catch (error) {
            console.error('Error uploading media:', error);
            const errorMessage = error.response?.data?.detail || error.message;
            setPublishStatus({
                type: 'error',
                message: `❌ Error uploading media: ${errorMessage}`
            });
        } finally {
            event.target.value = null; // Clear the file input
        }
    };

    // Remove media handler - EXACT same as MediaUploader
    const removeMedia = () => {
        updateContent({
            mediaUrl: null,
            mediaType: null,
            mediaDimensions: null
        });
        setPublishStatus({
            type: 'info',
            message: 'Media removed.'
        });
    };

    // Platform-specific preview styles
    const getPlatformPreviewStyles = () => {
        switch (formData.platform) {
            case 'tiktok':
                return 'w-80 h-[600px] bg-black rounded-lg shadow-2xl'; // Vertical mobile-like
            case 'instagram':
                return 'w-96 h-[500px] bg-white rounded-lg shadow-lg border'; // Square-ish
            case 'linkedin':
                return 'w-full max-w-2xl h-auto bg-white rounded-lg shadow-lg border p-6'; // Wide professional
            case 'twitter':
                return 'w-full max-w-lg bg-white rounded-lg shadow-lg border p-4'; // Compact
            case 'youtube':
                return 'w-full max-w-2xl bg-white rounded-lg shadow-lg border'; // Wide video
            case 'facebook':
                return 'w-full max-w-md bg-white rounded-lg shadow-lg border'; // Medium social
            default:
                return 'w-full max-w-md bg-white rounded-lg shadow-lg border';
        }
    };

    // Render platform-specific preview
    const renderPlatformPreview = () => {
        switch (formData.platform) {
            case 'tiktok':
                return renderTikTokPreview();
            case 'instagram':
                return renderInstagramPreview();
            case 'linkedin':
                return renderLinkedInPreview();
            case 'twitter':
                return renderTwitterPreview();
            case 'youtube':
                return renderYouTubePreview();
            case 'facebook':
                return renderFacebookPreview();
            default:
                return renderDefaultPreview();
        }
    };

    // TikTok Preview (Vertical, mobile-like)
    const renderTikTokPreview = () => (
        <div className="relative w-full h-full bg-black text-white">
            {/* Media Area */}
            <div className="relative h-3/4 bg-gray-900">
                {content.mediaUrl ? (
                    content.mediaType === 'video' ? (
                        <video src={content.mediaUrl} className="w-full h-full object-cover" />
                    ) : (
                        <img src={content.mediaUrl} alt="TikTok" className="w-full h-full object-cover" />
                    )
                ) : (
                    <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                        <span className="text-gray-400">No media</span>
                    </div>
                )}
                
                {/* TikTok UI Elements */}
                <div className="absolute right-2 bottom-20 flex flex-col space-y-4">
                    <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center">
                        <span className="text-xs">❤️</span>
                    </div>
                    <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center">
                        <span className="text-xs">💬</span>
                    </div>
                    <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center">
                        <span className="text-xs">🔄</span>
                    </div>
                </div>
            </div>
            
            {/* Caption Area */}
            <div className="p-4 h-1/4 overflow-y-auto">
                {editableContent.captions[0] && (
                    <p className="text-sm mb-2">{editableContent.captions[0]}</p>
                )}
                {editableContent.hashtags && editableContent.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {editableContent.hashtags.slice(0, 5).map((tag, index) => (
                            <span key={index} className="text-blue-400 text-xs">#{tag}</span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );

    // Instagram Preview (Square-ish)
    const renderInstagramPreview = () => (
        <div className="w-full h-full bg-white">
            {/* Header */}
            <div className="flex items-center p-3 border-b">
                <div className="w-8 h-8 bg-gray-300 rounded-full mr-3"></div>
                <span className="text-sm font-medium">username</span>
            </div>
            
            {/* Media */}
            <div className="relative">
                {content.mediaUrl ? (
                    <div className="w-full h-64 bg-gray-100 flex items-center justify-center overflow-hidden">
                        {content.mediaType === 'video' ? (
                            <video 
                                src={content.mediaUrl} 
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                    e.target.style.display = 'none';
                                }}
                            />
                        ) : (
                            <img 
                                src={content.mediaUrl} 
                                alt="Instagram" 
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                    e.target.style.display = 'none';
                                }}
                            />
                        )}
                    </div>
                ) : (
                    <div className="w-full h-64 bg-gray-100 flex items-center justify-center">
                        <span className="text-gray-400">No media</span>
                    </div>
                )}
            </div>
            
            {/* Actions */}
            <div className="p-3 flex space-x-4">
                <span>❤️</span>
                <span>💬</span>
                <span>📤</span>
            </div>
            
            {/* Caption */}
            <div className="px-3 pb-3">
                {editableContent.captions[0] && (
                    <p className="text-sm mb-2">
                        <span className="font-medium">username</span> {editableContent.captions[0]}
                    </p>
                )}
                {editableContent.hashtags && editableContent.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {editableContent.hashtags.slice(0, 3).map((tag, index) => (
                            <span key={index} className="text-blue-600 text-xs">#{tag}</span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );

    // LinkedIn Preview (Professional, wide)
    const renderLinkedInPreview = () => (
        <div className="w-full bg-white">
            {/* Header */}
            <div className="flex items-center p-4 border-b">
                <div className="w-12 h-12 bg-blue-600 rounded-full mr-3 flex items-center justify-center text-white font-bold">
                    U
                </div>
                <div>
                    <div className="font-medium">Your Name</div>
                    <div className="text-sm text-gray-600">Professional Title</div>
                </div>
            </div>
            
            {/* Content */}
            <div className="p-4">
                {editableContent.captions[0] && (
                    <p className="text-gray-800 mb-4 leading-relaxed">{editableContent.captions[0]}</p>
                )}
                
                {content.mediaUrl && (
                    <div className="mb-4">
                        {content.mediaType === 'image' ? (
                            <div className="w-full h-48 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                                <img 
                                    src={content.mediaUrl} 
                                    alt="LinkedIn" 
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                    }}
                                />
                            </div>
                        ) : (
                            <div className="w-full h-48 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                                <video 
                                    src={content.mediaUrl} 
                                    className="w-full h-full object-cover" 
                                    controls
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                    }}
                                />
                            </div>
                        )}
                    </div>
                )}
                
                {editableContent.hashtags && editableContent.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {editableContent.hashtags.map((tag, index) => (
                            <span key={index} className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-sm">
                                #{tag}
                            </span>
                        ))}
                    </div>
                )}
            </div>
            
            {/* Engagement */}
            <div className="px-4 py-3 border-t text-sm text-gray-600">
                <span>👍 Like</span>
                <span className="ml-4">💬 Comment</span>
                <span className="ml-4">🔄 Repost</span>
            </div>
        </div>
    );

    // Twitter Preview (Compact)
    const renderTwitterPreview = () => (
        <div className="w-full bg-white">
            {/* Header */}
            <div className="flex items-center p-3">
                <div className="w-10 h-10 bg-blue-400 rounded-full mr-3"></div>
                <div>
                    <div className="font-medium">@username</div>
                    <div className="text-sm text-gray-600">2h</div>
                </div>
            </div>
            
            {/* Content */}
            <div className="px-3 pb-3">
                {editableContent.captions[0] && (
                    <p className="text-gray-800 mb-3">{editableContent.captions[0]}</p>
                )}
                
                {content.mediaUrl && (
                    <div className="mb-3 rounded-lg overflow-hidden">
                        <div className="w-full h-48 bg-gray-100 flex items-center justify-center overflow-hidden">
                            {content.mediaType === 'video' ? (
                                <video 
                                    src={content.mediaUrl} 
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                    }}
                                />
                            ) : (
                                <img 
                                    src={content.mediaUrl} 
                                    alt="Twitter" 
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                    }}
                                />
                            )}
                        </div>
                    </div>
                )}
                
                {editableContent.hashtags && editableContent.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                        {editableContent.hashtags.slice(0, 3).map((tag, index) => (
                            <span key={index} className="text-blue-500 text-sm">#{tag}</span>
                        ))}
                    </div>
                )}
            </div>
            
            {/* Actions */}
            <div className="px-3 py-2 border-t flex justify-between text-gray-500">
                <span>💬</span>
                <span>🔄</span>
                <span>❤️</span>
                <span>📤</span>
            </div>
        </div>
    );

    // YouTube Preview (Wide video)
    const renderYouTubePreview = () => (
        <div className="w-full bg-white">
            {/* Video Thumbnail */}
            <div className="relative">
                {content.mediaUrl ? (
                    <div className="w-full h-48 bg-gray-200 flex items-center justify-center overflow-hidden">
                        {content.mediaType === 'video' ? (
                            <video 
                                src={content.mediaUrl} 
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                    e.target.style.display = 'none';
                                }}
                            />
                        ) : (
                            <img 
                                src={content.mediaUrl} 
                                alt="YouTube" 
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                    e.target.style.display = 'none';
                                }}
                            />
                        )}
                    </div>
                ) : (
                    <div className="w-full h-48 bg-gray-200 flex items-center justify-center">
                        <span className="text-gray-400">Video thumbnail</span>
                    </div>
                )}
                <div className="absolute bottom-2 right-2 bg-black text-white text-xs px-2 py-1 rounded">
                    10:30
                </div>
            </div>
            
            {/* Video Info */}
            <div className="p-4">
                <h3 className="font-medium mb-2">Your Video Title</h3>
                {editableContent.captions[0] && (
                    <p className="text-sm text-gray-600 mb-2">{editableContent.captions[0]}</p>
                )}
                
                <div className="flex items-center text-sm text-gray-500">
                    <span>1.2K views</span>
                    <span className="mx-2">•</span>
                    <span>2 hours ago</span>
                </div>
                
                {editableContent.hashtags && editableContent.hashtags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                        {editableContent.hashtags.slice(0, 5).map((tag, index) => (
                            <span key={index} className="text-blue-600 text-xs">#{tag}</span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );

    // Facebook Preview (Medium social)
    const renderFacebookPreview = () => (
        <div className="w-full bg-white">
            {/* Header */}
            <div className="flex items-center p-3">
                <div className="w-10 h-10 bg-blue-600 rounded-full mr-3"></div>
                <div>
                    <div className="font-medium">Your Name</div>
                    <div className="text-sm text-gray-600">2 hours ago</div>
                </div>
            </div>
            
            {/* Content */}
            <div className="px-3 pb-3">
                {editableContent.captions[0] && (
                    <p className="text-gray-800 mb-3">{editableContent.captions[0]}</p>
                )}
                
                {content.mediaUrl && (
                    <div className="mb-3">
                        <div className="w-full h-48 bg-gray-100 rounded overflow-hidden flex items-center justify-center">
                            {content.mediaType === 'video' ? (
                                <video 
                                    src={content.mediaUrl} 
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                    }}
                                />
                            ) : (
                                <img 
                                    src={content.mediaUrl} 
                                    alt="Facebook" 
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                    }}
                                />
                            )}
                        </div>
                    </div>
                )}
                
                {editableContent.hashtags && editableContent.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                        {editableContent.hashtags.slice(0, 4).map((tag, index) => (
                            <span key={index} className="text-blue-600 text-sm">#{tag}</span>
                        ))}
                    </div>
                )}
            </div>
            
            {/* Engagement */}
            <div className="px-3 py-2 border-t text-sm text-gray-600">
                <span>👍 12</span>
                <span className="ml-4">💬 3</span>
                <span className="ml-4">🔄 1</span>
            </div>
        </div>
    );

    // Default Preview
    const renderDefaultPreview = () => (
        <div className="w-full bg-white p-4">
            <h4 className="font-medium mb-3">Preview</h4>
            {editableContent.captions[0] && <p className="mb-3">{editableContent.captions[0]}</p>}
            {content.mediaUrl && (
                <div className="w-full h-48 bg-gray-100 mb-3 rounded overflow-hidden flex items-center justify-center">
                    {content.mediaType === 'video' ? (
                        <video 
                            src={content.mediaUrl} 
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                e.target.style.display = 'none';
                            }}
                        />
                    ) : (
                        <img 
                            src={content.mediaUrl} 
                            alt="Preview" 
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                e.target.style.display = 'none';
                            }}
                        />
                    )}
                </div>
            )}
            {editableContent.hashtags && editableContent.hashtags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {editableContent.hashtags.map((tag, index) => (
                        <span key={index} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                            #{tag}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );

    return (
        <>
            <div className="bg-white shadow rounded-lg p-6">
                {/* Main Content Grid - Same layout as VideoGenerator */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                    {/* Left Column - Controls */}
                    <div className="lg:col-span-2 space-y-6">
                    {/* Platform Selector */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Select Platform
                        </label>
                        <select
                            name="platform"
                            value={formData.platform}
                            onChange={handleInputChange}
                            className="w-full p-2 border rounded"
                        >
                            {Object.values(PLATFORMS).map((platform) => (
                                // {platform.id !== 'twitter' && platform.id !== 'tiktok' && (
                                <option key={platform.id} value={platform.id} style={{ display: platform.id === 'twitter' || platform.id === 'tiktok' ? 'none' : 'block' }}>
                                    {platform.icon} {platform.name}
                                </option>
                                // )}
                            ))}
                        </select>
                    </div>

                    {/* Content Editing Mode Toggle */}
                    <div className="mb-6 bg-gray-50 p-4 rounded-lg">
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    📝 Content Editing Mode
                                </label>
                                <p className="text-xs text-gray-500 mt-1">
                                    {isIndividualMode ? 'Edit unique content for each platform' : 'Use same content for all platforms'}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={toggleIndividualMode}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                                    isIndividualMode ? 'bg-indigo-600' : 'bg-gray-200'
                                }`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                        isIndividualMode ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                                />
                            </button>
                        </div>
                    </div>

                    {/* Multi-Platform Selection */}
                    <div className="mb-6 bg-blue-50 p-4 rounded-lg">
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                            🎯 Select Platforms to Publish
                        </label>
                        <div className="space-y-4">
                            {Object.values(PLATFORMS).map((platform) => (
                                platform.id !== 'twitter' && platform.id !== 'tiktok' && (
                                <label key={platform.id} className="flex items-center p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                                    <input
                                        type="checkbox"
                                        value={platform.id}
                                        checked={platforms.includes(platform.id)}
                                        onChange={handlePlatformChange}
                                        className="mr-2"
                                        disabled={isPublishing}
                                    />
                                    <span className="text-sm flex items-center">
                                        <span className="mr-2">{platform.icon}</span>
                                        {platform.name}
                                    </span>
                                </label>
                                )
                            ))}
                        </div>
                    </div>

                    {/* Platform Requirements */}
                    {/* <div className="mb-6 bg-gray-50 p-4 rounded-lg">
                        <h2 className="text-lg font-medium mb-3">Platform Requirements</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <h3 className="text-sm font-medium mb-2">Content Limits</h3>
                                <ul className="text-sm text-gray-600 space-y-1">
                                    <li>• Max Characters: {platformLimits.maxCharacters}</li>
                                    <li>• Max Hashtags: {platformLimits.maxHashtags}</li>
                                    <li>• Recommended Style: {platformLimits.prompt_style}</li>
                                </ul>
                            </div>
                            <div>
                                <h3 className="text-sm font-medium mb-2">Media Requirements</h3>
                                <ul className="text-sm text-gray-600 space-y-1">
                                    <li>• Supported Types: {platformLimits.supportedMedia.join(', ')}</li>
                                    <li>• Image Size: {platformLimits.recommendedImageSize}</li>
                                    <li>• Video Length: {platformLimits.recommendedVideoLength}</li>
                                </ul>
                            </div>
                        </div>
                    </div> */}

                    {/* Editable Content Section */}
                    <div className="mb-6 bg-blue-50 p-4 rounded-lg">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-medium">
                                {isIndividualMode ? `Describe Video - ${PLATFORMS[activePlatform.toUpperCase()]?.name || activePlatform}` : 'Describe Video'}
                            </h2>
                            <div className="flex gap-2">
                                {!isEditing ? (
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                                    >
                                        ✏️ Edit
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            onClick={saveChanges}
                                            disabled={!hasChanges}
                                            className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                                        >
                                            💾 Save
                                        </button>
                                        <button
                                            onClick={cancelChanges}
                                            className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
                                        >
                                            ❌ Cancel
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Platform Tabs for Individual Mode */}
                        {isIndividualMode && platforms.length > 0 && (
                            <div className="mb-4 border-b border-gray-200">
                                <nav className="flex space-x-4">
                                    {platforms.map((platform) => (
                                        <button
                                            key={platform}
                                            onClick={() => setActivePlatform(platform)}
                                            className={`py-2 px-3 text-sm font-medium border-b-2 transition-colors ${
                                                activePlatform === platform
                                                    ? 'border-blue-500 text-blue-600'
                                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                            }`}
                                        >
                                            {PLATFORMS[platform.toUpperCase()]?.name || platform}
                                        </button>
                                    ))}
                                </nav>
                            </div>
                        )}

                        {isEditing ? (
                            <div className="space-y-4">
                                {/* Caption Editor */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Caption ({getCurrentContent().captions[0]?.length || 0}/{platformLimits.maxCharacters})
                                    </label>
                                    <textarea
                                        value={getCurrentContent().captions[0] || ''}
                                        onChange={(e) => updateCurrentContent('captions', [e.target.value])}
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        rows={4}
                                        maxLength={platformLimits.maxCharacters}
                                        placeholder="Enter your caption here..."
                                    />
                                </div>

                                {/* Hashtags Editor */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Hashtags ({getCurrentContent().hashtags.filter(tag => tag.trim() !== '').length}/{platformLimits.maxHashtags})
                                    </label>
                                    <div className="space-y-2">
                                        {getCurrentContent().hashtags.map((tag, index) => (
                                            <div key={index} className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={tag}
                                                    onChange={(e) => handleHashtagChange(index, e.target.value)}
                                                    className="flex-1 p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                    placeholder={`Hashtag ${index + 1}`}
                                                />
                                                <button
                                                    onClick={() => removeHashtag(index)}
                                                    className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                                                >
                                                    ❌
                                                </button>
                                            </div>
                                        ))}
                                        {editableContent.hashtags.length < platformLimits.maxHashtags && (
                                            <button
                                                onClick={addHashtag}
                                                className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                                            >
                                                ➕ Add Hashtag
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {getCurrentContent().captions[0] && (
                                    <div>
                                        <strong>Caption:</strong> {getCurrentContent().captions[0]}
                                    </div>
                                )}
                                {getCurrentContent().hashtags.filter(tag => tag.trim() !== '').length > 0 && (
                                    <div>
                                        <strong>Hashtags:</strong> {getCurrentContent().hashtags.filter(tag => tag.trim() !== '').map(tag => `#${tag}`).join(' ')}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Download Updated Video Button */}
                    {content.mediaUrl && content.mediaType === 'video' && (
                        <div className="mb-6 flex justify-center">
                            <button
                                onClick={async () => {
                                    try {
                                        const response = await fetch(content.mediaUrl);
                                        const blob = await response.blob();
                                        const url = window.URL.createObjectURL(blob);
                                        const link = document.createElement('a');
                                        link.href = url;
                                        link.download = 'updated-video.mp4';
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                        window.URL.revokeObjectURL(url);
                                    } catch (error) {
                                        console.error('Download error:', error);
                                        alert('Failed to download video. Please try again.');
                                    }
                                }}
                                className="px-8 py-3 bg-purple-600 text-white rounded text-sm hover:bg-purple-700"
                            >
                                ⬇️ Download Updated Video
                            </button>
                        </div>
                    )}

                    {/* Media Upload Section - Commented out for Sora video flow */}
                    {/* <div className="mb-6 bg-white p-4 rounded-lg shadow-sm">
                        <h3 className="text-lg font-medium mb-3">Upload Media</h3>
                        <div className="flex items-center space-x-3">
                            <label htmlFor="media-upload" className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors">
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                Select File
                            </label>
                            <input
                                type="file"
                                id="media-upload"
                                accept="image/*,video/*"
                                onChange={handleFileSelect}
                                className="hidden"
                                disabled={isPublishing}
                            />
                            {content.mediaUrl && (
                                <button
                                    onClick={removeMedia}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center"
                                    disabled={isPublishing}
                                >
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                    Remove Media
                                </button>
                            )}
                        </div>
                        {publishStatus && (
                            <div className="mt-3 text-sm text-gray-600">
                                {publishStatus.message}
                            </div>
                        )}
                    </div> */}

                </div>

                {/* Right Column - Preview */}
                <div className="lg:col-span-3 bg-gray-50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Preview & Publish</h3>
                    
                    {/* Platform-Specific Preview */}
                    <div className="space-y-6">
                        
                        {/* Media Preview Section */}
                        {content.mediaUrl && (
                            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                                <h4 className="text-sm font-medium mb-2">📁 Media Preview:</h4>
                                <div className="flex items-center space-x-4">
                                    {content.mediaType === 'image' ? (
                                        <img 
                                            src={content.mediaUrl} 
                                            alt="Media Preview" 
                                            className="w-24 h-24 object-cover rounded-lg border"
                                        />
                                    ) : content.mediaType === 'video' ? (
                                        <video 
                                            src={content.mediaUrl} 
                                            className="w-24 h-24 object-cover rounded-lg border"
                                            muted
                                        />
                                    ) : (
                                        <div className="w-24 h-24 bg-gray-200 rounded-lg border flex items-center justify-center">
                                            <span className="text-gray-500 text-xs">File</span>
                                        </div>
                                    )}
                                    
                                    <div className="flex-1">
                                        <p className="text-sm font-medium">Type: {content.mediaType || 'Unknown'}</p>
                                        <p className="text-xs text-gray-600">Media ready for publishing</p>
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        {/* Platform-specific preview container */}
                        <div className={`mx-auto ${getPlatformPreviewStyles()}`}>
                            {renderPlatformPreview()}
                        </div>

                        {/* Publishing Status Display */}
                        {publishStatus && (
                            <div className="p-4 rounded-lg bg-white border border-gray-300">
                                {/* Platform Icons */}
                                {publishStatus.platforms && publishStatus.platforms.length > 0 && (
                                    <div className="flex items-center flex-wrap mb-3">
                                        {publishStatus.platforms.map((platform, index) => {
                                            const platformData = PLATFORMS[platform.platform?.toUpperCase()];
                                            return (
                                                <span key={index} className="inline-flex items-center mr-2">
                                                    <span className="mr-1">{platformData?.icon || '🔗'}</span>
                                                    <span className="text-xs text-gray-600">{platformData?.name || platform.platform}</span>
                                                </span>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Timestamp */}
                                <div className="text-xs text-gray-500 mb-3">
                                    {publishStatus.postId ? new Date(publishStatus.postId).toLocaleString() : ''}
                                </div>

                                {/* Caption */}
                                {content.caption && (
                                    <p className="mt-2 text-sm text-gray-800 mb-3">
                                        {content.caption}
                                    </p>
                                )}

                                {/* Platform Names */}
                                {publishStatus.platforms && publishStatus.platforms.length > 0 && (
                                    <div className="mt-2 text-xs text-gray-600 mb-3">
                                        Platforms: {getPlatformNames(publishStatus.platforms).join(', ')}
                                    </div>
                                )}

                                {/* Per-Platform Results */}
                                {publishStatus.platforms && publishStatus.platforms.length > 0 && (
                                    <div className="mt-3 grid gap-2">
                                        {publishStatus.platforms.map((r, i) => {
                                            const pid = toPlatformId(r?.platform || r?.id);
                                            const name = PLATFORMS?.[pid.toUpperCase()]?.name || pid || 'platform';
                                            // Access URL from the nested result structure  
                                            const postUrl = r?.result?.url;
                                            return (
                                                <div key={r.postId || i} className="text-sm">
                                                    <span className={r.success ? 'text-green-700' : 'text-red-700'}>
                                                        {r.success ? '✅' : '❌'} {name}
                                                    </span>
                                                    {postUrl && (
                                                        <>
                                                            {' • '}
                                                            <a className="text-blue-600 hover:underline font-medium" href={postUrl} target="_blank" rel="noreferrer">
                                                                View Post →
                                                            </a>
                                                        </>
                                                    )}
                                                    {r?.result?.message && <> • <span className="text-gray-600">{r?.result?.message}</span></>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Usage Status Display */}
                        {!bypassDailyLimits && usageStatus && (
                            <div className={`mt-4 p-3 rounded-lg border ${
                                usageStatus.usage.canPublish ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                            }`}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className={`text-sm font-medium ${
                                            usageStatus.usage.canPublish ? 'text-green-800' : 'text-red-800'
                                        }`}>
                                            Daily Posts: {usageStatus.usage.used}/{usageStatus.usage.limit}
                                        </p>
                                        <p className="text-xs text-gray-600">
                                            Plan: {usageStatus.plan} • {usageStatus.usage.remaining} remaining
                                        </p>
                                    </div>
                                    {!usageStatus.usage.canPublish && (
                                        <div className="text-right">
                                            <p className="text-xs text-red-600">
                                                Resets in {Math.ceil((new Date(usageStatus.usage.resetAt) - new Date()) / (1000 * 60 * 60))}h
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}


                        {/* Platform Constraints Warning */}
                        {/* {platforms.length > 0 && (
                            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <p className="text-sm text-yellow-800">
                                    ⚠️ Platform Requirements:
                                </p>
                                <ul className="text-xs text-yellow-700 mt-1 space-y-1">
                                    {platforms.map(platformId => {
                                        const platform = PLATFORMS[platformId.toUpperCase()];
                                        return (
                                            <li key={platformId}>
                                                • {platform.name}: {platform.maxCharacters} chars, {platform.maxHashtags} hashtags
                                                {platform.requiresMedia && ', requires media'}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        )} */}
                    </div>
                </div>
            </div>

            {/* Action Buttons - Below Both Columns, Centered */}
            <div className="mt-8 flex justify-center gap-4">
                {bypassDailyLimits ? (
                    <Link
                        to="/app/sora/video-generator"
                        className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                    >
                        Back to AI Video Generator
                    </Link>
                ) : (
                    <Link
                        to="/app/media-upload"
                        className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                    >
                        Back to Media Upload
                    </Link>
                )}
                <button
                    onClick={handlePublishPost}
                    className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    disabled={isPublishing || platforms.length === 0 || (!editableContent.captions[0] && editableContent.hashtags.filter(tag => tag.trim() !== '').length === 0 && !content.mediaUrl) || (!bypassDailyLimits && usageStatus && !usageStatus.usage.canPublish)}
                >
                    {isPublishing ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Publishing to {platforms.length} platforms...
                        </>
                    ) : (
                        (!bypassDailyLimits && usageStatus && !usageStatus.usage.canPublish) ? 
                            `Daily Limit Reached (${usageStatus.usage.used}/${usageStatus.usage.limit})` :
                            '✅ Confirm and Publish'
                    )}
                </button>
            </div>
        </div>
        </>
    );
};

export default PlatformPreviewPanel; 