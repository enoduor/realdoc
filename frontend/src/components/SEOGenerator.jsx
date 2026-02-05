import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import usePaymentModal from './PaymentModal';


const SEOGenerator = () => {
    
    const [formData, setFormData] = useState({
        website_url: '',
        business_type: 'saas',
        target_keywords: '',
        current_seo_issues: '',
        focus_areas: ['on-page', 'technical', 'content'],
        language: 'en'
    });
    
    const [seoReport, setSeoReport] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editedReport, setEditedReport] = useState('');
    const [productionMetaTags, setProductionMetaTags] = useState(null);
    const [rewriteLoading, setRewriteLoading] = useState(false);
    const [qaResult, setQaResult] = useState(null);
    const [aiOptimizedRecommendations, setAiOptimizedRecommendations] = useState(null);
    const [recommendationsLoading, setRecommendationsLoading] = useState(false);

    const handleInputChange = (e) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            const checked = e.target.checked;
            setFormData(prev => ({
                ...prev,
                focus_areas: checked
                    ? [...prev.focus_areas, value]
                    : prev.focus_areas.filter(area => area !== value)
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                [name]: value
            }));
        }
    };

    // Normalize URL - add https:// if missing
    const normalizeUrl = (url) => {
        if (!url) return '';
        url = url.trim();
        // Remove trailing slashes
        url = url.replace(/\/+$/, '');
        // Add https:// if no protocol
        if (!url.match(/^https?:\/\//i)) {
            url = `https://${url}`;
        }
        return url;
    };

    // Use payment modal hook
    const { createCheckoutSession, loading: paymentLoading, ErrorModalComponent } = usePaymentModal({
        formData,
        validateForm: () => {
            if (!formData.website_url || !formData.website_url.trim()) {
                return { valid: false, error: 'Please enter a website URL' };
            }
            return { valid: true };
        },
        onPaymentSuccess: async (savedFormData) => {
            try {
                setLoading(true);
                setError('');
                
                // Generate SEO report with saved form data
                const ORIGIN = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
                const isLocalhost = ORIGIN.includes('localhost') || ORIGIN.includes('127.0.0.1');
                const PYTHON_API_BASE_URL = process.env.REACT_APP_AI_API || 
                    (isLocalhost ? 'http://localhost:5001' : `${ORIGIN}/ai`);
                
                const normalizedUrl = normalizeUrl(savedFormData.website_url);
                const requestData = {
                    ...savedFormData,
                    website_url: normalizedUrl
                };
                
                const response = await axios.post(`${PYTHON_API_BASE_URL}/api/v1/seo/`, requestData, {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 300000
                });
                
                setSeoReport(response.data);
                setEditedReport(response.data.report);
                setIsEditing(false);
            } catch (err) {
                const errorMessage = err?.response?.data?.detail || 
                    err?.response?.data?.message || 
                    err?.message || 
                    'Failed to generate SEO report';
                setError(`Error: ${errorMessage}. Please check that the URL is correct and accessible.`);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        successRedirectPath: '/seo-generator',
        cancelRedirectPath: '/seo-generator'
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        await createCheckoutSession();
    };

    const handleDownload = () => {
        const reportToDownload = isEditing ? editedReport : (seoReport?.report || '');
        if (!reportToDownload) return;
        
        const filename = `SEO_Report_${formData.website_url.replace(/https?:\/\//, '').replace(/\//g, '_')}.md`;
        const blob = new Blob([reportToDownload], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleEdit = () => {
        setEditedReport(seoReport.report);
        setIsEditing(true);
    };

    const handleSave = () => {
        if (!seoReport) return;
        
        const updatedReport = {
            ...seoReport,
            report: editedReport,
            word_count: editedReport.split(/\s+/).filter(word => word.length > 0).length,
            estimated_read_time: Math.max(1, Math.round(editedReport.split(/\s+/).filter(word => word.length > 0).length / 200))
        };
        
        setSeoReport(updatedReport);
        setIsEditing(false);
        
        try {
            const savedReports = JSON.parse(localStorage.getItem('realdoc_saved_seo_reports') || '[]');
            const reportToSave = {
                ...updatedReport,
                website_url: formData.website_url,
                timestamp: new Date().toISOString()
            };
            
            const existingIndex = savedReports.findIndex(
                (r) => r.website_url === formData.website_url
            );
            
            if (existingIndex >= 0) {
                savedReports[existingIndex] = reportToSave;
            } else {
                savedReports.push(reportToSave);
            }
            
            localStorage.setItem('realdoc_saved_seo_reports', JSON.stringify(savedReports));
        } catch (e) {
            console.error('Failed to save to localStorage:', e);
        }
    };

    const handleCancel = () => {
        setEditedReport(seoReport.report);
        setIsEditing(false);
    };

    const handleCopyToClipboard = () => {
        const reportToCopy = isEditing ? editedReport : (seoReport?.report || '');
        if (reportToCopy) {
            navigator.clipboard.writeText(reportToCopy);
            alert('SEO Report copied to clipboard!');
        }
    };

    const handleGenerateMetaTags = async () => {
        if (!formData.website_url) {
            alert('Please enter a website URL first');
            return;
        }
        
        setLoading(true);
        try {
            const ORIGIN = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
            // Always use current origin in browser (ALB routes /ai/* to Python backend)
            // Only use localhost if explicitly in development and ORIGIN is localhost
            const isLocalhost = ORIGIN.includes('localhost') || ORIGIN.includes('127.0.0.1');
            const PYTHON_API_BASE_URL = process.env.REACT_APP_AI_API || 
                (isLocalhost ? 'http://localhost:5001' : `${ORIGIN}/ai`);
            
            const normalizedUrl = normalizeUrl(formData.website_url);
            const response = await axios.post(`${PYTHON_API_BASE_URL}/api/v1/seo/production-meta-tags`, {
                website_url: normalizedUrl,
                page_type: 'homepage',
                business_type: formData.business_type,
                target_keywords: formData.target_keywords
            });
            
            setProductionMetaTags(response.data);
        } catch (err) {
            alert(`Error generating meta tags: ${err?.response?.data?.detail || err?.message || 'Unknown error'}`);
        } finally {
            setLoading(false);
        }
    };

    const handleAIRewrite = async (rewriteType = 'improve') => {
        const contentToRewrite = isEditing ? editedReport : (seoReport?.report || '');
        if (!contentToRewrite) {
            alert('No content to rewrite');
            return;
        }
        
        setRewriteLoading(true);
        try {
            const ORIGIN = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
            // Always use current origin in browser (ALB routes /ai/* to Python backend)
            // Only use localhost if explicitly in development and ORIGIN is localhost
            const isLocalhost = ORIGIN.includes('localhost') || ORIGIN.includes('127.0.0.1');
            const PYTHON_API_BASE_URL = process.env.REACT_APP_AI_API || 
                (isLocalhost ? 'http://localhost:5001' : `${ORIGIN}/ai`);
            
            const response = await axios.post(`${PYTHON_API_BASE_URL}/api/v1/seo/rewrite`, {
                content: contentToRewrite,
                rewrite_type: rewriteType,
                focus: 'SEO optimization'
            });
            
            if (isEditing) {
                setEditedReport(response.data.rewritten_content);
            } else {
                setSeoReport({
                    ...seoReport,
                    report: response.data.rewritten_content,
                    word_count: response.data.rewritten_length
                });
                setEditedReport(response.data.rewritten_content);
            }
            alert('Content rewritten successfully!');
        } catch (err) {
            alert(`Error rewriting content: ${err?.response?.data?.detail || err?.message || 'Unknown error'}`);
        } finally {
            setRewriteLoading(false);
        }
    };

    const handleQualityCheck = async () => {
        const reportToCheck = isEditing ? editedReport : (seoReport?.report || '');
        if (!reportToCheck) {
            alert('No report to check');
            return;
        }
        
        try {
            const ORIGIN = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
            // Always use current origin in browser (ALB routes /ai/* to Python backend)
            // Only use localhost if explicitly in development and ORIGIN is localhost
            const isLocalhost = ORIGIN.includes('localhost') || ORIGIN.includes('127.0.0.1');
            const PYTHON_API_BASE_URL = process.env.REACT_APP_AI_API || 
                (isLocalhost ? 'http://localhost:5001' : `${ORIGIN}/ai`);
            
            const response = await axios.post(`${PYTHON_API_BASE_URL}/api/v1/seo/quality-check`, {
                report: reportToCheck,
                website_url: formData.website_url
            });
            
            setQaResult(response.data);
        } catch (err) {
            alert(`Error checking quality: ${err?.response?.data?.detail || err?.message || 'Unknown error'}`);
        }
    };

    const handleGenerateAIRecommendations = async () => {
        const reportToUse = isEditing ? editedReport : (seoReport?.report || '');
        if (!reportToUse) {
            alert('Please generate an SEO report first');
            return;
        }
        
        setRecommendationsLoading(true);
        try {
            const ORIGIN = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
            const isLocalhost = ORIGIN.includes('localhost') || ORIGIN.includes('127.0.0.1');
            const PYTHON_API_BASE_URL = process.env.REACT_APP_AI_API || 
                (isLocalhost ? 'http://localhost:5001' : `${ORIGIN}/ai`);
            
            const response = await axios.post(`${PYTHON_API_BASE_URL}/api/v1/seo/ai-optimized-recommendations`, {
                website_url: formData.website_url,
                seo_report: reportToUse,
                business_type: formData.business_type,
                target_keywords: formData.target_keywords || null
            });
            
            setAiOptimizedRecommendations(response.data);
        } catch (err) {
            alert(`Error generating recommendations: ${err?.response?.data?.detail || err?.message || 'Unknown error'}`);
        } finally {
            setRecommendationsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Navigation Header */}
            <header className="bg-white shadow">
                <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
                    <div>
                        <h1 className="text-xl font-bold">SEO Setup & Optimization</h1>
                        <p className="text-sm text-gray-600 mt-1">AI-powered SEO analysis and recommendations for your website</p>
                    </div>
                    
                    <Link
                        to="/"
                        className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-md"
                    >
                        Back to Home
                    </Link>
                </div>
            </header>

            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                <div className="bg-white shadow rounded-lg p-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* SEO Focus Areas Selector */}
                        <div>
                            <label className="block text-sm font-medium mb-3">Select SEO Focus Areas *</label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                                {[
                                    { id: 'technical', name: 'Technical SEO', icon: '⚙️' },
                                    { id: 'on-page', name: 'On-Page SEO', icon: '📄' },
                                    { id: 'content', name: 'Content SEO', icon: '📝' },
                                    { id: 'off-page', name: 'Off-Page SEO', icon: '🔗' },
                                    { id: 'local', name: 'Local SEO', icon: '📍' },
                                    { id: 'mobile', name: 'Mobile SEO', icon: '📱' },
                                    { id: 'speed', name: 'Page Speed', icon: '⚡' },
                                    { id: 'accessibility', name: 'Accessibility', icon: '♿' }
                                ].map(area => (
                                    <div
                                        key={area.id}
                                        onClick={() => {
                                            const isSelected = formData.focus_areas.includes(area.id);
                                            setFormData(prev => ({
                                                ...prev,
                                                focus_areas: isSelected
                                                    ? prev.focus_areas.filter(a => a !== area.id)
                                                    : [...prev.focus_areas, area.id]
                                            }));
                                        }}
                                        className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                                            formData.focus_areas.includes(area.id)
                                                ? 'border-blue-600 bg-blue-50 shadow-md'
                                                : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                                        }`}
                                    >
                                        <div className="text-2xl mb-2 text-center">{area.icon}</div>
                                        <div className="text-sm font-medium text-center">{area.name}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Basic Information */}
                        <div>
                            <label className="block text-sm font-medium mb-1">Website URL *</label>
                            <input
                                type="url"
                                name="website_url"
                                value={formData.website_url}
                                onChange={handleInputChange}
                                placeholder="https://example.com"
                                className="w-full p-2 border rounded"
                                required
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Enter your website URL for comprehensive SEO analysis
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Business Type *</label>
                                <select
                                    name="business_type"
                                    value={formData.business_type}
                                    onChange={handleInputChange}
                                    className="w-full p-2 border rounded"
                                    required
                                >
                                    <option value="saas">SaaS</option>
                                    <option value="ecommerce">E-commerce</option>
                                    <option value="blog">Blog/Content</option>
                                    <option value="portfolio">Portfolio</option>
                                    <option value="corporate">Corporate</option>
                                    <option value="nonprofit">Non-profit</option>
                                    <option value="other">Other</option>
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
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Target Keywords (Optional)</label>
                            <input
                                type="text"
                                name="target_keywords"
                                value={formData.target_keywords}
                                onChange={handleInputChange}
                                placeholder="keyword1, keyword2, keyword3"
                                className="w-full p-2 border rounded"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Comma-separated list of keywords you want to rank for
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Current SEO Issues (Optional)</label>
                            <textarea
                                name="current_seo_issues"
                                value={formData.current_seo_issues}
                                onChange={handleInputChange}
                                placeholder="Describe any known SEO issues or areas you'd like to focus on..."
                                className="w-full p-3 border rounded-lg resize-none"
                                rows="3"
                            />
                        </div>

                        {/* Detailed Analysis Options Based on Selected Focus Areas */}
                        {formData.focus_areas.length > 0 && (
                            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <h3 className="text-sm font-semibold text-blue-900 mb-3">
                                    Detailed Analysis Options for Selected Focus Areas:
                                </h3>
                                <div className="space-y-3">
                                    {formData.focus_areas.includes('technical') && (
                                        <div className="text-sm">
                                            <strong className="text-blue-800">⚙️ Technical SEO:</strong>
                                            <p className="text-blue-700 mt-1">Will analyze site structure, crawlability, sitemaps, robots.txt, schema markup, HTTPS, page speed, mobile responsiveness, and technical errors.</p>
                                        </div>
                                    )}
                                    {formData.focus_areas.includes('on-page') && (
                                        <div className="text-sm">
                                            <strong className="text-blue-800">📄 On-Page SEO:</strong>
                                            <p className="text-blue-700 mt-1">Will analyze title tags, meta descriptions, header structure (H1-H6), URL structure, internal linking, image alt text, and content optimization.</p>
                                        </div>
                                    )}
                                    {formData.focus_areas.includes('content') && (
                                        <div className="text-sm">
                                            <strong className="text-blue-800">📝 Content SEO:</strong>
                                            <p className="text-blue-700 mt-1">Will analyze content quality, keyword targeting, E-A-T signals, content depth, freshness, readability, and content gaps.</p>
                                        </div>
                                    )}
                                    {formData.focus_areas.includes('off-page') && (
                                        <div className="text-sm">
                                            <strong className="text-blue-800">🔗 Off-Page SEO:</strong>
                                            <p className="text-blue-700 mt-1">Will analyze backlink profile, domain authority, social signals, brand mentions, and link building opportunities.</p>
                                        </div>
                                    )}
                                    {formData.focus_areas.includes('local') && (
                                        <div className="text-sm">
                                            <strong className="text-blue-800">📍 Local SEO:</strong>
                                            <p className="text-blue-700 mt-1">Will analyze Google Business Profile optimization, local citations, NAP consistency, local keywords, and local link building.</p>
                                        </div>
                                    )}
                                    {formData.focus_areas.includes('mobile') && (
                                        <div className="text-sm">
                                            <strong className="text-blue-800">📱 Mobile SEO:</strong>
                                            <p className="text-blue-700 mt-1">Will analyze mobile-first indexing readiness, responsive design, mobile page speed, mobile usability, and AMP implementation.</p>
                                        </div>
                                    )}
                                    {formData.focus_areas.includes('speed') && (
                                        <div className="text-sm">
                                            <strong className="text-blue-800">⚡ Page Speed:</strong>
                                            <p className="text-blue-700 mt-1">Will analyze Core Web Vitals (LCP, FID, CLS), page load times, resource optimization, caching, and performance bottlenecks.</p>
                                        </div>
                                    )}
                                    {formData.focus_areas.includes('accessibility') && (
                                        <div className="text-sm">
                                            <strong className="text-blue-800">♿ Accessibility:</strong>
                                            <p className="text-blue-700 mt-1">Will analyze WCAG compliance, screen reader compatibility, keyboard navigation, ARIA labels, color contrast, and accessibility best practices.</p>
                                        </div>
                                    )}
                                </div>
                                <p className="text-xs text-blue-600 mt-3 italic">
                                    The AI will provide comprehensive analysis and actionable recommendations for all selected focus areas.
                                </p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || paymentLoading}
                            className={`py-2 px-4 rounded font-medium text-white ${
                                (loading || paymentLoading)
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                        >
                            {(loading || paymentLoading) ? 'Processing...' : 'Generate SEO Report'}
                        </button>
                        
                        {loading && (
                            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                                <p className="text-sm text-blue-800">
                                    <strong>Processing:</strong> Crawling {formData.website_url || 'website'} and generating comprehensive SEO analysis. This may take 1-2 minutes...
                                </p>
                            </div>
                        )}
                    </form>

                    {error && (
                        <div className="mt-4 p-3 bg-red-100 text-red-700 rounded">
                            {error}
                        </div>
                    )}

                    {seoReport && (
                        <div className="mt-6">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="text-lg font-medium">
                                    {isEditing ? 'Editing SEO Report' : 'SEO Analysis Report'}
                                </h3>
                                <div className="flex gap-2">
                                    {isEditing ? (
                                        <>
                                            <button
                                                onClick={handleSave}
                                                className="px-3 py-1 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded"
                                            >
                                                Save Changes
                                            </button>
                                            <button
                                                onClick={handleCancel}
                                                className="px-3 py-1 text-sm bg-gray-500 text-white hover:bg-gray-600 rounded"
                                            >
                                                Cancel
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                onClick={handleEdit}
                                                className="px-3 py-1 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleAIRewrite('improve')}
                                                disabled={rewriteLoading}
                                                className="px-3 py-1 text-sm bg-purple-600 text-white hover:bg-purple-700 rounded disabled:bg-gray-400"
                                            >
                                                {rewriteLoading ? 'Rewriting...' : 'AI Rewrite'}
                                            </button>
                                            <button
                                                onClick={handleGenerateMetaTags}
                                                disabled={loading}
                                                className="px-3 py-1 text-sm bg-indigo-600 text-white hover:bg-indigo-700 rounded disabled:bg-gray-400"
                                            >
                                                Meta Tags
                                            </button>
                                            <button
                                                onClick={handleGenerateAIRecommendations}
                                                disabled={loading || recommendationsLoading}
                                                className="px-3 py-1 text-sm bg-purple-600 text-white hover:bg-purple-700 rounded disabled:bg-gray-400"
                                            >
                                                {recommendationsLoading ? 'Generating...' : 'AI Recommendations'}
                                            </button>
                                            <button
                                                onClick={handleQualityCheck}
                                                className="px-3 py-1 text-sm bg-yellow-600 text-white hover:bg-yellow-700 rounded"
                                            >
                                                Quality Check
                                            </button>
                                            <button
                                                onClick={handleCopyToClipboard}
                                                className="px-3 py-1 text-sm bg-gray-600 text-white hover:bg-gray-700 rounded"
                                            >
                                                Copy
                                            </button>
                                            <button
                                                onClick={handleDownload}
                                                className="px-3 py-1 text-sm bg-green-600 text-white hover:bg-green-700 rounded"
                                            >
                                                Download (MD)
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                            
                            <div className="mb-2 text-sm text-gray-600">
                                <span>Words: {isEditing ? editedReport.split(/\s+/).filter(word => word.length > 0).length : seoReport.word_count}</span>
                                <span className="ml-4">Est. Read Time: {isEditing ? Math.max(1, Math.round(editedReport.split(/\s+/).filter(word => word.length > 0).length / 200)) : seoReport.estimated_read_time} min</span>
                            </div>

                            {isEditing ? (
                                <div className="p-4 bg-white rounded border">
                                    <textarea
                                        value={editedReport}
                                        onChange={(e) => setEditedReport(e.target.value)}
                                        className="w-full p-4 border rounded-lg font-mono text-sm"
                                        rows={20}
                                        style={{ 
                                            minHeight: '400px',
                                            fontFamily: 'monospace',
                                            whiteSpace: 'pre-wrap',
                                            textAlign: 'left'
                                        }}
                                    />
                                </div>
                            ) : (
                                <div className="p-4 bg-gray-100 rounded border">
                                    <pre className="whitespace-pre-wrap font-mono text-sm text-left" style={{ textAlign: 'left' }}>{seoReport.report}</pre>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Quality Assurance Results */}
                    {qaResult && (
                        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <h4 className="font-semibold mb-2">Quality Assurance Check</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                    <strong>Quality Score:</strong> {qaResult.quality_score}/100
                                    <span className={`ml-2 ${qaResult.quality_score >= 90 ? 'text-green-600' : qaResult.quality_score >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                                        ({qaResult.status})
                                    </span>
                                </div>
                                <div><strong>Word Count:</strong> {qaResult.word_count}</div>
                                <div><strong>Sections:</strong> {qaResult.sections_found}</div>
                                <div>
                                    <strong>Checks:</strong> 
                                    {qaResult.has_meta_tags && ' ✓ Meta'}
                                    {qaResult.has_schema && ' ✓ Schema'}
                                    {qaResult.has_keywords && ' ✓ Keywords'}
                                    {qaResult.has_competitor_analysis && ' ✓ Competitor'}
                                </div>
                            </div>
                            {qaResult.issues && qaResult.issues.length > 0 && (
                                <div className="mt-3">
                                    <strong>Issues Found:</strong>
                                    <ul className="list-disc list-inside mt-1">
                                        {qaResult.issues.map((issue, idx) => (
                                            <li key={idx} className="text-red-700">{issue}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    {/* AI Optimized Recommendations */}
                    {aiOptimizedRecommendations && (
                        <div className="mt-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                            <div className="flex justify-between items-center mb-3">
                                <h4 className="font-semibold">AI Optimized SEO Recommendations</h4>
                                <button
                                    onClick={() => {
                                        const text = aiOptimizedRecommendations.recommendations;
                                        navigator.clipboard.writeText(text);
                                        alert('Recommendations copied to clipboard!');
                                    }}
                                    className="px-3 py-1 text-sm bg-purple-600 text-white hover:bg-purple-700 rounded"
                                >
                                    Copy
                                </button>
                            </div>
                            <p className="text-sm text-gray-600 mb-3">
                                Prioritized, actionable recommendations with complete code examples you can implement directly.
                            </p>
                            <div className="p-4 bg-white rounded border">
                                <pre className="whitespace-pre-wrap font-mono text-sm text-left" style={{ textAlign: 'left' }}>
                                    {aiOptimizedRecommendations.recommendations}
                                </pre>
                            </div>
                        </div>
                    )}

                    {/* Production Meta Tags */}
                    {productionMetaTags && (
                        <div className="mt-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                            <h4 className="font-semibold mb-3">Production-Ready Meta Tags & Schema</h4>
                            <div className="space-y-4">
                                <div>
                                    <h5 className="font-medium mb-2">Meta Tags:</h5>
                                    <pre className="bg-white p-3 rounded border text-xs overflow-x-auto">{productionMetaTags.meta_tags || productionMetaTags.full_code}</pre>
                                </div>
                                {productionMetaTags.schema_markup && (
                                    <div>
                                        <h5 className="font-medium mb-2">Schema Markup (JSON-LD):</h5>
                                        <pre className="bg-white p-3 rounded border text-xs overflow-x-auto">{productionMetaTags.schema_markup}</pre>
                                    </div>
                                )}
                                {productionMetaTags.open_graph && (
                                    <div>
                                        <h5 className="font-medium mb-2">Open Graph Tags:</h5>
                                        <pre className="bg-white p-3 rounded border text-xs overflow-x-auto">{productionMetaTags.open_graph}</pre>
                                    </div>
                                )}
                                {productionMetaTags.twitter_card && (
                                    <div>
                                        <h5 className="font-medium mb-2">Twitter Card Tags:</h5>
                                        <pre className="bg-white p-3 rounded border text-xs overflow-x-auto">{productionMetaTags.twitter_card}</pre>
                                    </div>
                                )}
                                <button
                                    onClick={() => {
                                        const fullCode = productionMetaTags.full_code || 
                                            `${productionMetaTags.meta_tags}\n\n${productionMetaTags.schema_markup}\n\n${productionMetaTags.open_graph}\n\n${productionMetaTags.twitter_card}`;
                                        navigator.clipboard.writeText(fullCode);
                                        alert('Meta tags copied to clipboard!');
                                    }}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                                >
                                    Copy All Code
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Payment Error Modal */}
            {ErrorModalComponent}
        </div>
    );
};

export default SEOGenerator;

