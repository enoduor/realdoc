import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ContentService from '../api/contentService';
import { PLATFORMS, getCharacterLimit } from '../constants/platforms';
import { useContent } from '../context/ContentContext';

const CaptionGenerator = () => {
    
    const { updateContent, content } = useContent();
    const [formData, setFormData] = useState({
        platform: content?.platform || 'instagram',
        topic: content?.topic || '',
        tone: content?.tone || 'professional',
        language: content?.language || 'en',
        media_type: content?.media_type || '',
        content_category: content?.content_category || '',
        brand_voice: content?.brand_voice || '',
        cta_type: content?.cta_type || '',
        audience: content?.audience || ''
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
            console.log('[CaptionGenerator] Platform changed to:', value);
            updateContent({ platform: value });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        setLoading(true);
        setError('');

        try {
            const response = await ContentService.createCaption(formData);
            setCaption(response.caption);
            console.log('[CaptionGenerator] Caption generated, saving to context:', {
                platform: formData.platform,
                topic: formData.topic,
                caption: response.caption.substring(0, 50) + '...'
            });
            updateContent({ 
                captions: [response.caption],
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
                    <h1 className="text-xl font-bold">Caption Generator</h1>
                    
                    <Link
                        to="/app"
                        className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-md"
                    >
                        Back to Dashboard
                    </Link>
                </div>
            </header>

            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                
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
                            {/* <label className="block text-sm font-medium mb-1">Describe your post below</label> */}
                            <textarea
                                name="topic"
                                value={formData.topic}
                                onChange={handleInputChange}
                                placeholder="Describe your post content, what it's about, key points you want to highlight, or any specific details you'd like to include..."
                                className="w-full p-3 border rounded-lg resize-none"
                                rows="3"
                                required
                            />
                        </div>

                        {/* Single line layout for all dropdowns */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
                            <div>
                                {/* <label className="block text-xs font-medium mb-1">Platform</label> */}
                                <select
                                    name="platform"
                                    value={formData.platform}
                                    onChange={handleInputChange}
                                    className="w-full p-2 border rounded text-sm"
                                >
                                    {Object.values(PLATFORMS).map((platform) => (
                                        <option key={platform.id} value={platform.id}>
                                            {platform.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                {/* <label className="block text-xs font-medium mb-1">Tone</label> */}
                                <select
                                    name="tone"
                                    value={formData.tone}
                                    onChange={handleInputChange}
                                    className="w-full p-2 border rounded text-sm"
                                >
                                    <option value="">Tone</option>
                                    <option value="professional">Professional</option>
                                    <option value="casual">Casual</option>
                                    <option value="friendly">Friendly</option>
                                    <option value="humorous">Humorous</option>
                                    <option value="formal">Formal</option>
                                </select>
                            </div>

                            <div>
                                {/* <label className="block text-xs font-medium mb-1">Language</label> */}
                                <select
                                    name="language"
                                    value={formData.language}
                                    onChange={handleInputChange}
                                    className="w-full p-2 border rounded text-sm"
                                >
                                    <option value="en">Language</option>
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

                            <div>
                                {/* <label className="block text-xs font-medium mb-1">Media Type</label> */}
                                <select
                                    name="media_type"
                                    value={formData.media_type}
                                    onChange={handleInputChange}
                                    className="w-full p-2 border rounded text-sm"
                                >
                                    <option value="">Media type</option>
                                    <option value="image">Image</option>
                                    <option value="video">Video</option>
                                    <option value="carousel">Carousel</option>
                                    <option value="story">Story</option>
                                </select>
                            </div>

                            <div>
                                {/* <label className="block text-xs font-medium mb-1">Category</label> */}
                                <select
                                    name="content_category"
                                    value={formData.content_category}
                                    onChange={handleInputChange}
                                    className="w-full p-2 border rounded text-sm"
                                >
                                    <option value="">Category</option>
                                    <option value="business">Business</option>
                                    <option value="lifestyle">Lifestyle</option>
                                    <option value="education">Education</option>
                                    <option value="entertainment">Entertainment</option>
                                    <option value="health">Health & Fitness</option>
                                    <option value="food">Food & Cooking</option>
                                    <option value="travel">Travel</option>
                                    <option value="fashion">Fashion</option>
                                    <option value="technology">Technology</option>
                                    <option value="sports">Sports</option>
                                </select>
                            </div>

                            <div>
                                {/* <label className="block text-xs font-medium mb-1">Brand Voice</label> */}
                                <select
                                    name="brand_voice"
                                    value={formData.brand_voice}
                                    onChange={handleInputChange}
                                    className="w-full p-2 border rounded text-sm"
                                >
                                    <option value="">Brand voice</option>
                                    <option value="friendly">Friendly & Approachable</option>
                                    <option value="professional">Professional & Authoritative</option>
                                    <option value="casual">Casual & Conversational</option>
                                    <option value="inspirational">Inspirational & Motivational</option>
                                    <option value="humorous">Humorous & Playful</option>
                                    <option value="educational">Educational & Informative</option>
                                </select>
                            </div>

                            <div>
                                {/* <label className="block text-xs font-medium mb-1">CTA Type</label> */}
                                <select
                                    name="cta_type"
                                    value={formData.cta_type}
                                    onChange={handleInputChange}
                                    className="w-full p-2 border rounded text-sm"
                                >
                                    <option value="">CTA type</option>
                                    <option value="engagement">Engagement</option>
                                    <option value="sales">Sales & Conversions</option>
                                    <option value="awareness">Brand Awareness</option>
                                    <option value="education">Educational Content</option>
                                    <option value="community">Community Building</option>
                                    <option value="none">No CTA</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            {/* <label className="block text-xs font-medium mb-1">Target Audience</label> */}
                            <textarea
                                name="audience"
                                value={formData.audience}
                                onChange={handleInputChange}
                                placeholder="Describe your target audience (age, interests, demographics, etc.)"
                                className="w-full p-2 border rounded text-sm resize-none"
                                rows="3"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={`py-2 px-4 rounded font-medium text-white ${
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
                            <div className="mt-4 flex justify-between">
                                <Link
                                    to="/app/hashtag-generator"
                                    className="px-4 py-2 text-sm bg-purple-600 text-white hover:bg-purple-700 rounded"
                                >
                                    Generate Hashtags
                                </Link>
                                <Link
                                    to="/app/media-upload"
                                    className="px-4 py-2 text-sm bg-green-600 text-white hover:bg-green-700 rounded"
                                >
                                    Upload Media
                                </Link>
                                <Link
                                    to="/app/media-upload"
                                    className="px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded"
                                >
                                    Downloaded Video
                                </Link>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default CaptionGenerator; 