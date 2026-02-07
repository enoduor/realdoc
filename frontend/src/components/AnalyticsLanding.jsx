import React from 'react';
import { useNavigate } from 'react-router-dom';
import Navigation from './Navigation';
import Footer from './Footer';
import './LandingPage.css';

const AnalyticsLanding = () => {
    const navigate = useNavigate();

    const handleGetStarted = () => {
        navigate('/website-analytics');
    };

    return (
        <div className="landing-page">
            <Navigation />
            {/* Hero Section */}
            <section className="hero-section-aidoc">
                <div className="hero-container-aidoc">
                    <div className="hero-badges-aidoc">
                        <span className="badge-aidoc">Traffic Analysis</span>
                        <span className="badge-aidoc">Competitor Insights</span>
                        <span className="badge-aidoc">Revenue Intelligence</span>
                        <span className="badge-aidoc">No Signup</span>
                    </div>
                    
                    <h1 className="hero-title-aidoc">
                        Get an edge over your Competitors
                    </h1>
                    
                    <p className="hero-subtitle-aidoc">
                        See what's holding your site back, understand why competitors win, and get clear next steps to help more people discover your business.
                    </p>

                    <div className="doc-types-selector">
                        <div className="doc-type-icon active" onClick={handleGetStarted} style={{ cursor: 'pointer' }}>📊 Traffic Analysis</div>
                        <div className="doc-type-icon" onClick={handleGetStarted} style={{ cursor: 'pointer' }}>🏆 Competitor Comparison</div>
                        <div className="doc-type-icon" onClick={handleGetStarted} style={{ cursor: 'pointer' }}>💰 Revenue Intelligence</div>
                        <div className="doc-type-icon" onClick={handleGetStarted} style={{ cursor: 'pointer' }}>📈 Marketing Analysis</div>
                        <div className="doc-type-icon" onClick={handleGetStarted} style={{ cursor: 'pointer' }}>📝 Content Analysis</div>
                        <div className="doc-type-icon" onClick={handleGetStarted} style={{ cursor: 'pointer' }}>⚙️ Technical Infrastructure</div>
                        <div className="doc-type-icon" onClick={handleGetStarted} style={{ cursor: 'pointer' }}>🎯 Strategic Recommendations</div>
                    </div>

                    <button onClick={handleGetStarted} className="generate-btn-aidoc">
                        Analyze Website
                    </button>

                    {/* Steps Section */}
                    <div className="steps-section-aidoc">
                        <div className="step-item">
                            <div className="step-number">Step 1</div>
                            <h3>Enter your website URL and competitor URLs</h3>
                        </div>
                        <div className="step-item">
                            <div className="step-number">Step 2</div>
                            <h3>AI analyzes traffic, competitors, and revenue models</h3>
                        </div>
                        <div className="step-item">
                            <div className="step-number">Step 3</div>
                            <h3>Get comprehensive insights and strategic recommendations</h3>
                        </div>
                    </div>
                </div>
            </section>

            {/* Stats Section */}
            <section className="stats-section-aidoc">
                <div className="stats-container">
                    <h2 className="stats-title">Super Fast AI Website Analytics</h2>
                    <p className="stats-subtitle">Transform your website insights with comprehensive AI-powered analytics</p>
                    
                    <div className="stats-badge">
                        <p className="stats-text">Get <strong>complete analytics insights</strong> in minutes, not days</p>
                    </div>
                </div>
            </section>

            {/* Analytics Components */}
            <section className="free-tools-section-aidoc">
                <div className="free-tools-container">
                    <h2 className="section-title-aidoc">Analytics Components</h2>
                    <div className="free-tools-grid">
                        <div className="free-tool-item" onClick={handleGetStarted} style={{ cursor: 'pointer' }}>
                            <h3>📊 Traffic Analysis</h3>
                            <p>Monthly traffic, sources, geographic distribution, and engagement metrics</p>
                        </div>
                        <div className="free-tool-item" onClick={handleGetStarted} style={{ cursor: 'pointer' }}>
                            <h3>🏆 Competitor Comparison</h3>
                            <p>Feature comparison, traffic analysis, and competitive positioning</p>
                        </div>
                        <div className="free-tool-item" onClick={handleGetStarted} style={{ cursor: 'pointer' }}>
                            <h3>💰 Revenue Intelligence</h3>
                            <p>Revenue model analysis, pricing strategies, and monetization insights</p>
                        </div>
                        <div className="free-tool-item" onClick={handleGetStarted} style={{ cursor: 'pointer' }}>
                            <h3>📈 Marketing Analysis</h3>
                            <p>Marketing channels, brand presence, and growth opportunities</p>
                        </div>
                        <div className="free-tool-item" onClick={handleGetStarted} style={{ cursor: 'pointer' }}>
                            <h3>📝 Content Analysis</h3>
                            <p>Content quality, SEO performance, and content gap identification</p>
                        </div>
                        <div className="free-tool-item" onClick={handleGetStarted} style={{ cursor: 'pointer' }}>
                            <h3>⚙️ Technical Infrastructure</h3>
                            <p>Website architecture, technology stack, and scalability analysis</p>
                        </div>
                        <div className="free-tool-item" onClick={handleGetStarted} style={{ cursor: 'pointer' }}>
                            <h3>🎯 Strategic Recommendations</h3>
                            <p>Quick wins, high-impact improvements, and long-term strategies</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Why Section */}
            <section className="why-section-aidoc">
                <div className="why-container">
                    <h2 className="section-title-aidoc">Why RealDoc for Website Analytics?</h2>
                    
                    <div className="why-grid">
                        <div className="why-item">
                            <h3>🤖 AI-Powered Intelligence</h3>
                            <p>Advanced AI analyzes websites, competitors, and market data to provide comprehensive insights and strategic recommendations.</p>
                        </div>
                        
                        <div className="why-item">
                            <h3>💰 Revenue Model Discovery</h3>
                            <p>Understand how competitors make money - identify subscription models, advertising, e-commerce, and monetization strategies.</p>
                        </div>
                        
                        <div className="why-item">
                            <h3>📊 SimilarWeb-Style Analytics</h3>
                            <p>Get traffic insights, competitor analysis, and market intelligence without expensive subscription tools.</p>
                        </div>
                        
                        <div className="why-item">
                            <h3>⚡ Instant Reports</h3>
                            <p>Generate comprehensive analytics reports in minutes instead of spending hours with multiple tools.</p>
                        </div>
                        
                        <div className="why-item">
                            <h3>🎯 Competitive Intelligence</h3>
                            <p>Compare your website with competitors across traffic, features, content, and market positioning.</p>
                        </div>
                        
                        <div className="why-item">
                            <h3>📄 Ready to Use</h3>
                            <p>Download reports in Markdown format, copy insights, and use immediately for strategic planning.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Final CTA Section */}
            <section className="final-cta-section-aidoc">
                <div className="final-cta-container-aidoc">
                    <h2 className="final-cta-title-aidoc">Start Analyzing Your Website Today</h2>
                    <p className="final-cta-subtitle-aidoc">Get comprehensive analytics, competitor insights, and revenue intelligence in minutes</p>
                    <button onClick={handleGetStarted} className="cta-button-aidoc">
                        Get Started
                    </button>
                </div>
            </section>
            <Footer />
        </div>
    );
};

export default AnalyticsLanding;

