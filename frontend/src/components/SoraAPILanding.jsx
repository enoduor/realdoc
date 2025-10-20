import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import Navigation from './Navigation';
import Footer from './Footer';
import WaitlistModal from './WaitlistModal';
import './SoraAPILanding.css';

const SoraAPILanding = () => {
  const { isSignedIn, user } = useUser();
  const [copiedCode, setCopiedCode] = useState(false);
  const [openFAQ, setOpenFAQ] = useState(null);
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);

  // Remember that user visited Sora API page
  useEffect(() => {
    localStorage.setItem('preferredDashboard', 'sora-api');
    
    // SEO Optimization for Sora API
    document.title = 'Sora 2 API - OpenAI Text-to-Video Generation API | Available Now';
    
    // Update meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Official Sora 2 API for developers. OpenAI-powered text-to-video generation API now available. Create AI videos with simple REST API. 10 free credits, $0.20 per video. Sora API access starts today.');
    }
    
    // Update keywords meta tag
    let metaKeywords = document.querySelector('meta[name="keywords"]');
    if (!metaKeywords) {
      metaKeywords = document.createElement('meta');
      metaKeywords.setAttribute('name', 'keywords');
      document.head.appendChild(metaKeywords);
    }
    metaKeywords.setAttribute('content', 'Sora API, Sora 2 API, OpenAI Sora, text-to-video API, AI video generation API, video generation API, Sora API available now, OpenAI video API, text to video, AI video maker API, Sora API access, Sora video generation, AI video API, Sora developer API, OpenAI Sora 2, video AI API, automated video generation');
    
    // Update Open Graph tags
    let ogTitle = document.querySelector('meta[property="og:title"]');
    if (!ogTitle) {
      ogTitle = document.createElement('meta');
      ogTitle.setAttribute('property', 'og:title');
      document.head.appendChild(ogTitle);
    }
    ogTitle.setAttribute('content', 'Sora 2 API - OpenAI Text-to-Video Generation API Available Now');
    
    let ogDescription = document.querySelector('meta[property="og:description"]');
    if (!ogDescription) {
      ogDescription = document.createElement('meta');
      ogDescription.setAttribute('property', 'og:description');
      document.head.appendChild(ogDescription);
    }
    ogDescription.setAttribute('content', 'Access OpenAI Sora 2 API for text-to-video generation. Create stunning AI videos with our REST API. 10 free credits to start, $0.20 per video. Simple integration, enterprise-grade reliability.');
    
    // Add structured data for API Product
    const existingScript = document.querySelector('script[type="application/ld+json"][data-page="sora-api"]');
    if (existingScript) {
      existingScript.remove();
    }
    
    const structuredData = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebPage",
          "@id": "https://reelpostly.com/sora-api/#webpage",
          "url": "https://reelpostly.com/sora-api",
          "name": "Sora 2 API: OpenAI Text-to-Video Generation | ReelPostly",
          "headline": "Sora 2 API: OpenAI Text-to-Video Generation",
          "description": "Access OpenAI Sora 2 API for text-to-video generation. Create stunning AI videos with our REST API. 10 free credits to start, $0.20-$0.60 per video. Simple integration, enterprise-grade reliability.",
          "inLanguage": "en",
          "isPartOf": { "@id": "https://reelpostly.com/#website" },
          "breadcrumb": {
            "@type": "BreadcrumbList",
            "itemListElement": [
              {"@type":"ListItem","position":1,"name":"Home","item":"https://reelpostly.com/"},
              {"@type":"ListItem","position":2,"name":"Sora API","item":"https://reelpostly.com/sora-api"}
            ]
          },
          "publisher": { "@id": "https://reelpostly.com/#org" },
          "primaryImageOfPage": {
            "@type": "ImageObject",
            "url": "https://reelpostly.com/og-sora.jpg"
          },
          "mainEntity": {
            "@type": "ItemList",
            "name": "Sora API Features",
            "itemListElement": [
              {
                "@type": "ListItem",
                "position": 1,
                "name": "Sora-2 Standard Model",
                "description": "Standard quality video generation at $0.20 per video (1 credit)"
              },
              {
                "@type": "ListItem",
                "position": 2,
                "name": "Sora-2 Pro Model",
                "description": "Professional quality video generation at $0.60 per video (3 credits)"
              },
              {
                "@type": "ListItem",
                "position": 3,
                "name": "Instant Credit Application",
                "description": "Credits applied via Stripe webhook with idempotency—works with 100% off coupons."
              },
              {
                "@type": "ListItem",
                "position": 4,
                "name": "Developer-Friendly",
                "description": "API keys, balance endpoint, and clear usage reporting."
              }
            ]
          }
        },
        {
          "@type": "SoftwareApplication",
          "@id": "https://reelpostly.com/sora-api/#app",
          "name": "ReelPostly Sora 2 API",
          "applicationCategory": "DeveloperApplication",
          "operatingSystem": "Web",
          "url": "https://reelpostly.com/sora-api",
          "publisher": { "@id": "https://reelpostly.com/#org" },
          "offers": {
            "@type": "OfferCatalog",
            "name": "Sora API Credit Packs",
            "itemListElement": [
              {
                "@type": "Offer",
                "name": "$10 Credit Pack (50 credits)",
                "price": "10.00",
                "priceCurrency": "USD",
                "description": "50 video generations (Sora-2 Standard) or 16 video generations (Sora-2 Pro)",
                "url": "https://reelpostly.com/sora-api#pack-10"
              },
              {
                "@type": "Offer",
                "name": "$20 Credit Pack (100 credits)",
                "price": "20.00",
                "priceCurrency": "USD",
                "description": "100 video generations (Sora-2 Standard) or 33 video generations (Sora-2 Pro)",
                "url": "https://reelpostly.com/sora-api#pack-20"
              },
              {
                "@type": "Offer",
                "name": "$50 Credit Pack (250 credits)",
                "price": "50.00",
                "priceCurrency": "USD",
                "description": "250 video generations (Sora-2 Standard) or 83 video generations (Sora-2 Pro)",
                "url": "https://reelpostly.com/sora-api#pack-50"
              },
              {
                "@type": "Offer",
                "name": "$100 Credit Pack (500 credits)",
                "price": "100.00",
                "priceCurrency": "USD",
                "description": "500 video generations (Sora-2 Standard) or 166 video generations (Sora-2 Pro)",
                "url": "https://reelpostly.com/sora-api#pack-100"
              }
            ]
          }
        },
        {
          "@type": "Organization",
          "@id": "https://reelpostly.com/#org",
          "name": "ReelPostly",
          "url": "https://reelpostly.com",
          "logo": "https://reelpostly.com/logo.png"
        },
        {
          "@type": "WebSite",
          "@id": "https://reelpostly.com/#website",
          "name": "ReelPostly",
          "url": "https://reelpostly.com"
        }
      ]
    };
    
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-page', 'sora-api');
    script.textContent = JSON.stringify(structuredData);
    document.head.appendChild(script);
  }, []);

  const toggleFAQ = (index) => {
    setOpenFAQ(openFAQ === index ? null : index);
  };

  const codeExample = `import requests

# Standard quality
response = requests.post(
    'https://api.reelpostly.com/video/generate',
    headers={
        'x-api-key': '<YOUR_API_KEY>',
        'Content-Type': 'application/json'
    },
    json={
        'prompt': 'A serene tea farm at sunrise with golden light',
        'model': 'sora-2',
        'seconds': 8,
        'size': '1280x720'
    }
)

# Professional quality
response = requests.post(
    'https://api.reelpostly.com/video/generate',
    headers={
        'x-api-key': '<YOUR_API_KEY>',
        'Content-Type': 'application/json'
    },
    json={
        'prompt': 'A serene tea farm at sunrise with golden light',
        'model': 'sora-2-pro',
        'seconds': 8,
        'size': '1280x720'
    }
)

video_data = response.json()
print(f"Video ID: {video_data['video_id']}")
print(f"Credits remaining: {video_data['credits_remaining']}")

# Check video status
status_response = requests.get(
    f"https://api.reelpostly.com/video/status/{video_data['video_id']}",
    headers={'x-api-key': '<YOUR_API_KEY>'}
)
status_data = status_response.json()
print(f"Status: {status_data['status']}")`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(codeExample);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="sora-api-landing">
      <Navigation />

      {/* Hero Section with Quick Start */}
      <section className="api-hero">
        <div className="hero-container">
          <div className="hero-content">
            <div className="hero-text">
              <div className="hero-badge">
                <span className="badge-icon">🎬</span>
                <span>Powered by OpenAI Sora 2 • Available Now</span>
              </div>
              <h1 className="hero-title">
                Sora 2 API
              </h1>
              <p className="hero-subtitle">
                Generate high-quality AI videos from text prompts with our simple REST API for OpenAI's Sora 2.
                Build video generation into your applications with enterprise-grade reliability and instant API access.
              </p>
              <div id="get-api-key" className="hero-cta">
                {isSignedIn ? (
                  <Link to="/app/sora-api-dashboard" className="cta-primary-large">
                    Get Your API Key
                  </Link>
                ) : (
                  <button onClick={() => setShowWaitlistModal(true)} className="cta-primary-large">
                    Get Free API Key
                  </button>
                )}
              </div>
              <div className="hero-stats">
                <div className="stat-item">
                  <div className="stat-value">4K</div>
                  <div className="stat-label">Resolution</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">60 FPS</div>
                  <div className="stat-label">Frame Rate</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">99.9%</div>
                  <div className="stat-label">Uptime</div>
                </div>
              </div>
            </div>
            <div className="hero-code">
              <div className="code-header">
                <h3>Quick Start</h3>
                <button onClick={handleCopyCode} className="copy-btn">
                  {copiedCode ? '✓ Copied!' : '📋 Copy Code'}
                </button>
              </div>
              <pre className="code-block">
                <code>{codeExample}</code>
              </pre>
              <div className="code-features">
                <div className="code-feature">
                  <span className="feature-icon">⚡</span>
                  <span>Fast Response Time</span>
                </div>
                <div className="code-feature">
                  <span className="feature-icon">🔄</span>
                  <span>Automatic Retries</span>
                </div>
                <div className="code-feature">
                  <span className="feature-icon">📊</span>
                  <span>Usage Tracking</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Start Guide Section */}
      <section id="quickstart" className="quickstart-section">
        <div className="quickstart-container">
          <h2 className="section-title">Quick Start Guide</h2>
          <div className="quickstart-cta">
            {isSignedIn ? (
              <Link to="/app/sora-api-dashboard" className="cta-primary-large">
                Get Your API Key
              </Link>
            ) : (
              <button onClick={() => setShowWaitlistModal(true)} className="cta-primary-large">
                Get Free API Key
              </button>
            )}
          </div>
          <div className="docs-steps">
            <div className="doc-step">
              <div className="step-number">1</div>
              <h3>Get Your API Key</h3>
              <p>Sign up for a free account and get your API key instantly from the dashboard</p>
              <code className="endpoint-code">Get free credits</code>
            </div>
            <div className="doc-step">
              <div className="step-number">2</div>
              <h3>Create Video</h3>
              <p>Send a POST request to generate your video with a text prompt</p>
              <code className="endpoint-code">POST https://api.reelpostly.com/video/generate</code>
            </div>
            <div className="doc-step">
              <div className="step-number">3</div>
              <h3>Check Status</h3>
              <p>Poll the status endpoint to track progress and get the video URL when ready</p>
              <code className="endpoint-code">GET https://api.reelpostly.com/video/status/{'{id}'}</code>
            </div>
            <div className="doc-step">
              <div className="step-number">4</div>
              <h3>Download & Use</h3>
              <p>Download your generated video from the provided S3 URL and use it in your app</p>
              <code className="endpoint-code">Video delivered as presigned S3 URL (7-day expiry)</code>
            </div>
          </div>
        </div>
      </section>

      {/* Powerful Features Section */}
      <section id="features" className="features-section">
        <div className="features-container">
          <h2 className="section-title">Powerful Features</h2>
          <p className="section-subtitle">Everything you need to generate stunning AI videos</p>
          
          <div className="features-cta">
            {isSignedIn ? (
              <Link to="/app/sora-api-dashboard" className="cta-primary-large">
                Get Your API Key
              </Link>
            ) : (
              <button onClick={() => setShowWaitlistModal(true)} className="cta-primary-large">
                Get Free API Key
              </button>
            )}
          </div>
          
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🎨</div>
              <h3>High-Resolution Output</h3>
              <p>Generate videos up to 4K UHD with 30-60 FPS for professional-grade content</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3>Real-Time Processing</h3>
              <p>Near real-time video generation with GPU acceleration for fast results</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">🎯</div>
              <h3>Style Customization</h3>
              <p>Choose from photorealistic, animated, or cinematic styles for your videos</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">🔒</div>
              <h3>Secure & Private</h3>
              <p>Enterprise-grade security with API key authentication and encrypted transfers</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">📈</div>
              <h3>Scalable Infrastructure</h3>
              <p>Handle multiple concurrent requests with automatic load balancing</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">💰</div>
              <h3>Credit-Based Pricing</h3>
              <p>Pay only for what you use with transparent credit-based billing</p>
            </div>
          </div>
        </div>
      </section>


      {/* FAQ Section */}
      <section className="faq-section">
        <div className="faq-container">
          <h2 className="section-title">Frequently Asked Questions</h2>
          <p className="section-subtitle">Everything you need to know about Reelpostly Sora 2 API</p>
          
          
          <div className="faq-grid">
            <div className={`faq-item ${openFAQ === 0 ? 'active' : ''}`} onClick={() => toggleFAQ(0)}>
              <div className="faq-question-wrapper">
                <h3 className="faq-question">What is the Sora 2 API?</h3>
                <span className="faq-icon">{openFAQ === 0 ? '−' : '+'}</span>
              </div>
              <div className={`faq-answer ${openFAQ === 0 ? 'open' : ''}`}>
                <p>
                  The Sora 2 API is an AI-powered video generation service that allows you to create high-quality, realistic videos from text descriptions. Simply provide a prompt, and our API returns a professionally generated video.
                </p>
              </div>
            </div>

            <div className={`faq-item ${openFAQ === 1 ? 'active' : ''}`} onClick={() => toggleFAQ(1)}>
              <div className="faq-question-wrapper">
                <h3 className="faq-question">What video formats are supported?</h3>
                <span className="faq-icon">{openFAQ === 1 ? '−' : '+'}</span>
              </div>
              <div className={`faq-answer ${openFAQ === 1 ? 'open' : ''}`}>
                <p>
                  We support multiple resolutions including 720x1280 (portrait), 1280x720 (landscape), 1024x1792 (tall), and 1792x1024 (wide). Videos are delivered in MP4 format with up to 4K resolution.
                </p>
              </div>
            </div>

            <div className={`faq-item ${openFAQ === 2 ? 'active' : ''}`} onClick={() => toggleFAQ(2)}>
              <div className="faq-question-wrapper">
                <h3 className="faq-question">How long does video generation take?</h3>
                <span className="faq-icon">{openFAQ === 2 ? '−' : '+'}</span>
              </div>
              <div className={`faq-answer ${openFAQ === 2 ? 'open' : ''}`}>
                <p>
                  Video generation typically takes 1-3 minutes depending on the length and complexity. You can poll the status endpoint to check progress and download the video when ready.
                </p>
              </div>
            </div>

            <div className={`faq-item ${openFAQ === 3 ? 'active' : ''}`} onClick={() => toggleFAQ(3)}>
              <div className="faq-question-wrapper">
                <h3 className="faq-question">Is there a rate limit?</h3>
                <span className="faq-icon">{openFAQ === 3 ? '−' : '+'}</span>
              </div>
              <div className={`faq-answer ${openFAQ === 3 ? 'open' : ''}`}>
                <p>
                  Yes, the Starter plan allows 10 requests per second with a burst capacity of 20. Pro and Enterprise plans offer higher limits. All plans include 1,000 requests per month.
                </p>
              </div>
            </div>

            <div className={`faq-item ${openFAQ === 4 ? 'active' : ''}`} onClick={() => toggleFAQ(4)}>
              <div className="faq-question-wrapper">
                <h3 className="faq-question">Can I use this for commercial projects?</h3>
                <span className="faq-icon">{openFAQ === 4 ? '−' : '+'}</span>
              </div>
              <div className={`faq-answer ${openFAQ === 4 ? 'open' : ''}`}>
                <p>
                  Absolutely! All generated videos are yours to use commercially. You retain full rights to use the videos in your applications, websites, or products.
                </p>
              </div>
            </div>

            <div className={`faq-item ${openFAQ === 5 ? 'active' : ''}`} onClick={() => toggleFAQ(5)}>
              <div className="faq-question-wrapper">
                <h3 className="faq-question">How do I get started?</h3>
                <span className="faq-icon">{openFAQ === 5 ? '−' : '+'}</span>
              </div>
              <div className={`faq-answer ${openFAQ === 5 ? 'open' : ''}`}>
                <p>
                  Sign up for a free account, get your API key from the dashboard, and start making requests. We provide free credits to get you started, and you can add more credits anytime.
                </p>
              </div>
            </div>

            <div className={`faq-item ${openFAQ === 6 ? 'active' : ''}`} onClick={() => toggleFAQ(6)}>
              <div className="faq-question-wrapper">
                <h3 className="faq-question">What support do you offer?</h3>
                <span className="faq-icon">{openFAQ === 6 ? '−' : '+'}</span>
              </div>
              <div className={`faq-answer ${openFAQ === 6 ? 'open' : ''}`}>
                <p>
                  We offer email support for all plans, priority support for Pro users, and dedicated support with SLA guarantees for Enterprise customers. Contact us at support@reelpostly.com.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />

      {/* Waitlist Modal */}
      <WaitlistModal 
        isOpen={showWaitlistModal} 
        onClose={() => setShowWaitlistModal(false)} 
      />
    </div>
  );
};

export default SoraAPILanding;

