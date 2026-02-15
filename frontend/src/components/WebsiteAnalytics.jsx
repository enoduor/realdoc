import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useUser, useClerk } from '@clerk/clerk-react';
import usePaymentModal from './PaymentModal';
import { markdownToHtml, analyticsReportToMarkdown } from '../utils/formatConverter';

const WebsiteAnalytics = () => {
    const { isLoaded, isSignedIn, user } = useUser();
    const { openSignIn } = useClerk();
    const [formData, setFormData] = useState({
        website_url: '',
        competitor_urls: '',
        analysis_depth: 'comprehensive',
        include_revenue_analysis: true,
        include_traffic_analysis: true,
        include_competitor_comparison: true,
        language: 'en'
    });
    
    const [analyticsReport, setAnalyticsReport] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editedReport, setEditedReport] = useState('');
    const [viewFormat, setViewFormat] = useState('markdown'); // 'markdown' or 'html'
    const [enableJsRender, setEnableJsRender] = useState(false);
    const [productionMetaTags, setProductionMetaTags] = useState(null);
    const [rewriteLoading, setRewriteLoading] = useState(false);
    const [qaResult, setQaResult] = useState(null);
    const [aiOptimizedRecommendations, setAiOptimizedRecommendations] = useState(null);
    const [recommendationsLoading, setRecommendationsLoading] = useState(false);
    const [actionPointsViewFormat, setActionPointsViewFormat] = useState('markdown'); // 'markdown' or 'html'

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
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

    // Normalize competitor URLs
    const normalizeCompetitorUrls = (urlsString) => {
        if (!urlsString || !urlsString.trim()) return null;
        const urls = urlsString.split(',').map(url => normalizeUrl(url.trim())).filter(url => url);
        return urls.length > 0 ? urls : null;
    };

    const handlePaidAndGenerate = async (savedFormData) => {
            try {
                setLoading(true);
                setError('');
                
                // Generate analytics report with saved form data
                const ORIGIN = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
                const isLocalhost = ORIGIN.includes('localhost') || ORIGIN.includes('127.0.0.1');
                const PYTHON_API_BASE_URL = process.env.REACT_APP_AI_API || 
                    (isLocalhost ? 'http://localhost:5001' : `${ORIGIN}/ai`);
                
                const normalizedUrl = normalizeUrl(savedFormData.website_url);
                const normalizedCompetitors = normalizeCompetitorUrls(savedFormData.competitor_urls);
                
                const requestData = {
                    ...savedFormData,
                    website_url: normalizedUrl,
                    competitor_urls: normalizedCompetitors ? normalizedCompetitors.join(', ') : null,
                    enable_js_render: enableJsRender,
                };
                
                const response = await axios.post(`${PYTHON_API_BASE_URL}/api/v1/analytics/`, requestData, {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 300000
                });
                
                const reportMarkdown = analyticsReportToMarkdown(response.data.report);
                setAnalyticsReport({ ...response.data, report: reportMarkdown });
                setEditedReport(reportMarkdown);
                setIsEditing(false);
            } catch (err) {
                const errorMessage = err?.response?.data?.detail || 
                    err?.response?.data?.message || 
                    err?.message || 
                    'Failed to generate analytics report';
                setError(`Error: ${errorMessage}. Please check that the URLs are correct and accessible.`);
                throw err;
            } finally {
                setLoading(false);
            }
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
        onPaymentSuccess: handlePaidAndGenerate,
        successRedirectPath: '/website-analytics',
        cancelRedirectPath: '/website-analytics'
    });

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!isLoaded) {
            return;
        }

        if (!isSignedIn) {
            openSignIn({ redirectUrl: `${window.location.origin}/dashboard` });
            return;
        }

        try {
            const base = window.location.origin;
            const res = await fetch(`${base}/api/dashboard/subscription-status?clerkUserId=${encodeURIComponent(user.id)}`);
            const data = await res.json();

            const hasActive =
                data && data.success && data.hasActiveSubscription;

            if (hasActive) {
                try {
                    await handlePaidAndGenerate(formData);
                } catch (_e) {
                    // handlePaidAndGenerate already sets user-visible error state
                }
                return;
            }
        } catch (err) {
            console.error('Error checking subscription status before analytics checkout', err);
            // Fall through to checkout
        }

        await createCheckoutSession({
            clerkUserId: user.id,
            email: user.primaryEmailAddress?.emailAddress || '',
            firstName: user.firstName || '',
            lastName: user.lastName || ''
        });
    };

    const handleDownload = () => {
        const reportToDownload = isEditing ? editedReport : (analyticsReport?.report || '');
        if (!reportToDownload) return;
        
        // Download in current view format
        const content = viewFormat === 'html' ? markdownToHtml(reportToDownload) : reportToDownload;
        const extension = viewFormat === 'html' ? '.html' : '.md';
        const mimeType = viewFormat === 'html' ? 'text/html' : 'text/markdown';
        const filename = `Analytics_Report_${formData.website_url.replace(/https?:\/\//, '').replace(/\//g, '_')}${extension}`;
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleToggleFormat = () => {
        setViewFormat(prev => prev === 'markdown' ? 'html' : 'markdown');
    };

    const handleEdit = () => {
        setEditedReport(analyticsReport.report);
        setIsEditing(true);
    };

    const handleSave = () => {
        if (!analyticsReport) return;
        
        const updatedReport = {
            ...analyticsReport,
            report: editedReport,
            word_count: editedReport.split(/\s+/).filter(word => word.length > 0).length,
            estimated_read_time: Math.max(1, Math.round(editedReport.split(/\s+/).filter(word => word.length > 0).length / 200))
        };
        
        setAnalyticsReport(updatedReport);
        setIsEditing(false);
        
        try {
            const savedReports = JSON.parse(localStorage.getItem('realdoc_saved_analytics_reports') || '[]');
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
            
            localStorage.setItem('realdoc_saved_analytics_reports', JSON.stringify(savedReports));
        } catch (e) {
            console.error('Failed to save to localStorage:', e);
        }
    };

    const handleCancel = () => {
        setEditedReport(analyticsReport.report);
        setIsEditing(false);
    };

    const handleCopyToClipboard = () => {
        const reportToCopy = isEditing ? editedReport : (analyticsReport?.report || '');
        if (reportToCopy) {
            navigator.clipboard.writeText(reportToCopy);
            alert('Analytics Report copied to clipboard!');
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
            const isLocalhost = ORIGIN.includes('localhost') || ORIGIN.includes('127.0.0.1');
            const PYTHON_API_BASE_URL = process.env.REACT_APP_AI_API || 
                (isLocalhost ? 'http://localhost:5001' : `${ORIGIN}/ai`);
            
            const normalizedUrl = normalizeUrl(formData.website_url);
            const response = await axios.post(`${PYTHON_API_BASE_URL}/api/v1/seo/production-meta-tags`, {
                website_url: normalizedUrl,
                page_type: 'homepage',
                business_type: 'saas',
                target_keywords: null
            });
            
            setProductionMetaTags(response.data);
        } catch (err) {
            alert(`Error generating meta tags: ${err?.response?.data?.detail || err?.message || 'Unknown error'}`);
        } finally {
            setLoading(false);
        }
    };

    const handleAIRewrite = async (rewriteType = 'improve') => {
        const contentToRewrite = isEditing ? editedReport : (analyticsReport?.report || '');
        if (!contentToRewrite) {
            alert('No content to rewrite');
            return;
        }
        
        setRewriteLoading(true);
        try {
            const ORIGIN = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
            const isLocalhost = ORIGIN.includes('localhost') || ORIGIN.includes('127.0.0.1');
            const PYTHON_API_BASE_URL = process.env.REACT_APP_AI_API || 
                (isLocalhost ? 'http://localhost:5001' : `${ORIGIN}/ai`);
            
            const response = await axios.post(`${PYTHON_API_BASE_URL}/api/v1/analytics/rewrite`, {
                content: contentToRewrite,
                rewrite_type: rewriteType,
                website_url: formData.website_url || null
            });
            
            if (isEditing) {
                setEditedReport(response.data.rewritten_content);
            } else {
                const wordCount = response.data.word_count ?? response.data.rewritten_length;
                setAnalyticsReport({
                    ...analyticsReport,
                    report: response.data.rewritten_content,
                    word_count: wordCount
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
        const reportToCheck = isEditing ? editedReport : (analyticsReport?.report || '');
        if (!reportToCheck) {
            alert('No report to check');
            return;
        }
        
        try {
            const ORIGIN = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
            const isLocalhost = ORIGIN.includes('localhost') || ORIGIN.includes('127.0.0.1');
            const PYTHON_API_BASE_URL = process.env.REACT_APP_AI_API || 
                (isLocalhost ? 'http://localhost:5001' : `${ORIGIN}/ai`);
            
            const response = await axios.post(`${PYTHON_API_BASE_URL}/api/v1/analytics/quality-check`, {
                report: reportToCheck,
                website_url: formData.website_url,
                include_traffic_analysis: formData.include_traffic_analysis,
                include_competitor_comparison: formData.include_competitor_comparison,
                include_revenue_analysis: formData.include_revenue_analysis
            });
            
            setQaResult(response.data);
        } catch (err) {
            alert(`Error checking quality: ${err?.response?.data?.detail || err?.message || 'Unknown error'}`);
        }
    };

    const handleGenerateAIRecommendations = async () => {
        const reportToUse = isEditing ? editedReport : (analyticsReport?.report || '');
        if (!reportToUse) {
            alert('Please generate an analytics report first');
            return;
        }
        
        setRecommendationsLoading(true);
        try {
            const ORIGIN = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
            const isLocalhost = ORIGIN.includes('localhost') || ORIGIN.includes('127.0.0.1');
            const PYTHON_API_BASE_URL = process.env.REACT_APP_AI_API || 
                (isLocalhost ? 'http://localhost:5001' : `${ORIGIN}/ai`);
            
            const competitorList = normalizeCompetitorUrls(formData.competitor_urls);
            const response = await axios.post(`${PYTHON_API_BASE_URL}/api/v1/analytics/action-points`, {
                website_url: normalizeUrl(formData.website_url) || formData.website_url,
                analytics_report: reportToUse,
                include_traffic_analysis: formData.include_traffic_analysis,
                include_competitor_comparison: formData.include_competitor_comparison,
                include_revenue_analysis: formData.include_revenue_analysis,
                competitor_urls: competitorList || undefined,
                enable_js_render: enableJsRender
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
                        <h1 className="text-xl font-bold">Website Analytics & Competitor Analysis</h1>
                        <p className="text-sm text-gray-600 mt-1">Comprehensive website analysis with competitor insights and revenue intelligence</p>
                    </div>
                    
                    <Link
                        to="/dashboard"
                        className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-md"
                    >
                        Back to Dashboard
                    </Link>
                </div>
            </header>

            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                <div className="bg-white shadow rounded-lg p-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Analysis Components Selector */}
                        <div>
                            <label className="block text-sm font-medium mb-3">Select Analysis Components *</label>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                                {[
                                    { id: 'traffic', name: 'Traffic Analysis', icon: '📊', field: 'include_traffic_analysis' },
                                    { id: 'competitor', name: 'Competitor Comparison', icon: '🏆', field: 'include_competitor_comparison' },
                                    { id: 'revenue', name: 'Revenue Intelligence', icon: '💰', field: 'include_revenue_analysis' }
                                ].map(component => (
                                    <div
                                        key={component.id}
                                        onClick={() => {
                                            setFormData(prev => ({
                                                ...prev,
                                                [component.field]: !prev[component.field]
                                            }));
                                        }}
                                        className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                                            formData[component.field]
                                                ? 'border-blue-600 bg-blue-50 shadow-md'
                                                : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                                        }`}
                                    >
                                        <div className="text-2xl mb-2 text-center">{component.icon}</div>
                                        <div className="text-sm font-medium text-center">{component.name}</div>
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
                                Enter the website URL you want to analyze
                            </p>
                            <div className="mt-2 flex items-start gap-2">
                                <input
                                    id="enable-js-render-analytics"
                                    type="checkbox"
                                    checked={enableJsRender}
                                    onChange={(e) => setEnableJsRender(e.target.checked)}
                                    className="mt-0.5"
                                />
                                <label htmlFor="enable-js-render-analytics" className="text-xs text-gray-600">
                                    Enable JS rendering for SPA / React sites (uses a headless browser, can be slower but
                                    captures content that only appears after JavaScript runs).
                                </label>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Competitor URLs (Optional)</label>
                            <textarea
                                name="competitor_urls"
                                value={formData.competitor_urls}
                                onChange={handleInputChange}
                                placeholder="https://competitor1.com, https://competitor2.com"
                                className="w-full p-3 border rounded-lg resize-none"
                                rows="2"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Comma-separated list of competitor websites for comparison analysis
                            </p>
                        </div>

                        {/* Detailed Analysis Preview Based on Selected Components */}
                        {(formData.include_traffic_analysis || formData.include_competitor_comparison || formData.include_revenue_analysis) && (
                            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <h3 className="text-sm font-semibold text-blue-900 mb-3">
                                    Detailed Analysis Options for Selected Components:
                                </h3>
                                <div className="space-y-3">
                                    {formData.include_traffic_analysis && (
                                        <div className="text-sm">
                                            <strong className="text-blue-800">📊 Traffic Analysis:</strong>
                                            <p className="text-blue-700 mt-1">We will analyze monthly visitors, traffic sources (organic, direct, referral, social, paid), geographic distribution, device breakdown (desktop, mobile, tablet), engagement metrics (bounce rate, session duration, pages per visit), traffic trends, and SimilarWeb-style insights.</p>
                                        </div>
                                    )}
                                    {formData.include_competitor_comparison && (
                                        <div className="text-sm">
                                            <strong className="text-blue-800">🏆 Competitor Comparison:</strong>
                                            <p className="text-blue-700 mt-1">We will compare your website with competitors across traffic volume, traffic sources, features and functionality, content strategy, market positioning, competitive advantages, technology stack, user experience, and market share.</p>
                                        </div>
                                    )}
                                    {formData.include_revenue_analysis && (
                                        <div className="text-sm">
                                            <strong className="text-blue-800">💰 Revenue Intelligence:</strong>
                                            <p className="text-blue-700 mt-1">We will analyze revenue models including subscription plans, advertising revenue, e-commerce sales, affiliate marketing, freemium models, licensing, and other monetization strategies. We will identify pricing strategies and revenue streams.</p>
                                        </div>
                                    )}
                                </div>
                                <p className="text-xs text-blue-600 mt-3 italic">
                                    We will provide comprehensive analysis and strategic recommendations for all selected components.
                                    {formData.competitor_urls && ' We are analyzing competitor websites for comparison.'}
                                </p>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Analysis Depth *</label>
                                <select
                                    name="analysis_depth"
                                    value={formData.analysis_depth}
                                    onChange={handleInputChange}
                                    className="w-full p-2 border rounded"
                                    required
                                >
                                    <option value="quick">Quick Analysis</option>
                                    <option value="standard">Standard Analysis</option>
                                    <option value="comprehensive">Comprehensive Analysis</option>
                                    <option value="deep">Deep Dive Analysis</option>
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

                        <button
                            type="submit"
                            disabled={loading || paymentLoading}
                            className={`py-2 px-4 rounded font-medium text-white ${
                                (loading || paymentLoading)
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                        >
                            {(loading || paymentLoading) ? 'Processing...' : 'Generate Analytics Report'}
                        </button>
                        
                        {loading && (
                            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                                <p className="text-sm text-blue-800">
                                    <strong>We are now analyzing your website</strong>
                                    {formData.competitor_urls ? ' and selected competitors' : ''} to understand traffic, engagement,
                                    and revenue patterns. Your full analytics report will be ready in about 2–3 minutes.
                                </p>
                            </div>
                        )}
                    </form>

                    {error && (
                        <div className="mt-4 p-3 bg-red-100 text-red-700 rounded">
                            {error}
                        </div>
                    )}

                    {analyticsReport && (
                        <div className="mt-6">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="text-lg font-medium">
                                    {isEditing ? 'Editing Analytics Report' : 'Website Analytics Report'}
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
                                                {rewriteLoading ? 'Rewriting...' : 'Rewrite'}
                                            </button>
                                            {!formData.include_competitor_comparison && (
                                                <button
                                                    onClick={handleGenerateMetaTags}
                                                    disabled={loading}
                                                    className="px-3 py-1 text-sm bg-indigo-600 text-white hover:bg-indigo-700 rounded disabled:bg-gray-400"
                                                >
                                                    Meta Tags
                                                </button>
                                            )}
                                            <button
                                                onClick={handleGenerateAIRecommendations}
                                                disabled={loading || recommendationsLoading}
                                                className="px-3 py-1 text-sm bg-purple-600 text-white hover:bg-purple-700 rounded disabled:bg-gray-400"
                                            >
                                                {recommendationsLoading ? 'Generating...' : 'Recommendations'}
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
                                                Download ({viewFormat === 'html' ? 'HTML' : 'MD'})
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                            
                            <div className="mb-2 flex items-center justify-between">
                                <div className="text-sm text-gray-600">
                                    <span>Words: {isEditing ? editedReport.split(/\s+/).filter(word => word.length > 0).length : analyticsReport.word_count}</span>
                                    <span className="ml-4">Est. Read Time: {isEditing ? Math.max(1, Math.round(editedReport.split(/\s+/).filter(word => word.length > 0).length / 200)) : analyticsReport.estimated_read_time} min</span>
                                </div>
                                {!isEditing && (
                                    <button
                                        onClick={handleToggleFormat}
                                        className="px-3 py-1 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded"
                                        title={`Switch to ${viewFormat === 'markdown' ? 'HTML' : 'Markdown'} view`}
                                    >
                                        View as {viewFormat === 'markdown' ? 'HTML' : 'Markdown'}
                                    </button>
                                )}
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
                                    {(() => {
                                        const reportToDisplay = analyticsReportToMarkdown(analyticsReport?.report || '');
                                        return viewFormat === 'html' ? (
                                        <div 
                                            dangerouslySetInnerHTML={{ __html: markdownToHtml(reportToDisplay) }}
                                            className="prose max-w-none text-left"
                                            style={{ 
                                                textAlign: 'left',
                                                lineHeight: '1.75',
                                                fontSize: '16px',
                                                color: '#374151'
                                            }}
                                        />
                                    ) : (
                                        <pre className="whitespace-pre-wrap font-mono text-sm text-left" style={{ textAlign: 'left' }}>{reportToDisplay}</pre>
                                    );
                                    })()}
                                    {viewFormat === 'html' && (
                                        <style>{`
                                            .prose h1 {
                                                font-size: 2.25em;
                                                font-weight: 800;
                                                margin-top: 0;
                                                margin-bottom: 0.8888889em;
                                                line-height: 1.1111111;
                                                color: #111827;
                                            }
                                            .prose h2 {
                                                font-size: 1.5em;
                                                font-weight: 700;
                                                margin-top: 2em;
                                                margin-bottom: 1em;
                                                line-height: 1.3333333;
                                                color: #111827;
                                            }
                                            .prose h3 {
                                                font-size: 1.25em;
                                                font-weight: 600;
                                                margin-top: 1.6em;
                                                margin-bottom: 0.6em;
                                                line-height: 1.6;
                                                color: #111827;
                                            }
                                            .prose h4 {
                                                font-size: 1.125em;
                                                font-weight: 600;
                                                margin-top: 1.5em;
                                                margin-bottom: 0.5em;
                                                line-height: 1.5555556;
                                                color: #111827;
                                            }
                                            .prose p {
                                                margin-top: 1.25em;
                                                margin-bottom: 1.25em;
                                                line-height: 1.75;
                                            }
                                            .prose ul, .prose ol {
                                                margin-top: 1.25em;
                                                margin-bottom: 1.25em;
                                                padding-left: 1.5em;
                                                list-style-position: outside;
                                            }
                                            .prose li {
                                                margin-top: 0.5em;
                                                margin-bottom: 0.5em;
                                                line-height: 1.75;
                                                padding-left: 0.5em;
                                            }
                                            .prose ul > li {
                                                position: relative;
                                                padding-left: 1.5em;
                                            }
                                            .prose ul > li::before {
                                                content: "";
                                                position: absolute;
                                                background-color: #6b7280;
                                                border-radius: 50%;
                                                width: 0.375em;
                                                height: 0.375em;
                                                top: 0.75em;
                                                left: 0;
                                            }
                                            .prose ol > li {
                                                counter-increment: list-counter;
                                                padding-left: 2.25em;
                                            }
                                            .prose ol > li::before {
                                                content: counter(list-counter) ".";
                                                position: absolute;
                                                font-weight: 400;
                                                color: #6b7280;
                                                left: 0;
                                                min-width: 2em;
                                                display: inline-block;
                                            }
                                            .prose ol {
                                                counter-reset: list-counter;
                                            }
                                            .prose ol > li {
                                                position: relative;
                                            }
                                            .prose strong {
                                                font-weight: 600;
                                                color: #111827;
                                            }
                                            .prose code {
                                                font-size: 0.875em;
                                                font-weight: 600;
                                                color: #111827;
                                                background-color: #f3f4f6;
                                                padding: 0.125em 0.25em;
                                                border-radius: 0.25rem;
                                            }
                                            .prose pre {
                                                color: #e5e7eb;
                                                background-color: #1f2937;
                                                overflow-x: auto;
                                                font-weight: 400;
                                                font-size: 0.875em;
                                                line-height: 1.7142857;
                                                margin-top: 1.7142857em;
                                                margin-bottom: 1.7142857em;
                                                border-radius: 0.375rem;
                                                padding: 0.8571429em 1.1428571em;
                                            }
                                            .prose pre code {
                                                background-color: transparent;
                                                border-width: 0;
                                                border-radius: 0;
                                                padding: 0;
                                                font-weight: inherit;
                                                color: inherit;
                                                font-size: inherit;
                                                font-family: inherit;
                                                line-height: inherit;
                                            }
                                            .prose blockquote {
                                                font-weight: 500;
                                                font-style: italic;
                                                color: #111827;
                                                border-left-width: 0.25rem;
                                                border-left-color: #e5e7eb;
                                                quotes: "\\201C""\\201D""\\2018""\\2019";
                                                margin-top: 1.6em;
                                                margin-bottom: 1.6em;
                                                padding-left: 1em;
                                            }
                                            .prose hr {
                                                border-color: #e5e7eb;
                                                border-top-width: 1px;
                                                margin-top: 3em;
                                                margin-bottom: 3em;
                                            }
                                            .prose table {
                                                width: 100%;
                                                table-layout: auto;
                                                text-align: left;
                                                margin-top: 2em;
                                                margin-bottom: 2em;
                                                font-size: 0.875em;
                                                line-height: 1.7142857;
                                            }
                                            .prose thead {
                                                border-bottom-width: 1px;
                                                border-bottom-color: #e5e7eb;
                                            }
                                            .prose thead th {
                                                color: #111827;
                                                font-weight: 600;
                                                vertical-align: bottom;
                                                padding-right: 0.5714286em;
                                                padding-bottom: 0.5714286em;
                                                padding-left: 0.5714286em;
                                            }
                                            .prose tbody tr {
                                                border-bottom-width: 1px;
                                                border-bottom-color: #e5e7eb;
                                            }
                                            .prose tbody td {
                                                vertical-align: baseline;
                                                padding-top: 0.5714286em;
                                                padding-right: 0.5714286em;
                                                padding-bottom: 0.5714286em;
                                                padding-left: 0.5714286em;
                                            }
                                        `}</style>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Quality Assurance Results (analytics context-specific) */}
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
                                    {qaResult.has_executive_summary !== undefined ? (
                                        <>
                                            {qaResult.has_executive_summary && ' ✓ Executive Summary'}
                                            {qaResult.has_traffic_section && ' ✓ Traffic'}
                                            {qaResult.has_competitor_section && ' ✓ Competitor'}
                                            {qaResult.has_revenue_section && ' ✓ Revenue'}
                                            {qaResult.has_strategic_recommendations && ' ✓ Strategic'}
                                            {qaResult.has_tools_monitoring && ' ✓ Tools'}
                                        </>
                                    ) : (
                                        <>
                                            {qaResult.has_meta_tags && ' ✓ Meta'}
                                            {qaResult.has_schema && ' ✓ Schema'}
                                            {qaResult.has_keywords && ' ✓ Keywords'}
                                            {qaResult.has_competitor_analysis && ' ✓ Competitor'}
                                        </>
                                    )}
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

                    {/* Recommendations (analytics) — match report sections */}
                    {aiOptimizedRecommendations && (
                        <div className="mt-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="font-semibold">Recommendations</h4>
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
                            <p className="text-sm text-gray-600 mb-2">
                                Recommendations from each section of your Website Analytics report.
                            </p>
                            <div className="mb-3 flex items-center gap-2 flex-wrap">
                                <span className="text-sm text-gray-600">View format:</span>
                                <button
                                    type="button"
                                    onClick={() => setActionPointsViewFormat('markdown')}
                                    className={`px-3 py-1 text-sm rounded ${actionPointsViewFormat === 'markdown' ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                                >
                                    Markdown
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActionPointsViewFormat('html')}
                                    className={`px-3 py-1 text-sm rounded ${actionPointsViewFormat === 'html' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                                >
                                    HTML
                                </button>
                            </div>
                            <div className="p-4 bg-white rounded border">
                                {actionPointsViewFormat === 'html' ? (
                                    <>
                                        <div
                                            className="recommendations-prose prose max-w-none text-left"
                                            dangerouslySetInnerHTML={{ __html: markdownToHtml(aiOptimizedRecommendations.recommendations) }}
                                            style={{ textAlign: 'left', lineHeight: '1.75', fontSize: '16px', color: '#374151' }}
                                        />
                                        <style>{`
                                            .recommendations-prose.prose h2 { font-size: 1.5em; font-weight: 700; margin-top: 1.5em; margin-bottom: 0.75em; color: #111827; }
                                            .recommendations-prose.prose h3 { font-size: 1.25em; font-weight: 600; margin-top: 1.25em; margin-bottom: 0.5em; color: #111827; }
                                            .recommendations-prose.prose p, .recommendations-prose.prose ul { margin-top: 0.75em; margin-bottom: 0.75em; line-height: 1.75; }
                                            .recommendations-prose.prose ul { padding-left: 1.5em; list-style-position: outside; }
                                            .recommendations-prose.prose li { margin-top: 0.35em; padding-left: 0.5em; }
                                            .recommendations-prose.prose ul > li { position: relative; padding-left: 1.5em; }
                                            .recommendations-prose.prose ul > li::before { content: ""; position: absolute; background-color: #6b7280; border-radius: 50%; width: 0.375em; height: 0.375em; top: 0.6em; left: 0; }
                                            .recommendations-prose.prose strong { font-weight: 600; color: #111827; }
                                            .recommendations-prose.prose a { color: #7c3aed; text-decoration: underline; }
                                            .recommendations-prose.prose pre { background-color: #1f2937; color: #e5e7eb; padding: 1em; border-radius: 0.375rem; overflow-x: auto; font-size: 0.875em; margin: 0.75em 0; }
                                            .recommendations-prose.prose code { font-size: 0.875em; background-color: #f3f4f6; padding: 0.125em 0.25em; border-radius: 0.25rem; color: #111827; }
                                            .recommendations-prose.prose pre code { background: transparent; padding: 0; color: inherit; }
                                        `}</style>
                                    </>
                                ) : (
                                    <pre className="whitespace-pre-wrap font-mono text-sm text-left" style={{ textAlign: 'left' }}>
                                        {aiOptimizedRecommendations.recommendations}
                                    </pre>
                                )}
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

export default WebsiteAnalytics;

