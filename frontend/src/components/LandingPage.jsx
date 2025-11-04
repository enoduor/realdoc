import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navigation from './Navigation';
import PricingSection from './PricingSection';
import Footer from './Footer';
import './LandingPage.css';

const LandingPage = () => {
  const [openFAQ, setOpenFAQ] = useState(null);

  // Navigate to Documentation Generator
  const handleGetStarted = () => {
    window.location.href = '/app/documentation-generator';
  };

  // SEO and page setup
  useEffect(() => {
    // SEO Optimization for Main Landing Page
    document.title = 'RealDoc - AI-Powered Documentation Generator | Create Comprehensive Docs for Your Applications';
    
    // Update meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Generate comprehensive documentation for your online applications with AI. Create user guides, API docs, developer guides, and more in minutes. Supports multiple formats and technical levels.');
    }
    
    // Update keywords meta tag
    let metaKeywords = document.querySelector('meta[name="keywords"]');
    if (!metaKeywords) {
      metaKeywords = document.createElement('meta');
      metaKeywords.setAttribute('name', 'keywords');
      document.head.appendChild(metaKeywords);
    }
    metaKeywords.setAttribute('content', 'documentation generator, AI documentation, API documentation, user guide generator, developer guide, technical documentation, markdown generator, documentation automation, AI docs, API docs generator');
    
    // Update Open Graph tags
    let ogTitle = document.querySelector('meta[property="og:title"]');
    if (!ogTitle) {
      ogTitle = document.createElement('meta');
      ogTitle.setAttribute('property', 'og:title');
      document.head.appendChild(ogTitle);
    }
    ogTitle.setAttribute('content', 'RealDoc - AI-Powered Documentation Generator');
    
    let ogDescription = document.querySelector('meta[property="og:description"]');
    if (!ogDescription) {
      ogDescription = document.createElement('meta');
      ogDescription.setAttribute('property', 'og:description');
      document.head.appendChild(ogDescription);
    }
    ogDescription.setAttribute('content', 'Generate comprehensive documentation for your online applications with AI. Create user guides, API docs, developer guides, and more in minutes.');
    
    // Add structured data for SEO
    const existingScript = document.querySelector('script[type="application/ld+json"][data-page="main"]');
    if (existingScript) {
      existingScript.remove();
    }
    
    const structuredData = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": "https://realdoc.com/#org",
          "name": "RealDoc",
          "url": "https://realdoc.com/",
          "logo": {
            "@type": "ImageObject",
            "url": "https://realdoc.com/logo.png",
            "width": 512,
            "height": 512
          }
        },
        {
          "@type": "WebSite",
          "@id": "https://realdoc.com/#website",
          "url": "https://realdoc.com/",
          "name": "RealDoc",
          "publisher": { "@id": "https://realdoc.com/#org" }
        },
        {
          "@type": "WebApplication",
          "@id": "https://realdoc.com/#app",
          "name": "RealDoc",
          "applicationCategory": "BusinessApplication",
          "operatingSystem": "Web",
          "url": "https://realdoc.com/",
          "description": "AI-powered documentation generator for creating comprehensive documentation for online applications, including user guides, API documentation, developer guides, and more.",
          "offers": {
            "@type": "Offer",
            "price": "0.00",
            "priceCurrency": "USD",
            "category": "FreeTrial",
            "url": "https://realdoc.com/register"
          },
          "publisher": { "@id": "https://realdoc.com/#org" }
        }
      ]
    };
    
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-page', 'main');
    script.textContent = JSON.stringify(structuredData);
    document.head.appendChild(script);
  }, []);

  const toggleFAQ = (index) => {
    setOpenFAQ(openFAQ === index ? null : index);
  };

  return (
    <div className="landing-page">
      <Navigation />

      {/* Hero Section */}
      <section id="hero" className="hero-section modern-hero">
        <div className="hero-container">
          <div className="hero-content">
            <div className="hero-badge">
              <span className="badge-icon">📚</span>
              <span>AI-Powered Documentation</span>
            </div>
            <h1 className="hero-title">
              <strong>Get Complete, Ready-to-Use Documentation in Minutes</strong>
            </h1>
            <p className="hero-description">
              Generate professional documentation instantly. Fill out a simple form, click generate, and receive complete documentation with proper structure, formatting, and code examples. Copy, download, or use immediately - no technical writing skills required.
            </p>
            <div className="hero-cta">
              <button onClick={handleGetStarted} className="cta-primary">
                Start Generating Docs
              </button>
              <Link to="/pricing" className="modern-link">View Pricing</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features-section">
        <div className="feature-block feature-block-light">
          <div className="feature-container">
            <div className="feature-badge">DOCUMENTATION TYPES</div>
            <h2 className="feature-title">Generate Any Type of Documentation</h2>
            <p className="feature-description">
              From user guides to API documentation, developer guides to FAQs - generate comprehensive documentation tailored to your needs.
            </p>
            <div className="features-grid" style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
              <div className="feature-card">
                <h3>📖 User Guides</h3>
                <p>Step-by-step instructions for end users</p>
              </div>
              <div className="feature-card">
                <h3>🔌 API Documentation</h3>
                <p>Endpoints, parameters, responses, examples</p>
              </div>
              <div className="feature-card">
                <h3>👨‍💻 Developer Guides</h3>
                <p>Setup, architecture, integration guides</p>
              </div>
              <div className="feature-card">
                <h3>⚙️ Admin Documentation</h3>
                <p>Configuration, management, troubleshooting</p>
              </div>
              <div className="feature-card">
                <h3>🚀 Quick Start Guides</h3>
                <p>Get started in minutes</p>
              </div>
              <div className="feature-card">
                <h3>❓ FAQs</h3>
                <p>Common questions and answers</p>
              </div>
              <div className="feature-card">
                <h3>📝 Release Notes</h3>
                <p>Version changes, new features, breaking changes</p>
              </div>
            </div>
            <div style={{ marginTop: '2rem', textAlign: 'center' }}>
              <button onClick={handleGetStarted} className="cta-primary">Start Creating</button>
            </div>
          </div>
        </div>

        <div className="feature-block feature-block-dark">
          <div className="feature-container">
            <div className="feature-badge">WHAT YOU GET</div>
            <h2 className="feature-title">Complete Documentation, Ready to Use</h2>
            <p className="feature-description">
              Receive fully formatted, professional documentation with everything you need. No editing required - just copy, download, and use.
            </p>
            <div className="features-grid" style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
              <div className="feature-card">
                <h3>📄 Complete Documentation</h3>
                <p>Full documentation with headings, structure, and formatting - ready to use immediately</p>
              </div>
              <div className="feature-card">
                <h3>📋 Multiple Formats</h3>
                <p>Get Markdown, HTML, or Plain Text - download in the format you need</p>
              </div>
              <div className="feature-card">
                <h3>📊 Metrics & Insights</h3>
                <p>Word count, estimated read time, and format information included</p>
              </div>
              <div className="feature-card">
                <h3>📥 Copy & Download</h3>
                <p>One-click copy to clipboard or download with auto-generated filename</p>
              </div>
              <div className="feature-card">
                <h3>🎯 Customized Content</h3>
                <p>Tailored to your technical level, tone, audience, and style preferences</p>
              </div>
              <div className="feature-card">
                <h3>⚡ Generated in Minutes</h3>
                <p>What takes days or weeks manually is done in minutes with AI</p>
              </div>
            </div>
          </div>
        </div>

        <div className="feature-block feature-block-light">
          <div className="feature-container">
            <div className="feature-badge">CUSTOMIZATION</div>
            <h2 className="feature-title">Tailor Documentation to Your Exact Needs</h2>
            <p className="feature-description">
              Control every aspect of your documentation. Choose technical level, style, tone, target audience, language, and output format to match your requirements.
            </p>
            <div className="features-grid" style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
              <div className="feature-card">
                <h3>Technical Levels</h3>
                <p>Beginner, Intermediate, Advanced</p>
              </div>
              <div className="feature-card">
                <h3>Documentation Styles</h3>
                <p>Tutorial, Reference, Conceptual</p>
              </div>
              <div className="feature-card">
                <h3>Tone Options</h3>
                <p>Technical, Friendly, Formal, Conversational</p>
              </div>
              <div className="feature-card">
                <h3>Target Audiences</h3>
                <p>Developers, End Users, Admins, Business Users</p>
              </div>
              <div className="feature-card">
                <h3>Output Formats</h3>
                <p>Markdown (.md), HTML (.html), Plain Text (.txt)</p>
              </div>
              <div className="feature-card">
                <h3>Multi-Language</h3>
                <p>10+ languages supported</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Value Proposition Section */}
      <section className="testimonials-section">
        <div className="testimonials-container">
          <h2 className="testimonials-title">Why RealDoc?</h2>
          <p className="testimonials-subtitle">Get professional documentation without the complexity</p>
          
          <div className="testimonials-grid">
            <div className="testimonial-card">
              <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.75rem', color: '#2d3748' }}>⚡ Speed</h3>
              <p className="testimonial-text">Generate complete documentation in minutes instead of spending days or weeks writing manually. Focus on building your product while we handle the docs.</p>
            </div>
            
            <div className="testimonial-card">
              <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.75rem', color: '#2d3748' }}>🎯 One Tool, All Types</h3>
              <p className="testimonial-text">Generate user guides, API docs, developer guides, FAQs, and more from one platform. No need to switch between multiple tools or learn different systems.</p>
            </div>
            
            <div className="testimonial-card">
              <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.75rem', color: '#2d3748' }}>📚 No Technical Writing Skills Needed</h3>
              <p className="testimonial-text">Simply describe your feature or application. Our AI generates professional, well-structured documentation that follows industry best practices.</p>
            </div>
            
            <div className="testimonial-card">
              <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.75rem', color: '#2d3748' }}>🎨 Fully Customizable</h3>
              <p className="testimonial-text">Control technical level, style, tone, target audience, language, and format. Get documentation that perfectly matches your needs and audience.</p>
            </div>
            
            <div className="testimonial-card">
              <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.75rem', color: '#2d3748' }}>📄 Ready to Use</h3>
              <p className="testimonial-text">Receive complete documentation with proper structure, formatting, and code examples. Copy, download, and use immediately - no editing required.</p>
            </div>
            
            <div className="testimonial-card">
              <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.75rem', color: '#2d3748' }}>🌍 Multiple Formats & Languages</h3>
              <p className="testimonial-text">Export in Markdown, HTML, or Plain Text. Generate documentation in 10+ languages. Get the format and language you need for your workflow.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing">
        <PricingSection />
      </section>

      {/* FAQ Section */}
      <section id="faq" className="faq-section">
        <div className="faq-container">
          <h2 className="section-title">Frequently Asked Questions</h2>
          <p className="section-subtitle">Everything you need to know about RealDoc</p>
          
          <div className="faq-grid">
            <div className={`faq-item ${openFAQ === 0 ? 'active' : ''}`} onClick={() => toggleFAQ(0)}>
              <div className="faq-question-wrapper">
                <h3 className="faq-question">What do I get when I generate documentation?</h3>
                <span className="faq-icon">{openFAQ === 0 ? '−' : '+'}</span>
              </div>
              <div className={`faq-answer ${openFAQ === 0 ? 'open' : ''}`}>
                <p>
                  You receive complete, ready-to-use documentation with proper structure, headings, formatting, and code examples (if enabled). Each document includes word count, estimated read time, and format information. You can immediately copy to clipboard, download as a file, or preview the formatted output.
                </p>
              </div>
            </div>

            <div className={`faq-item ${openFAQ === 1 ? 'active' : ''}`} onClick={() => toggleFAQ(1)}>
              <div className="faq-question-wrapper">
                <h3 className="faq-question">What output formats can I download?</h3>
                <span className="faq-icon">{openFAQ === 1 ? '−' : '+'}</span>
              </div>
              <div className={`faq-answer ${openFAQ === 1 ? 'open' : ''}`}>
                <p>
                  You can download your documentation in three formats: Markdown (.md) for GitHub and docs sites, HTML (.html) for web pages, or Plain Text (.txt) for universal compatibility. Files are automatically named based on your app name and documentation type.
                </p>
              </div>
            </div>

            <div className={`faq-item ${openFAQ === 2 ? 'active' : ''}`} onClick={() => toggleFAQ(2)}>
              <div className="faq-question-wrapper">
                <h3 className="faq-question">How long does it take to generate documentation?</h3>
                <span className="faq-icon">{openFAQ === 2 ? '−' : '+'}</span>
              </div>
              <div className={`faq-answer ${openFAQ === 2 ? 'open' : ''}`}>
                <p>
                  Documentation generation typically takes just a few minutes. Fill out the form with your feature description, select your preferences, and click generate. You'll receive complete, formatted documentation ready to use immediately.
                </p>
              </div>
            </div>

            <div className={`faq-item ${openFAQ === 3 ? 'active' : ''}`} onClick={() => toggleFAQ(3)}>
              <div className="faq-question-wrapper">
                <h3 className="faq-question">What types of documentation can I generate?</h3>
                <span className="faq-icon">{openFAQ === 3 ? '−' : '+'}</span>
              </div>
              <div className={`faq-answer ${openFAQ === 3 ? 'open' : ''}`}>
                <p>
                  You can generate 7 different types: User Guides (step-by-step for end users), API Documentation (endpoints, parameters, examples), Developer Guides (setup, architecture), Admin Documentation (configuration, troubleshooting), Quick Start Guides, FAQs, and Release Notes. All from one platform.
                </p>
              </div>
            </div>

            <div className={`faq-item ${openFAQ === 4 ? 'active' : ''}`} onClick={() => toggleFAQ(4)}>
              <div className="faq-question-wrapper">
                <h3 className="faq-question">Can I customize the documentation output?</h3>
                <span className="faq-icon">{openFAQ === 4 ? '−' : '+'}</span>
              </div>
              <div className={`faq-answer ${openFAQ === 4 ? 'open' : ''}`}>
                <p>
                  Yes! You have full control: choose technical level (Beginner, Intermediate, Advanced), documentation style (Tutorial, Reference, Conceptual), tone (Technical, Friendly, Formal, Conversational), target audience (Developers, End Users, Admins, Business Users), output format, and language (10+ languages supported).
                </p>
              </div>
            </div>

            <div className={`faq-item ${openFAQ === 5 ? 'active' : ''}`} onClick={() => toggleFAQ(5)}>
              <div className="faq-question-wrapper">
                <h3 className="faq-question">Do I need technical writing skills to use RealDoc?</h3>
                <span className="faq-icon">{openFAQ === 5 ? '−' : '+'}</span>
              </div>
              <div className={`faq-answer ${openFAQ === 5 ? 'open' : ''}`}>
                <p>
                  No technical writing skills required. Simply describe your feature or application, select your preferences, and our AI generates professional documentation following industry best practices. The documentation is complete and ready to use - no editing needed.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default LandingPage;
