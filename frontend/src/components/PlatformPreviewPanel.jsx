import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { PLATFORMS } from '../constants/platforms';
import { useContent } from '../context/ContentContext';
import { publishNow } from '../api';

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

const PlatformPreviewPanel = ({ onPublishNow }) => {
    const { user } = useUser();
    const { updateContent, content } = useContent();
    const [formData, setFormData] = useState({
        platform: content?.platform || 'instagram'
    });
    
    // Multi-platform selection state
    const [platforms, setPlatforms] = useState([]);
    
    // Editable content state
    const [editableContent, setEditableContent] = useState({
        caption: content?.caption || '',
        hashtags: content?.hashtags || []
    });
    
    // Edit mode state
    const [isEditing, setIsEditing] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    
    // Publishing state
    const [isPublishing, setIsPublishing] = useState(false);
    const [publishStatus, setPublishStatus] = useState(null);

    const platformLimits = PLATFORMS[formData.platform.toUpperCase()];

    // Update editable content when content context changes
    useEffect(() => {
        setEditableContent({
            caption: content?.caption || '',
            hashtags: content?.hashtags || []
        });
    }, [content]);

    // Check for changes
    useEffect(() => {
        const hasCaptionChanges = editableContent.caption !== (content?.caption || '');
        const hasHashtagChanges = JSON.stringify(editableContent.hashtags) !== JSON.stringify(content?.hashtags || []);
        setHasChanges(hasCaptionChanges || hasHashtagChanges);
    }, [editableContent, content]);

    // Debug function to check media URL
    const debugMediaUrl = () => {
        if (content.mediaUrl) {
            console.log('Current media URL:', content.mediaUrl);
            console.log('Media type:', content.mediaType);
            console.log('Platform:', formData.platform);
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
        const newHashtags = [...editableContent.hashtags];
        newHashtags[index] = value;
        setEditableContent(prev => ({
            ...prev,
            hashtags: newHashtags
        }));
    };

    const addHashtag = () => {
        setEditableContent(prev => ({
            ...prev,
            hashtags: [...prev.hashtags, '']
        }));
    };

    const removeHashtag = (index) => {
        setEditableContent(prev => ({
            ...prev,
            hashtags: prev.hashtags.filter((_, i) => i !== index)
        }));
    };

    const saveChanges = () => {
        updateContent({
            caption: editableContent.caption,
            hashtags: editableContent.hashtags.filter(tag => tag.trim() !== '')
        });
        setIsEditing(false);
        setHasChanges(false);
    };

    const cancelChanges = () => {
        setEditableContent({
            caption: content?.caption || '',
            hashtags: content?.hashtags || []
        });
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

        // Validate inputs
        if (platforms.length === 0) {
            setPublishStatus({
                type: 'error',
                message: 'Please select at least one platform'
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

        if (!editableContent.caption && editableContent.hashtags.filter(tag => tag.trim() !== '').length === 0 && !content.mediaUrl) {
            setPublishStatus({
                type: 'error',
                message: 'Please add a caption, hashtags, or media before publishing.'
            });
            return;
        }

        setIsPublishing(true);

        try {
            // Align payload with Scheduler behavior (use ContentContext values directly)
            const publishData = {
                platforms,
                content: {
                    mediaUrl: content.mediaUrl,
                    caption: content.caption,
                    hashtags: content.hashtags,
                    mediaType: content.mediaType,
                    privacyStatus: 'unlisted'
                },
                // For now, use backend test token. In production, get from user's profile/db
                refreshToken: user?.publicMetadata?.youtubeRefreshToken || null
            };

            const result = await onPublishNow(publishData);
            // Debug: log normalized response and expose globally (match Scheduler behavior)
            try {
                console.log('🧪 [PlatformPreview] response:', JSON.parse(JSON.stringify(result)));
            } catch (_) {
                console.log('🧪 [PlatformPreview] response (raw):', result);
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
                    message = `✅ Successfully published to all ${totalCount} platforms!`;
                } else {
                    message = `✅ Published to ${successCount}/${totalCount} platforms. Some failed.`;
                }

                setPublishStatus({
                    type: 'success',
                    message: message,
                    postId: result.post?.id,
                    platforms: result.post?.platforms || []
                });
                
                // Clear the form after successful publish
                setEditableContent({
                    caption: '',
                    hashtags: []
                });
                updateContent({
                    caption: '',
                    hashtags: [],
                    mediaUrl: '',
                    mediaType: ''
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
                {editableContent.caption && (
                    <p className="text-sm mb-2">{editableContent.caption}</p>
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
                                    console.log('Video load error:', e);
                                    e.target.style.display = 'none';
                                }}
                            />
                        ) : (
                            <img 
                                src={content.mediaUrl} 
                                alt="Instagram" 
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                    console.log('Image load error:', e);
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
                {editableContent.caption && (
                    <p className="text-sm mb-2">
                        <span className="font-medium">username</span> {editableContent.caption}
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
                {editableContent.caption && (
                    <p className="text-gray-800 mb-4 leading-relaxed">{editableContent.caption}</p>
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
                                        console.log('LinkedIn image load error:', e);
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
                                        console.log('LinkedIn video load error:', e);
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
                {editableContent.caption && (
                    <p className="text-gray-800 mb-3">{editableContent.caption}</p>
                )}
                
                {content.mediaUrl && (
                    <div className="mb-3 rounded-lg overflow-hidden">
                        <div className="w-full h-48 bg-gray-100 flex items-center justify-center overflow-hidden">
                            {content.mediaType === 'video' ? (
                                <video 
                                    src={content.mediaUrl} 
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        console.log('Twitter video load error:', e);
                                        e.target.style.display = 'none';
                                    }}
                                />
                            ) : (
                                <img 
                                    src={content.mediaUrl} 
                                    alt="Twitter" 
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        console.log('Twitter image load error:', e);
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
                                    console.log('YouTube video load error:', e);
                                    e.target.style.display = 'none';
                                }}
                            />
                        ) : (
                            <img 
                                src={content.mediaUrl} 
                                alt="YouTube" 
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                    console.log('YouTube image load error:', e);
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
                {editableContent.caption && (
                    <p className="text-sm text-gray-600 mb-2">{editableContent.caption}</p>
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
                {editableContent.caption && (
                    <p className="text-gray-800 mb-3">{editableContent.caption}</p>
                )}
                
                {content.mediaUrl && (
                    <div className="mb-3">
                        <div className="w-full h-48 bg-gray-100 rounded overflow-hidden flex items-center justify-center">
                            {content.mediaType === 'video' ? (
                                <video 
                                    src={content.mediaUrl} 
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        console.log('Facebook video load error:', e);
                                        e.target.style.display = 'none';
                                    }}
                                />
                            ) : (
                                <img 
                                    src={content.mediaUrl} 
                                    alt="Facebook" 
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        console.log('Facebook image load error:', e);
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
            {editableContent.caption && <p className="mb-3">{editableContent.caption}</p>}
            {content.mediaUrl && (
                <div className="w-full h-48 bg-gray-100 mb-3 rounded overflow-hidden flex items-center justify-center">
                    {content.mediaType === 'video' ? (
                        <video 
                            src={content.mediaUrl} 
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                console.log('Default video load error:', e);
                                e.target.style.display = 'none';
                            }}
                        />
                    ) : (
                        <img 
                            src={content.mediaUrl} 
                            alt="Preview" 
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                console.log('Default image load error:', e);
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
        <div className="min-h-screen bg-gray-50">
            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                <div className="bg-white shadow rounded-lg p-6">
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
                                <option key={platform.id} value={platform.id}>
                                    {platform.icon} {platform.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Multi-Platform Selection */}
                    <div className="mb-6 bg-blue-50 p-4 rounded-lg">
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                            🎯 Select Platforms to Publish
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {Object.values(PLATFORMS).map((platform) => (
                                <label key={platform.id} className="flex items-center p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                                    <input
                                        type="checkbox"
                                        value={platform.id}
                                        checked={platforms.includes(platform.id)}
                                        onChange={handlePlatformChange}
                                        className="mr-2"
                                        disabled={isPublishing}
                                    />
                                    <span className="text-sm">
                                        {platform.icon} {platform.name}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Platform Requirements */}
                    <div className="mb-6 bg-gray-50 p-4 rounded-lg">
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
                    </div>

                    {/* Editable Content Section */}
                    <div className="mb-6 bg-blue-50 p-4 rounded-lg">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-medium">Edit Content</h2>
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

                        {isEditing ? (
                            <div className="space-y-4">
                                {/* Caption Editor */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Caption ({editableContent.caption?.length || 0}/{platformLimits.maxCharacters})
                                    </label>
                                    <textarea
                                        value={editableContent.caption}
                                        onChange={(e) => handleEditableContentChange('caption', e.target.value)}
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        rows={4}
                                        maxLength={platformLimits.maxCharacters}
                                        placeholder="Enter your caption here..."
                                    />
                                </div>

                                {/* Hashtags Editor */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Hashtags ({editableContent.hashtags.filter(tag => tag.trim() !== '').length}/{platformLimits.maxHashtags})
                                    </label>
                                    <div className="space-y-2">
                                        {editableContent.hashtags.map((tag, index) => (
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
                                {editableContent.caption && (
                                    <div>
                                        <strong>Caption:</strong> {editableContent.caption}
                                    </div>
                                )}
                                {editableContent.hashtags.filter(tag => tag.trim() !== '').length > 0 && (
                                    <div>
                                        <strong>Hashtags:</strong> {editableContent.hashtags.filter(tag => tag.trim() !== '').map(tag => `#${tag}`).join(' ')}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Platform-Specific Preview */}
                    <div className="space-y-6">
                        <h3 className="text-lg font-medium mb-4">Preview & Publish on {platformLimits.name}</h3>
                        
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
                                    <div className="mt-3 space-y-2">
                                        {publishStatus.platforms.map((r, i) => {
                                            const pid = toPlatformId(r?.platform || r?.id);
                                            const name = PLATFORMS?.[pid.toUpperCase()]?.name || pid || 'platform';
                                            return (
                                                <div key={r.postId || i} className="text-sm">
                                                    <span className={r.success ? 'text-green-700' : 'text-red-700'}>
                                                        {r.success ? '✅' : '❌'} {name}
                                                    </span>
                                                    {r.url && (
                                                        <>
                                                            {' • '}
                                                            <a 
                                                                href={r.url} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer"
                                                                className="text-blue-600 hover:underline"
                                                            >
                                                                open
                                                            </a>
                                                        </>
                                                    )}
                                                    {r.message && <> • <span className="text-gray-600">{r.message}</span></>}
                                                    {r.postId && <> • <span className="text-gray-500">ID: {r.postId}</span></>}
                                                    {r.error && <> • <span className="text-red-600">{r.error}</span></>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                                                {/* Action Buttons - Fixed positioning to avoid hashtag overlay */}
                        <div className="flex mt-6">
                            <button
                                onClick={handlePublishPost}
                                className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                                disabled={isPublishing || platforms.length === 0 || (!editableContent.caption && editableContent.hashtags.filter(tag => tag.trim() !== '').length === 0 && !content.mediaUrl)}
                            >
                                {isPublishing ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Publishing...
                                    </>
                                ) : (
                                    '🚀 Publish Now'
                                )}
                            </button>
                        </div>

                        {/* Platform Constraints Warning */}
                        {platforms.length > 0 && (
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
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default PlatformPreviewPanel; 