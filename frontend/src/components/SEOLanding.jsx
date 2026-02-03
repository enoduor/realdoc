import React from 'react';
import { useNavigate } from 'react-router-dom';
import Navigation from './Navigation';
import Footer from './Footer';
import './LandingPage.css';

const SEOLanding = () => {
    const navigate = useNavigate();

    const handleGetStarted = () => {
        navigate('/seo-generator');
    };

    return (
        <div className="landing-page">
            <Navigation />
            {/* Hero Section */}
            <section className="hero-section-aidoc">
                <div className="hero-container-aidoc">
                    <div className="hero-badges-aidoc">
                        <span className="badge-aidoc">Comprehensive Analysis</span>
                        <span className="badge-aidoc">Actionable Recommendations</span>
                        <span className="badge-aidoc">Instant Reports</span>
                        <span className="badge-aidoc">No Signup</span>
                    </div>
                    
                    <h1 className="hero-title-aidoc">
                        Make People Discover Your Business
                    </h1>
                    
                    <p className="hero-subtitle-aidoc">
                        Generate professional SEO reports instantly. Enter your website URL, and receive comprehensive SEO analysis with technical audits, on-page optimization, content strategy, and implementation roadmap. Copy, download, and use immediately - no SEO expertise required.
                    </p>

                    <div className="doc-types-selector">
                        <div className="doc-type-icon active" onClick={handleGetStarted} style={{ cursor: 'pointer' }}>⚙️ Technical SEO</div>
                        <div className="doc-type-icon" onClick={handleGetStarted} style={{ cursor: 'pointer' }}>📄 On-Page SEO</div>
                        <div className="doc-type-icon" onClick={handleGetStarted} style={{ cursor: 'pointer' }}>📝 Content SEO</div>
                        <div className="doc-type-icon" onClick={handleGetStarted} style={{ cursor: 'pointer' }}>🔗 Off-Page SEO</div>
                        <div className="doc-type-icon" onClick={handleGetStarted} style={{ cursor: 'pointer' }}>📍 Local SEO</div>
                        <div className="doc-type-icon" onClick={handleGetStarted} style={{ cursor: 'pointer' }}>📱 Mobile SEO</div>
                        <div className="doc-type-icon" onClick={handleGetStarted} style={{ cursor: 'pointer' }}>⚡ Page Speed</div>
                    </div>

                    <button onClick={handleGetStarted} className="generate-btn-aidoc">
                        Analyze SEO
                    </button>

                    {/* Steps Section */}
                    <div className="steps-section-aidoc">
                        <div className="step-item">
                            <div className="step-number">Step 1</div>
                            <h3>Enter your website URL and preferences</h3>
                        </div>
                        <div className="step-item">
                            <div className="step-number">Step 2</div>
                            <h3>AI analyzes your website and generates comprehensive SEO report</h3>
                        </div>
                        <div className="step-item">
                            <div className="step-number">Step 3</div>
                            <h3>Copy, download, and implement recommendations immediately</h3>
                        </div>
                    </div>
                </div>
            </section>

            {/* Stats Section */}
            <section className="stats-section-aidoc">
                <div className="stats-container">
                    <h2 className="stats-title">Super Fast AI SEO Analysis</h2>
                    <p className="stats-subtitle">Transform your website's SEO performance with comprehensive AI-powered analysis</p>
                    
                    <div className="stats-badge">
                        <p className="stats-text">Get <strong>complete SEO optimization</strong> in minutes, not days</p>
                    </div>
                </div>
            </section>

            {/* SEO Components */}
            <section className="free-tools-section-aidoc">
                <div className="free-tools-container">
                    <h2 className="section-title-aidoc">SEO Components</h2>
                    <div className="free-tools-grid">
                        <div className="free-tool-item" onClick={handleGetStarted} style={{ cursor: 'pointer' }}>
                            <h3>⚙️ Technical SEO</h3>
                            <p>Site structure, speed, mobile, schema, sitemaps, and crawlability</p>
                        </div>
                        <div className="free-tool-item" onClick={handleGetStarted} style={{ cursor: 'pointer' }}>
                            <h3>📄 On-Page SEO</h3>
                            <p>Title tags, meta descriptions, headers, URLs, and internal linking</p>
                        </div>
                        <div className="free-tool-item" onClick={handleGetStarted} style={{ cursor: 'pointer' }}>
                            <h3>📝 Content SEO</h3>
                            <p>Content quality, keyword targeting, E-A-T, and content strategy</p>
                        </div>
                        <div className="free-tool-item" onClick={handleGetStarted} style={{ cursor: 'pointer' }}>
                            <h3>🔗 Off-Page SEO</h3>
                            <p>Backlinks, link building, social signals, and domain authority</p>
                        </div>
                        <div className="free-tool-item" onClick={handleGetStarted} style={{ cursor: 'pointer' }}>
                            <h3>📍 Local SEO</h3>
                            <p>Google Business Profile, local citations, NAP consistency</p>
                        </div>
                        <div className="free-tool-item" onClick={handleGetStarted} style={{ cursor: 'pointer' }}>
                            <h3>📱 Mobile SEO</h3>
                            <p>Mobile-first indexing, responsive design, and mobile usability</p>
                        </div>
                        <div className="free-tool-item" onClick={handleGetStarted} style={{ cursor: 'pointer' }}>
                            <h3>⚡ Page Speed</h3>
                            <p>Core Web Vitals, performance optimization, and loading speed</p>
                        </div>
                        <div className="free-tool-item" onClick={handleGetStarted} style={{ cursor: 'pointer' }}>
                            <h3>♿ Accessibility</h3>
                            <p>WCAG compliance, screen reader compatibility, and ARIA labels</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Why Section */}
            <section className="why-section-aidoc">
                <div className="why-container">
                    <h2 className="section-title-aidoc">Why RealDoc for SEO Analysis?</h2>
                    
                    <div className="why-grid">
                        <div className="why-item">
                            <h3>🤖 AI-Powered Analysis</h3>
                            <p>Advanced AI analyzes your website and provides comprehensive, actionable SEO recommendations based on industry best practices.</p>
                        </div>
                        
                        <div className="why-item">
                            <h3>⚡ Instant Reports</h3>
                            <p>Get complete SEO analysis in minutes instead of spending hours or days with manual audits and tools.</p>
                        </div>
                        
                        <div className="why-item">
                            <h3>🎯 Actionable Recommendations</h3>
                            <p>Receive specific, implementable recommendations with code examples and step-by-step guides.</p>
                        </div>
                        
                        <div className="why-item">
                            <h3>📊 Comprehensive Coverage</h3>
                            <p>All aspects of SEO covered - technical, on-page, content, mobile, speed, and accessibility.</p>
                        </div>
                        
                        <div className="why-item">
                            <h3>🛠️ Implementation Roadmap</h3>
                            <p>Prioritized action items with quick wins, high-impact improvements, and long-term strategies.</p>
                        </div>
                        
                        <div className="why-item">
                            <h3>📄 Ready to Use</h3>
                            <p>Download reports in Markdown format, copy recommendations, and start implementing immediately.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Final CTA Section */}
            <section className="final-cta-section-aidoc">
                <div className="final-cta-container-aidoc">
                    <h2 className="final-cta-title-aidoc">Start Optimizing Your SEO Today</h2>
                    <p className="final-cta-subtitle-aidoc">Get comprehensive SEO analysis and actionable recommendations in minutes</p>
                    <button onClick={handleGetStarted} className="cta-button-aidoc">
                        Get Started
                    </button>
                </div>
            </section>
            <Footer />
        </div>
    );
};

export default SEOLanding;

