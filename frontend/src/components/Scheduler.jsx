import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PLATFORMS } from '../constants/platforms';
import { useContent } from '../context/ContentContext';
import { useUser } from '@clerk/clerk-react';
import ErrorModal from './ErrorModal';

// Helper function to convert platform names to IDs
const toPlatformId = (name) => {
    if (!name) return 'unknown';
    return name.toString().toLowerCase().replace(/[^a-z0-9]/g, '');
};

const Scheduler = ({ onPublishNow }) => {
    const { content } = useContent();
    const { user } = useUser();
    const [platforms, setPlatforms] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [publishResults, setPublishResults] = useState(null);
    const [errorModal, setErrorModal] = useState({ 
        show: false, 
        title: '', 
        message: '', 
        type: 'error'
    });

    // Clear only error messages after 5 seconds (keep success messages)
    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => {
                setError('');
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [error]);

    const handlePlatformChange = (e) => {
        const { value, checked } = e.target;
        if (checked) {
            setPlatforms(prev => [...prev, value]);
        } else {
            setPlatforms(prev => prev.filter(p => p !== value));
        }
        setError('');
        setSuccess('');
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

    const handlePublishNow = async () => {
        // Clear previous messages
        setError('');
        setSuccess('');

        // Validate inputs
        if (platforms.length === 0) {
            setError('Please select at least one platform');
            return;
        }

        // Validate content
        const validationErrors = validateContent();
        if (validationErrors.length > 0) {
            setError(validationErrors.join('. '));
            return;
        }

        setError('');
        setSuccess('');
        setPublishResults(null);
        setIsPublishing(true);

        try {
            const publishData = {
                platforms,
                content: {
                    mediaUrl: content.mediaUrl,
                    captions: content.captions || [content.caption || ''],
                    hashtags: content.hashtags,
                    mediaType: content.mediaType,
                    privacyStatus: 'unlisted'
                },
                // For now, use backend test token. In production, get from user's profile/db
                refreshToken: user?.publicMetadata?.youtubeRefreshToken || null
            };

            // Debug: log outgoing payload for comparison between pages
            try {
            } catch (_) {
            }

            const result = await onPublishNow(publishData);
            // Debug: log normalized response and expose globally
            try {
            } catch (_) {
            }
            try {
                window.__lastPublish = { source: 'Scheduler', publishData, response: result, timestamp: Date.now() };
            } catch (_) {}
            
            // Show detailed results
            const successCount = result.post.platforms.filter(r => r.success).length;
            const totalCount = result.post.platforms.length;
            
            // Store detailed results for displaying links
            setPublishResults(result.post.platforms);
            
            if (successCount === totalCount) {
                setSuccess(`🚀 Successfully published to all ${totalCount} platforms!`);
            } else {
                setSuccess(`🚀 Published to ${successCount}/${totalCount} platforms. Some failed.`);
            }
            
            // Reset form after successful publishing
            setPlatforms([]);
        } catch (err) {
            setErrorModal({
                show: true,
                title: 'Publish Failed',
                message: 'Failed to publish post: ' + err.message,
                type: 'error'
            });
        } finally {
            setIsPublishing(false);
        }
    };

    const isContentReady = content.caption || content.hashtags?.length > 0 || content.mediaUrl;
    const canPublish = platforms.length > 0 && !isLoading && !isPublishing;

    return (
        <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium mb-4">🚀 Publish Now</h3>
            
            {/* Success Message */}
            {success && (
                <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
                    {success}
                </div>
            )}


            {/* Platform Selection */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                    🎯 Select Platforms
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
                                disabled={isLoading || isPublishing}
                            />
                            <span className="text-sm">
                                {platform.icon} {platform.name}
                            </span>
                        </label>
                    ))}
                </div>
            </div>

            {/* Content Preview */}
            {isContentReady && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <h4 className="text-sm font-medium mb-2">📝 Content Preview:</h4>
                    {content.caption && (
                        <p className="text-sm text-gray-700 mb-2">
                            <strong>Caption:</strong> {content.caption.substring(0, 100)}
                            {content.caption.length > 100 && '...'}
                        </p>
                    )}
                    {content.hashtags && content.hashtags.length > 0 && (
                        <p className="text-sm text-gray-700 mb-2">
                            <strong>Hashtags:</strong> {content.hashtags.slice(0, 3).join(', ')}
                            {content.hashtags.length > 3 && '...'}
                        </p>
                    )}
                    {content.mediaUrl && (
                        <p className="text-sm text-gray-700">
                            <strong>Media:</strong> {content.mediaType || 'File'} attached
                        </p>
                    )}
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-between gap-3">
                <Link
                    to="/app/media-upload"
                    className="px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                >
                    Back to Media Upload
                </Link>
                <button
                    onClick={handlePublishNow}
                    disabled={!canPublish}
                    className="px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center"
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

            {/* Error Modal */}
            <ErrorModal
                isOpen={errorModal.show}
                onClose={() => setErrorModal({ show: false, title: '', message: '', type: 'error' })}
                title={errorModal.title}
                message={errorModal.message}
                type={errorModal.type}
            />
        </div>
    );
};

export default Scheduler;
