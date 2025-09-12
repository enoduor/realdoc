import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ContentService from '../api/contentService';
import { PLATFORMS, getCharacterLimit } from '../constants/platforms';
import { useContent } from '../context/ContentContext';
import SubscriptionCheck, { useSubscriptionCheck } from './SubscriptionCheck';

const CaptionGenerator = () => {
    console.log('🎯 CaptionGenerator component rendering');
    
    const { updateContent, content } = useContent();
    const { hasSubscription, requireSubscription } = useSubscriptionCheck();
    const [formData, setFormData] = useState({
        platform: content?.platform || 'instagram',
        topic: content?.topic || '',
        tone: content?.tone || 'professional',
        language: content?.language || 'en'
    });
    const [caption, setCaption] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');


    useEffect(() => {
        if (content.platform !== formData.platform) {
            setFormData(prev => ({
                ...prev,
                platform: content.platform
            }));
        }
    }, [content.platform, formData.platform]);

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

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Check subscription before proceeding
        if (!requireSubscription('Caption Generator')) {
            return;
        }
        
        setLoading(true);
        setError('');

        try {
            const response = await ContentService.createCaption(formData);
            setCaption(response.caption);
            updateContent({ 
                caption: response.caption,
                platform: formData.platform,
                topic: formData.topic 
            });
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };


    const platformLimits = PLATFORMS[formData.platform.toUpperCase()];


    return (
        <div className="min-h-screen bg-gray-50">
            {/* Navigation Header */}
            <header className="bg-white shadow">
                <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
                    <h1 className="text-3xl font-bold text-gray-900">Caption Generator</h1>
                    <Link
                        to="/app"
                        className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-md"
                    >
                        Back to Dashboard
                    </Link>
                </div>
            </header>

            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                <SubscriptionCheck featureName="Caption Generator" />
                
                <div className="bg-white shadow rounded-lg p-6">
                    {/* Platform Requirements */}
                    <div className="mb-6 bg-gray-50 p-4 rounded-lg">
                        <h2 className="text-sm font-medium mb-2">Platform Requirements</h2>
                        <ul className="text-sm text-gray-600">
                            <li>Maximum Characters: {platformLimits.maxCharacters}</li>
                            <li>Recommended Style: {platformLimits.prompt_style}</li>
                        </ul>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Platform</label>
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

                        <div>
                            <label className="block text-sm font-medium mb-1">Topic</label>
                            <input
                                type="text"
                                name="topic"
                                value={formData.topic}
                                onChange={handleInputChange}
                                placeholder="What's your post about?"
                                className="w-full p-2 border rounded"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Tone</label>
                            <select
                                name="tone"
                                value={formData.tone}
                                onChange={handleInputChange}
                                className="w-full p-2 border rounded"
                            >
                                <option value="professional">Professional</option>
                                <option value="casual">Casual</option>
                                <option value="friendly">Friendly</option>
                                <option value="humorous">Humorous</option>
                                <option value="formal">Formal</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Language</label>
                            <select
                                name="language"
                                value={formData.language}
                                onChange={handleInputChange}
                                className="w-full p-2 border rounded"
                            >
                                <option value="en">English</option>
                                <option value="es">Spanish</option>
                                <option value="fr">French</option>
                                <option value="de">German</option>
                                <option value="pt">Portuguese</option>
                                <option value="it">Italian</option>
                                <option value="nl">Dutch</option>
                                <option value="ru">Russian</option>
                                <option value="uk">Ukrainian</option>
                                <option value="pl">Polish</option>
                                <option value="cs">Czech</option>
                                <option value="sv">Swedish</option>
                                <option value="no">Norwegian</option>
                                <option value="da">Danish</option>
                                <option value="fi">Finnish</option>
                                <option value="el">Greek</option>
                                <option value="tr">Turkish</option>
                                <option value="ro">Romanian</option>
                                <option value="hu">Hungarian</option>
                                <option value="bg">Bulgarian</option>
                                <option value="he">Hebrew</option>
                                <option value="ar">Arabic</option>
                                <option value="fa">Persian</option>
                                <option value="ur">Urdu</option>
                                <option value="hi">Hindi</option>
                                <option value="bn">Bengali</option>
                                <option value="mr">Marathi</option>
                                <option value="gu">Gujarati</option>
                                <option value="pa">Punjabi</option>
                                <option value="ta">Tamil</option>
                                <option value="te">Telugu</option>
                                <option value="kn">Kannada</option>
                                <option value="ml">Malayalam</option>
                                <option value="si">Sinhala</option>
                                <option value="th">Thai</option>
                                <option value="vi">Vietnamese</option>
                                <option value="id">Indonesian</option>
                                <option value="ms">Malay</option>
                                <option value="fil">Filipino</option>
                                <option value="zh-CN">Chinese (Simplified)</option>
                                <option value="zh-TW">Chinese (Traditional)</option>
                                <option value="ja">Japanese</option>
                                <option value="ko">Korean</option>
                                <option value="sw">Swahili</option>
                                <option value="sw-KE">Swahili (Kenya)</option>
                                <option value="sw-TZ">Swahili (Tanzania)</option>
                            </select>
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
                            {loading ? 'Generating...' : 'Generate Caption'}
                        </button>
                    </form>

                    {error && (
                        <div className="mt-4 p-3 bg-red-100 text-red-700 rounded">
                            {error}
                        </div>
                    )}

                    {caption && (
                        <div className="mt-6">
                            <h3 className="text-lg font-medium mb-2">Generated Caption:</h3>
                            <div className="p-4 bg-gray-100 rounded">
                                <p className="whitespace-pre-wrap">{caption}</p>
                                <div className="mt-2 text-sm text-gray-500">
                                    Characters: {caption.length} / {platformLimits.maxCharacters}
                                </div>
                            </div>
                            <button
                                onClick={() => navigator.clipboard.writeText(caption)}
                                className="mt-2 px-4 py-2 text-sm text-blue-600 hover:text-blue-800"
                            >
                                Copy to Clipboard
                            </button>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default CaptionGenerator; 