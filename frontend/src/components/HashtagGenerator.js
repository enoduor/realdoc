import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ContentService from '../api/contentService';
import { PLATFORMS } from '../constants/platforms';
import { useContent } from '../context/ContentContext';
// Subscription check removed - hashtag generation should be free like caption generation

const HashtagGenerator = () => {
    const { updateContent, content } = useContent();
    const [formData, setFormData] = useState({
        platform: content.platform || 'instagram',
        topic: content.topic || '',
        count: 5
    });
    const [hashtags, setHashtags] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const platformLimits = PLATFORMS[formData.platform.toUpperCase()];

    useEffect(() => {
        if (content.platform !== formData.platform) {
            setFormData(prev => ({
                ...prev,
                platform: content.platform
            }));
        }
    }, [content.platform]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'count' ? Math.min(parseInt(value), platformLimits.maxHashtags) : value
        }));
        
        if (name === 'platform') {
            updateContent({ platform: value });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Hashtag generation is free - no subscription check needed
        
        setLoading(true);
        setError('');

        try {
            const response = await ContentService.createHashtags(formData);
            setHashtags(response.hashtags);
            updateContent({ 
                hashtags: response.hashtags,
                platform: formData.platform,
                topic: formData.topic 
            });
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };


    return (
        <div className="min-h-screen bg-gray-50">
            {/* Navigation Header */}
            <header className="bg-white shadow">
                <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
                    <h1 className="text-3xl font-bold text-gray-900">Hashtag Generator</h1>
                    <Link
                        to="/app"
                        className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-md"
                    >
                        Back to Dashboard
                    </Link>
                </div>
            </header>

            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                {/* Subscription check removed - hashtag generation is free */}
                
                <div className="bg-white shadow rounded-lg p-6">
                    {/* Platform Requirements */}
                    <div className="mb-6 bg-gray-50 p-4 rounded-lg">
                        <h2 className="text-sm font-medium mb-2">Platform Requirements</h2>
                        <ul className="text-sm text-gray-600">
                            <li>Maximum Hashtags: {platformLimits.maxHashtags}</li>
                            <li>Recommended Count: {platformLimits.recommended_hashtags}</li>
                        </ul>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Platform</label>
                            <select
                                name="platform"
                                value={formData.platform}
                                onChange={handleInputChange}
                                className="w-full p-3 border rounded-lg"
                            >
                                {Object.values(PLATFORMS).map((platform) => (
                                    <option key={platform.id} value={platform.id}>
                                        {platform.icon} {platform.name} (max {platform.maxHashtags} hashtags)
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Describe your post below</label>
                            <textarea
                                name="topic"
                                value={formData.topic}
                                onChange={handleInputChange}
                                placeholder="Describe your post content, what it's about, key points you want to highlight, or any specific details you'd like to include..."
                                className="w-full p-3 border rounded-lg resize-none"
                                rows="4"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">
                                Number of Hashtags (max {platformLimits.maxHashtags})
                            </label>
                            <input
                                type="number"
                                name="count"
                                value={formData.count}
                                onChange={handleInputChange}
                                min="1"
                                max={platformLimits.maxHashtags}
                                className="w-full p-3 border rounded-lg"
                            />
                            <p className="mt-1 text-sm text-gray-500">
                                Recommended: {platformLimits.recommended_hashtags} hashtags for {platformLimits.name}
                            </p>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full py-2 px-4 rounded font-medium text-white ${
                                loading 
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                        >
                            {loading ? 'Generating...' : 'Generate Hashtags'}
                        </button>
                    </form>

                    {error && (
                        <div className="mt-4 p-3 bg-red-100 text-red-700 rounded">
                            {error}
                        </div>
                    )}

                    {hashtags.length > 0 && (
                        <div className="mt-6">
                            <h3 className="text-lg font-medium mb-2">Generated Hashtags:</h3>
                            <div className="p-4 bg-gray-100 rounded">
                                <div className="flex flex-wrap gap-2">
                                    {hashtags.map((tag, index) => (
                                        <span
                                            key={index}
                                            className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                                <div className="mt-2 text-sm text-gray-500">
                                    Count: {hashtags.length} / {platformLimits.maxHashtags}
                                </div>
                            </div>
                            <div className="mt-4 flex justify-between">
                                <Link
                                    to="/app/caption-generator"
                                    className="px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded"
                                >
                                    Generate Captions
                                </Link>
                                <Link
                                    to="/app/media-upload"
                                    className="px-4 py-2 text-sm bg-green-600 text-white hover:bg-green-700 rounded"
                                >
                                    Upload Media
                                </Link>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default HashtagGenerator; 