import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navigation from './Navigation';
import PricingSection from './PricingSection';
import Footer from './Footer';
import './LandingPage.css';

const LandingPage = () => {
  const [openFAQ, setOpenFAQ] = useState(null);
  const navigate = useNavigate();

  // Navigate to Documentation Generator
  const handleGetStarted = (docType = null) => {
    if (docType) {
      navigate(`/app/documentation-generator?type=${docType}`);
    } else {
      navigate('/app/documentation-generator');
    }
  };

  // SEO and page setup
  useEffect(() => {
    document.title = 'RealDoc - AI-Powered Documentation Generator | Create Comprehensive Docs for Your Applications';
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Generate comprehensive documentation for your online applications with AI. Create user guides, API docs, developer guides, and more in minutes. Supports multiple formats and technical levels.');
    }
    
    let metaKeywords = document.querySelector('meta[name="keywords"]');
    if (!metaKeywords) {
      metaKeywords = document.createElement('meta');
      metaKeywords.setAttribute('name', 'keywords');
      document.head.appendChild(metaKeywords);
    }
    metaKeywords.setAttribute('content', 'documentation generator, AI documentation, API documentation, user guide generator, developer guide, technical documentation, markdown generator, documentation automation, AI docs, API docs generator');
    
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

      {/* Hero Section - Matching aidocmaker.com */}
      <section className="hero-section-aidoc">
        <div className="hero-container-aidoc">
          <div className="hero-badges-aidoc">
            <span className="badge-aidoc">Unlimited Usage</span>
            <span className="badge-aidoc">1-Click Generate</span>
            <span className="badge-aidoc">Free Downloads</span>
            <span className="badge-aidoc">No Signup</span>
          </div>
          
          <h1 className="hero-title-aidoc">
            Get Complete, Ready-to-Use Documentation in Minutes
          </h1>
          
          <p className="hero-subtitle-aidoc">
            Generate professional documentation instantly. Fill out a simple form, click generate, and receive complete documentation with proper structure, formatting, and code examples. Copy, download, or use immediately - no technical writing skills required.
          </p>

          <div className="doc-types-selector">
            <div className="doc-type-icon active" onClick={() => handleGetStarted('user-guide')} style={{ cursor: 'pointer' }}>📖 User Guide</div>
            <div className="doc-type-icon" onClick={() => handleGetStarted('api-docs')} style={{ cursor: 'pointer' }}>🔌 API Docs</div>
            <div className="doc-type-icon" onClick={() => handleGetStarted('developer-guide')} style={{ cursor: 'pointer' }}>👨‍💻 Developer Guide</div>
            <div className="doc-type-icon" onClick={() => handleGetStarted('admin-docs')} style={{ cursor: 'pointer' }}>⚙️ Admin Docs</div>
            <div className="doc-type-icon" onClick={() => handleGetStarted('quick-start')} style={{ cursor: 'pointer' }}>🚀 Quick Start</div>
            <div className="doc-type-icon" onClick={() => handleGetStarted('faq')} style={{ cursor: 'pointer' }}>❓ FAQ</div>
            <div className="doc-type-icon" onClick={() => handleGetStarted('release-notes')} style={{ cursor: 'pointer' }}>📝 Release Notes</div>
          </div>

          <button onClick={handleGetStarted} className="generate-btn-aidoc">
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

      {/* Featured In Section */}
      <section className="featured-section-aidoc">
        <p className="featured-label">Featured in</p>
        <div className="featured-logos">
          <span className="logo-text">Wired</span>
          <span className="logo-text">PC Guide</span>
          <span className="logo-text">GVS</span>
          <span className="logo-text">Geeky Gadgets</span>
          <span className="logo-text">Beebom</span>
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

      {/* Key Features Section */}
      <section id="features" className="key-features-section-aidoc">
        <div className="features-container-aidoc">
          <h2 className="section-title-aidoc">Key Features</h2>
          
          <div className="features-grid-aidoc">
            <div className="feature-card-aidoc" onClick={() => handleGetStarted()} style={{ cursor: 'pointer' }}>
              <h3>7 Documentation Types</h3>
              <p>Generate User Guides, API Documentation, Developer Guides, Admin Docs, Quick Start Guides, FAQs, and Release Notes.</p>
            </div>
            
            <div className="feature-card-aidoc" onClick={() => handleGetStarted()} style={{ cursor: 'pointer' }}>
              <h3>Web Crawling & Competitor Analysis</h3>
              <p>Provide your app URL and we'll crawl it, analyze competitors, and generate comprehensive documentation.</p>
            </div>
            
            <div className="feature-card-aidoc" onClick={() => handleGetStarted()} style={{ cursor: 'pointer' }}>
              <h3>Multiple Output Formats</h3>
              <p>Export to Markdown (.md), HTML (.html), or Plain Text (.txt) - download in the format you need.</p>
            </div>
            
            <div className="feature-card-aidoc" onClick={() => handleGetStarted()} style={{ cursor: 'pointer' }}>
              <h3>Fully Customizable</h3>
              <p>Control technical level, style, tone, target audience, language, and format to match your needs.</p>
            </div>
            
            <div className="feature-card-aidoc" onClick={() => handleGetStarted()} style={{ cursor: 'pointer' }}>
              <h3>Ready to Use</h3>
              <p>Receive complete documentation with proper structure, formatting, and code examples - no editing required.</p>
            </div>
            
            <div className="feature-card-aidoc" onClick={() => handleGetStarted()} style={{ cursor: 'pointer' }}>
              <h3>Multi-Language Support</h3>
              <p>Generate documentation in 10+ languages including English, Spanish, French, German, and more.</p>
            </div>
            
            <div className="feature-card-aidoc" onClick={() => handleGetStarted()} style={{ cursor: 'pointer' }}>
              <h3>Code Examples Included</h3>
              <p>Automatically include code examples with syntax highlighting placeholders when enabled.</p>
            </div>
            
            <div className="feature-card-aidoc" onClick={() => handleGetStarted()} style={{ cursor: 'pointer' }}>
              <h3>Instant Generation</h3>
              <p>What takes days or weeks manually is done in minutes with AI-powered documentation generation.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Documentation Types Section */}
      <section className="free-tools-section-aidoc">
        <div className="free-tools-container">
          <h2 className="section-title-aidoc">Documentation Types</h2>
          <div className="free-tools-grid">
            <div className="free-tool-item" onClick={() => handleGetStarted('user-guide')} style={{ cursor: 'pointer' }}>
              <h3>📖 User Guide</h3>
              <p>Step-by-step instructions for end users</p>
            </div>
            <div className="free-tool-item" onClick={() => handleGetStarted('api-docs')} style={{ cursor: 'pointer' }}>
              <h3>🔌 API Documentation</h3>
              <p>Endpoints, parameters, responses, examples</p>
            </div>
            <div className="free-tool-item" onClick={() => handleGetStarted('developer-guide')} style={{ cursor: 'pointer' }}>
              <h3>👨‍💻 Developer Guide</h3>
              <p>Setup, architecture, integration guides</p>
            </div>
            <div className="free-tool-item" onClick={() => handleGetStarted('admin-docs')} style={{ cursor: 'pointer' }}>
              <h3>⚙️ Admin Documentation</h3>
              <p>Configuration, management, troubleshooting</p>
            </div>
            <div className="free-tool-item" onClick={() => handleGetStarted('quick-start')} style={{ cursor: 'pointer' }}>
              <h3>🚀 Quick Start Guide</h3>
              <p>Get started in minutes</p>
            </div>
            <div className="free-tool-item" onClick={() => handleGetStarted('faq')} style={{ cursor: 'pointer' }}>
              <h3>❓ FAQ</h3>
              <p>Common questions and answers</p>
            </div>
            <div className="free-tool-item" onClick={() => handleGetStarted('release-notes')} style={{ cursor: 'pointer' }}>
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
            
            <div className="why-item">
              <h3>🕷️ Web Crawling & Competitor Analysis</h3>
              <p>Provide your app URL and we'll automatically crawl your website, analyze competitors, and generate comprehensive documentation based on real data.</p>
            </div>
            
            <div className="why-item">
              <h3>🔍 Comprehensive & Accurate</h3>
              <p>Our AI analyzes your app and competitors to ensure documentation covers all aspects and follows industry best practices.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing">
        <PricingSection />
      </section>

      {/* FAQ Section */}
      <section id="faq" className="faq-section-aidoc">
        <div className="faq-container-aidoc">
          <h2 className="section-title-aidoc">Frequently Asked Questions</h2>
          
          <div className="faq-grid-aidoc">
            <div className={`faq-item-aidoc ${openFAQ === 0 ? 'active' : ''}`} onClick={() => toggleFAQ(0)}>
              <div className="faq-question-wrapper-aidoc">
                <h3 className="faq-question-aidoc">What do I get when I generate documentation?</h3>
                <span className="faq-icon-aidoc">{openFAQ === 0 ? '−' : '+'}</span>
              </div>
              <div className={`faq-answer-aidoc ${openFAQ === 0 ? 'open' : ''}`}>
                <p>You receive complete, ready-to-use documentation with proper structure, headings, formatting, and code examples (if enabled). Each document includes word count, estimated read time, and format information. You can immediately copy to clipboard, download as a file, or preview the formatted output.</p>
              </div>
            </div>

            <div className={`faq-item-aidoc ${openFAQ === 1 ? 'active' : ''}`} onClick={() => toggleFAQ(1)}>
              <div className="faq-question-wrapper-aidoc">
                <h3 className="faq-question-aidoc">What output formats can I download?</h3>
                <span className="faq-icon-aidoc">{openFAQ === 1 ? '−' : '+'}</span>
              </div>
              <div className={`faq-answer-aidoc ${openFAQ === 1 ? 'open' : ''}`}>
                <p>You can download your documentation in three formats: Markdown (.md) for GitHub and docs sites, HTML (.html) for web pages, or Plain Text (.txt) for universal compatibility. Files are automatically named based on your app name and documentation type.</p>
              </div>
            </div>

            <div className={`faq-item-aidoc ${openFAQ === 2 ? 'active' : ''}`} onClick={() => toggleFAQ(2)}>
              <div className="faq-question-wrapper-aidoc">
                <h3 className="faq-question-aidoc">What types of documentation can I generate?</h3>
                <span className="faq-icon-aidoc">{openFAQ === 2 ? '−' : '+'}</span>
              </div>
              <div className={`faq-answer-aidoc ${openFAQ === 2 ? 'open' : ''}`}>
                <p>You can generate 7 different types: User Guides (step-by-step for end users), API Documentation (endpoints, parameters, examples), Developer Guides (setup, architecture), Admin Documentation (configuration, troubleshooting), Quick Start Guides, FAQs, and Release Notes. All from one platform.</p>
              </div>
            </div>

            <div className={`faq-item-aidoc ${openFAQ === 3 ? 'active' : ''}`} onClick={() => toggleFAQ(3)}>
              <div className="faq-question-wrapper-aidoc">
                <h3 className="faq-question-aidoc">Can I customize the documentation output?</h3>
                <span className="faq-icon-aidoc">{openFAQ === 3 ? '−' : '+'}</span>
              </div>
              <div className={`faq-answer-aidoc ${openFAQ === 3 ? 'open' : ''}`}>
                <p>Yes! You have full control: choose technical level (Beginner, Intermediate, Advanced), documentation style (Tutorial, Reference, Conceptual), tone (Technical, Friendly, Formal, Conversational), target audience (Developers, End Users, Admins, Business Users), output format, and language (10+ languages supported).</p>
              </div>
            </div>

            <div className={`faq-item-aidoc ${openFAQ === 4 ? 'active' : ''}`} onClick={() => toggleFAQ(4)}>
              <div className="faq-question-wrapper-aidoc">
                <h3 className="faq-question-aidoc">Do I need technical writing skills to use RealDoc?</h3>
                <span className="faq-icon-aidoc">{openFAQ === 4 ? '−' : '+'}</span>
              </div>
              <div className={`faq-answer-aidoc ${openFAQ === 4 ? 'open' : ''}`}>
                <p>No technical writing skills required. Simply describe your feature or application, select your preferences, and our AI generates professional documentation following industry best practices. The documentation is complete and ready to use - no editing needed.</p>
              </div>
            </div>

            <div className={`faq-item-aidoc ${openFAQ === 5 ? 'active' : ''}`} onClick={() => toggleFAQ(5)}>
              <div className="faq-question-wrapper-aidoc">
                <h3 className="faq-question-aidoc">How does the web crawling and competitor analysis work?</h3>
                <span className="faq-icon-aidoc">{openFAQ === 5 ? '−' : '+'}</span>
              </div>
              <div className={`faq-answer-aidoc ${openFAQ === 5 ? 'open' : ''}`}>
                <p>When you provide your app URL, RealDoc automatically crawls your website to gather information, searches for competitor applications, analyzes their documentation, and uses this comprehensive data to generate more accurate and complete documentation that follows industry best practices.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="final-cta-section-aidoc">
        <div className="final-cta-container-aidoc">
          <h2 className="final-cta-title-aidoc">Start Creating Powerful AI Documents Today</h2>
          <p className="final-cta-subtitle-aidoc">Sign up now and see how AI can transform your document creation process.</p>
          <button onClick={handleGetStarted} className="cta-button-aidoc">Get Started</button>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default LandingPage;
