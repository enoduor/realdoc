import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useUser, useClerk } from '@clerk/clerk-react';
import usePaymentModal from './PaymentModal';

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
                    competitor_urls: normalizedCompetitors ? normalizedCompetitors.join(', ') : null
                };
                
                const response = await axios.post(`${PYTHON_API_BASE_URL}/api/v1/analytics/`, requestData, {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 300000
                });
                
                setAnalyticsReport(response.data);
                setEditedReport(response.data.report);
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
        
        const filename = `Analytics_Report_${formData.website_url.replace(/https?:\/\//, '').replace(/\//g, '_')}.md`;
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
                                            <p className="text-blue-700 mt-1">Will analyze monthly visitors, traffic sources (organic, direct, referral, social, paid), geographic distribution, device breakdown (desktop, mobile, tablet), engagement metrics (bounce rate, session duration, pages per visit), traffic trends, and SimilarWeb-style insights.</p>
                                        </div>
                                    )}
                                    {formData.include_competitor_comparison && (
                                        <div className="text-sm">
                                            <strong className="text-blue-800">🏆 Competitor Comparison:</strong>
                                            <p className="text-blue-700 mt-1">Will compare your website with competitors across traffic volume, traffic sources, features and functionality, content strategy, market positioning, competitive advantages, technology stack, user experience, and market share.</p>
                                        </div>
                                    )}
                                    {formData.include_revenue_analysis && (
                                        <div className="text-sm">
                                            <strong className="text-blue-800">💰 Revenue Intelligence:</strong>
                                            <p className="text-blue-700 mt-1">Will analyze revenue models including subscription plans, advertising revenue, e-commerce sales, affiliate marketing, freemium models, licensing, and other monetization strategies. Will identify pricing strategies and revenue streams.</p>
                                        </div>
                                    )}
                                </div>
                                <p className="text-xs text-blue-600 mt-3 italic">
                                    The AI will provide comprehensive analysis and strategic recommendations for all selected components.
                                    {formData.competitor_urls && ' Competitor websites will be crawled and analyzed for comparison.'}
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
                                    <strong>Processing:</strong> Crawling {formData.website_url || 'website'}{formData.competitor_urls ? ' and competitors' : ''} and generating comprehensive analytics report. This may take 2-3 minutes...
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
                                <span>Words: {isEditing ? editedReport.split(/\s+/).filter(word => word.length > 0).length : analyticsReport.word_count}</span>
                                <span className="ml-4">Est. Read Time: {isEditing ? Math.max(1, Math.round(editedReport.split(/\s+/).filter(word => word.length > 0).length / 200)) : analyticsReport.estimated_read_time} min</span>
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
                                    <pre className="whitespace-pre-wrap font-mono text-sm text-left" style={{ textAlign: 'left' }}>{analyticsReport.report}</pre>
                                </div>
                            )}
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

