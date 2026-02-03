import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navigation from './Navigation';
import Footer from './Footer';
import './LandingPage.css';

const DocumentationLanding = () => {
    const navigate = useNavigate();

    const handleGenerate = () => {
        navigate('/documentation-generator');
    };

    return (
        <div className="landing-page">
            <Navigation />
            {/* Hero Section */}
            <section className="hero-section-aidoc">
                <div className="hero-container-aidoc">
                    <div className="hero-badges-aidoc">
                        <span className="badge-aidoc">Unlimited Usage</span>
                        <span className="badge-aidoc">1-Click Generate</span>
                        <span className="badge-aidoc">Free Downloads</span>
                        <span className="badge-aidoc">No Signup</span>
                    </div>
                    
                    <h1 className="hero-title-aidoc">
                        Get documentation for your app 
                    </h1>
                    
                    <p className="hero-subtitle-aidoc">
                        Generate professional documentation instantly. Fill out a simple form, click generate, and receive complete documentation with proper structure, formatting, and code examples. Copy, download, or use immediately - no technical writing skills required.
                    </p>

                    <div className="doc-types-selector">
                        <div className="doc-type-icon active" onClick={handleGenerate} style={{ cursor: 'pointer' }}>📖 User Guide</div>
                        <div className="doc-type-icon" onClick={handleGenerate} style={{ cursor: 'pointer' }}>🔌 API Docs</div>
                        <div className="doc-type-icon" onClick={handleGenerate} style={{ cursor: 'pointer' }}>👨‍💻 Developer Guide</div>
                        <div className="doc-type-icon" onClick={handleGenerate} style={{ cursor: 'pointer' }}>⚙️ Admin Docs</div>
                        <div className="doc-type-icon" onClick={handleGenerate} style={{ cursor: 'pointer' }}>🚀 Quick Start</div>
                        <div className="doc-type-icon" onClick={handleGenerate} style={{ cursor: 'pointer' }}>❓ FAQ</div>
                        <div className="doc-type-icon" onClick={handleGenerate} style={{ cursor: 'pointer' }}>📝 Release Notes</div>
                    </div>

                    <button onClick={handleGenerate} className="generate-btn-aidoc">
                        Generate
                    </button>

                    {/* Steps Section */}
                    <div className="steps-section-aidoc">
                        <div className="step-item">
                            <div className="step-number">Step 1</div>
                            <h3>Fill out the form with your app details</h3>
                        </div>
                        <div className="step-item">
                            <div className="step-number">Step 2</div>
                            <h3>AI generates comprehensive documentation</h3>
                        </div>
                        <div className="step-item">
                            <div className="step-number">Step 3</div>
                            <h3>Copy, download, and use immediately</h3>
                        </div>
                    </div>
                </div>
            </section>

            {/* Stats Section */}
            <section className="stats-section-aidoc">
                <div className="stats-container">
                    <h2 className="stats-title">Super Fast AI Documentation Generator</h2>
                    <p className="stats-subtitle">Transform your app ideas into comprehensive documentation in seconds with AI</p>
                    
                    <div className="stats-badge">
                        <p className="stats-text">Generate <strong>complete documentation</strong> in minutes, not days</p>
                    </div>
                </div>
            </section>

            {/* Documentation Types */}
            <section className="free-tools-section-aidoc">
                <div className="free-tools-container">
                    <h2 className="section-title-aidoc">Documentation Types</h2>
                    <div className="free-tools-grid">
                        <div className="free-tool-item" onClick={handleGenerate} style={{ cursor: 'pointer' }}>
                            <h3>📖 User Guide</h3>
                            <p>Step-by-step instructions for end users</p>
                        </div>
                        <div className="free-tool-item" onClick={handleGenerate} style={{ cursor: 'pointer' }}>
                            <h3>🔌 API Documentation</h3>
                            <p>Endpoints, parameters, responses, examples</p>
                        </div>
                        <div className="free-tool-item" onClick={handleGenerate} style={{ cursor: 'pointer' }}>
                            <h3>👨‍💻 Developer Guide</h3>
                            <p>Setup, architecture, integration guides</p>
                        </div>
                        <div className="free-tool-item" onClick={handleGenerate} style={{ cursor: 'pointer' }}>
                            <h3>⚙️ Admin Documentation</h3>
                            <p>Configuration, management, troubleshooting</p>
                        </div>
                        <div className="free-tool-item" onClick={handleGenerate} style={{ cursor: 'pointer' }}>
                            <h3>🚀 Quick Start Guide</h3>
                            <p>Get started in minutes</p>
                        </div>
                        <div className="free-tool-item" onClick={handleGenerate} style={{ cursor: 'pointer' }}>
                            <h3>❓ FAQ</h3>
                            <p>Common questions and answers</p>
                        </div>
                        <div className="free-tool-item" onClick={handleGenerate} style={{ cursor: 'pointer' }}>
                            <h3>📝 Release Notes</h3>
                            <p>Version changes, new features, breaking changes</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Why RealDoc Section */}
            <section className="why-section-aidoc">
                <div className="why-container">
                    <h2 className="section-title-aidoc">Why RealDoc for AI documentation generation?</h2>
                    
                    <div className="why-grid">
                        <div className="why-item">
                            <h3>⚡ Speed</h3>
                            <p>Generate complete documentation in minutes instead of spending days or weeks writing manually. Focus on building your product while we handle the docs.</p>
                        </div>
                        
                        <div className="why-item">
                            <h3>🎯 One Tool, All Types</h3>
                            <p>Generate user guides, API docs, developer guides, FAQs, and more from one platform. No need to switch between multiple tools or learn different systems.</p>
                        </div>
                        
                        <div className="why-item">
                            <h3>📚 No Technical Writing Skills Needed</h3>
                            <p>Simply describe your feature or application. Our AI generates professional, well-structured documentation that follows industry best practices.</p>
                        </div>
                        
                        <div className="why-item">
                            <h3>🎨 Fully Customizable</h3>
                            <p>Control technical level, style, tone, target audience, language, and format. Get documentation that perfectly matches your needs and audience.</p>
                        </div>
                        
                        <div className="why-item">
                            <h3>📄 Ready to Use</h3>
                            <p>Receive complete documentation with proper structure, formatting, and code examples. Copy, download, and use immediately - no editing required.</p>
                        </div>
                        
                        <div className="why-item">
                            <h3>🌍 Multiple Formats & Languages</h3>
                            <p>Export in Markdown, HTML, or Plain Text. Generate documentation in 10+ languages. Get the format and language you need for your workflow.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Final CTA Section */}
            <section className="final-cta-section-aidoc">
                <div className="final-cta-container-aidoc">
                    <h2 className="final-cta-title-aidoc">Generate Professional Documentation</h2>
                    <p className="final-cta-subtitle-aidoc">Start your 3-day free trial and cancel anytime. 30-day money-back guarantee</p>
                    <button onClick={handleGenerate} className="cta-button-aidoc">
                        Get Started
                    </button>
                </div>
            </section>
            <Footer />
        </div>
    );
};

export default DocumentationLanding;

