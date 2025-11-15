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
            AI-Powered Solutions for SEO, Analytics, and Documentation
          </h1>
          
          <p className="hero-subtitle-aidoc">
            Transform your workflow with three powerful AI tools. Optimize your SEO, analyze your website with competitor insights, and generate comprehensive documentation - all in minutes, no technical skills required.
          </p>

          {/* Three Hero Cards */}
          <div className="hero-cards-container" style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '30px' }}>
            <div 
              onClick={() => navigate('/seo')} 
              style={{ cursor: 'pointer', padding: '24px', border: '2px solid #e5e7eb', borderRadius: '12px', textAlign: 'center', minWidth: '250px', transition: 'all 0.3s' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.15)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔍</div>
              <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px' }}>SEO Generator</h3>
              <p style={{ fontSize: '14px', color: '#6b7280' }}>AI-powered SEO analysis and optimization recommendations</p>
            </div>
            <div 
              onClick={() => navigate('/analytics')} 
              style={{ cursor: 'pointer', padding: '24px', border: '2px solid #e5e7eb', borderRadius: '12px', textAlign: 'center', minWidth: '250px', transition: 'all 0.3s' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.15)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>📊</div>
              <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px' }}>Website Analyzer</h3>
              <p style={{ fontSize: '14px', color: '#6b7280' }}>Competitor analysis, traffic insights, and revenue intelligence</p>
            </div>
            <div 
              onClick={() => navigate('/documentation')} 
              style={{ cursor: 'pointer', padding: '24px', border: '2px solid #e5e7eb', borderRadius: '12px', textAlign: 'center', minWidth: '250px', transition: 'all 0.3s' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.15)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>📚</div>
              <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px' }}>Document Generator</h3>
              <p style={{ fontSize: '14px', color: '#6b7280' }}>Create comprehensive docs, user guides, API docs, and more</p>
            </div>
          </div>


          {/* Steps Section */}
          <div className="steps-section-aidoc">
            <div className="step-item">
              <div className="step-number">Step 1</div>
              <h3>Fill out the form with your website or app details</h3>
            </div>
            <div className="step-item">
              <div className="step-number">Step 2</div>
              <h3>AI generates SEO reports, analytics, and comprehensive documentation</h3>
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
        <div className="featured-logos" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '40px', flexWrap: 'wrap' }}>
          <svg width="80" height="24" viewBox="0 0 80 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <text x="0" y="18" fontFamily="Arial, sans-serif" fontSize="16" fontWeight="600" fill="#333">WIRED</text>
          </svg>
          <svg width="100" height="24" viewBox="0 0 100 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <text x="0" y="18" fontFamily="Arial, sans-serif" fontSize="16" fontWeight="600" fill="#333">PC Guide</text>
          </svg>
          <svg width="60" height="24" viewBox="0 0 60 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <text x="0" y="18" fontFamily="Arial, sans-serif" fontSize="16" fontWeight="600" fill="#333">GVS</text>
          </svg>
          <svg width="140" height="24" viewBox="0 0 140 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <text x="0" y="18" fontFamily="Arial, sans-serif" fontSize="16" fontWeight="600" fill="#333">Geeky Gadgets</text>
          </svg>
          <svg width="90" height="24" viewBox="0 0 90 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <text x="0" y="18" fontFamily="Arial, sans-serif" fontSize="16" fontWeight="600" fill="#333">Beebom</text>
          </svg>
        </div>
      </section>

      {/* Stats Section */}
      <section className="stats-section-aidoc">
        <div className="stats-container">
          <h2 className="stats-title">Super Fast AI-Powered Solutions</h2>
          <p className="stats-subtitle">Transform your workflow with SEO optimization, analytics, and documentation generation in seconds with AI</p>
          
          <div className="stats-badge">
            <p className="stats-text">Generate <strong>SEO reports, analytics, and complete documentation</strong> in minutes, not days</p>
          </div>
        </div>
      </section>

      {/* Key Features Section */}
      <section id="features" className="key-features-section-aidoc">
        <div className="features-container-aidoc">
          <h2 className="section-title-aidoc">Key Features</h2>
          
          <div className="features-grid-aidoc">
            <div className="feature-card-aidoc" onClick={() => navigate('/seo')} style={{ cursor: 'pointer' }}>
              <h3>Comprehensive SEO Analysis</h3>
              <p>Get detailed SEO reports covering technical SEO, on-page optimization, content strategy, mobile SEO, and page speed.</p>
            </div>
            
            <div className="feature-card-aidoc" onClick={() => navigate('/seo')} style={{ cursor: 'pointer' }}>
              <h3>8 SEO Focus Areas</h3>
              <p>Analyze Technical SEO, On-Page SEO, Content SEO, Off-Page SEO, Local SEO, Mobile SEO, Page Speed, and Accessibility.</p>
            </div>
            
            <div className="feature-card-aidoc" onClick={() => navigate('/analytics')} style={{ cursor: 'pointer' }}>
              <h3>Traffic & Competitor Analysis</h3>
              <p>Analyze website traffic patterns, compare with competitors, and get SimilarWeb-style insights for your site.</p>
            </div>
            
            <div className="feature-card-aidoc" onClick={() => navigate('/analytics')} style={{ cursor: 'pointer' }}>
              <h3>Revenue Intelligence</h3>
              <p>Discover how competitors make money - identify subscription models, advertising revenue, e-commerce, and monetization strategies.</p>
            </div>
            
            <div className="feature-card-aidoc" onClick={() => navigate('/documentation')} style={{ cursor: 'pointer' }}>
              <h3>7 Documentation Types</h3>
              <p>Generate User Guides, API Documentation, Developer Guides, Admin Docs, Quick Start Guides, FAQs, and Release Notes.</p>
            </div>
            
            <div className="feature-card-aidoc" onClick={() => navigate('/documentation')} style={{ cursor: 'pointer' }}>
              <h3>Web Crawling & Competitor Analysis</h3>
              <p>Provide your app URL and we'll crawl it, analyze competitors, and generate comprehensive documentation.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Why RealDoc Section */}
      <section className="why-section-aidoc">
        <div className="why-container">
          <h2 className="section-title-aidoc">Why RealDoc for AI-Powered Solutions?</h2>
          
          <div className="why-grid">
            <div className="why-item">
              <h3>⚡ Speed</h3>
              <p>Generate SEO reports, analytics, and complete documentation in minutes instead of spending days or weeks manually. Focus on building your product while we handle the analysis.</p>
            </div>
            
            <div className="why-item">
              <h3>🎯 Three Powerful Tools</h3>
              <p>SEO Generator, Website Analyzer, and Document Generator - all in one platform. No need to switch between multiple tools or learn different systems.</p>
            </div>
            
            <div className="why-item">
              <h3>📚 No Technical Skills Needed</h3>
              <p>Simply provide your website URL, enter competitor sites, or describe your feature. Our AI generates professional SEO reports, analytics, and documentation that follow industry best practices.</p>
            </div>
            
            <div className="why-item">
              <h3>🎨 Fully Customizable</h3>
              <p>Choose SEO focus areas and analytics components to match your needs. Control technical level, style, tone, target audience, language, and format for documentation.</p>
            </div>
            
            <div className="why-item">
              <h3>📄 Ready to Use</h3>
              <p>Receive comprehensive SEO reports, detailed analytics, and complete documentation with proper structure and formatting. Copy, download, and use immediately - no editing required.</p>
            </div>
            
            <div className="why-item">
              <h3>🌍 Multiple Formats & Languages</h3>
              <p>Export documentation in Markdown, HTML, or Plain Text. Generate reports in 10+ languages. Get the format and language you need for your workflow.</p>
            </div>
            
            <div className="why-item">
              <h3>🕷️ Web Crawling & Competitor Analysis</h3>
              <p>Provide your website URL and we'll automatically crawl your site, analyze competitors, and generate comprehensive SEO insights, analytics, and documentation based on real data.</p>
            </div>
            
            <div className="why-item">
              <h3>🔍 Comprehensive & Accurate</h3>
              <p>Our AI analyzes your website and competitors across SEO, analytics, and documentation to ensure all reports cover all aspects and follow industry best practices.</p>
            </div>
            
            <div className="why-item">
              <h3>🚀 All-in-One Platform</h3>
              <p>Get SEO optimization, website analytics, and documentation generation from a single platform. Streamline your workflow and save time with integrated AI-powered solutions.</p>
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
          <h2 className="final-cta-title-aidoc">Start Using AI-Powered Solutions Today</h2>
          <p className="final-cta-subtitle-aidoc">Optimize your SEO, analyze your website with competitor insights, and generate comprehensive documentation - all powered by AI.</p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/seo')} className="cta-button-aidoc">SEO Generator</button>
            <button onClick={() => navigate('/analytics')} className="cta-button-aidoc">Website Analyzer</button>
            <button onClick={() => navigate('/documentation')} className="cta-button-aidoc">Document Generator</button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default LandingPage;
