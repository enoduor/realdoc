import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import Navigation from './Navigation';
import PricingSection from './PricingSection';
import PlatformIcons from './PlatformIcons';
import Footer from './Footer';
import WaitlistModal from './WaitlistModal';
import './LandingPage.css';

const LandingPage = () => {
  const [openFAQ, setOpenFAQ] = useState(null);
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);
  const { isSignedIn } = useUser();

  // Handle Sora Videos Dashboard login
  const handleSoraLogin = () => {
    localStorage.setItem('preferredDashboard', 'sora');
    window.location.href = '/login?redirect=sora';
  };

  // Clear Sora API preference when visiting main landing page
  useEffect(() => {
    localStorage.setItem('preferredDashboard', 'main');
    
    // SEO Optimization for Main Landing Page
    document.title = 'ReelPostly - Sora 2 AI Video Generator & Multi-Platform Publisher | Create Once, Publish Everywhere';
    
    // Update meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Create AI videos with OpenAI Sora 2, generate captions, download trending content, and publish to Instagram, TikTok, YouTube, Facebook, LinkedIn & Twitter. All-in-one video creator with Sora-2 integration. 3-day free trial.');
    }
    
    // Update keywords meta tag
    let metaKeywords = document.querySelector('meta[name="keywords"]');
    if (!metaKeywords) {
      metaKeywords = document.createElement('meta');
      metaKeywords.setAttribute('name', 'keywords');
      document.head.appendChild(metaKeywords);
    }
    metaKeywords.setAttribute('content', 'Sora 2, Sora AI video, OpenAI Sora, AI video generator, text-to-video, multi-platform posting, social media publisher, Instagram publisher, TikTok publisher, YouTube publisher, AI captions, video downloader, content repurposing, Sora video maker, cross-platform posting, social media automation, AI content creation, Sora 2 generator, video AI tool');
    
    // Update Open Graph tags
    let ogTitle = document.querySelector('meta[property="og:title"]');
    if (!ogTitle) {
      ogTitle = document.createElement('meta');
      ogTitle.setAttribute('property', 'og:title');
      document.head.appendChild(ogTitle);
    }
    ogTitle.setAttribute('content', 'ReelPostly - Sora 2 AI Video Generator & Multi-Platform Publisher');
    
    let ogDescription = document.querySelector('meta[property="og:description"]');
    if (!ogDescription) {
      ogDescription = document.createElement('meta');
      ogDescription.setAttribute('property', 'og:description');
      document.head.appendChild(ogDescription);
    }
    ogDescription.setAttribute('content', 'Create AI videos with OpenAI Sora 2, generate platform-specific captions, download trending videos, and publish across all social media platforms in one click. All-in-one video creator powered by Sora-2 AI.');
    
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
          "@id": "https://reelpostly.com/#org",
          "name": "ReelPostly",
          "url": "https://reelpostly.com/",
          "logo": {
            "@type": "ImageObject",
            "url": "https://reelpostly.com/logo.png",
            "width": 512,
            "height": 512
          },
          "sameAs": [
            "https://www.linkedin.com/company/reelpostly",
            "https://x.com/reelpostly",
            "https://www.youtube.com/@reelpostly"
          ]
        },
        {
          "@type": "WebSite",
          "@id": "https://reelpostly.com/#website",
          "url": "https://reelpostly.com/",
          "name": "ReelPostly",
          "publisher": { "@id": "https://reelpostly.com/#org" },
          "potentialAction": {
            "@type": "SearchAction",
            "target": "https://reelpostly.com/search?q={query}",
            "query-input": "required name=query"
          }
        },
        {
          "@type": "WebApplication",
          "@id": "https://reelpostly.com/#app",
          "name": "ReelPostly",
          "applicationCategory": "BusinessApplication",
          "operatingSystem": "Web",
          "url": "https://reelpostly.com/",
          "description": "AI-powered content automation: create once, publish everywhere across Instagram, TikTok, YouTube, Facebook, LinkedIn, and X. Features Sora 2 AI video generation, smart captions, and multi-platform publishing.",
          "offers": {
            "@type": "Offer",
            "price": "0.00",
            "priceCurrency": "USD",
            "category": "FreeTrial",
            "url": "https://reelpostly.com/register"
          },
          "publisher": { "@id": "https://reelpostly.com/#org" }
        },
        {
          "@type": "WebPage",
          "@id": "https://reelpostly.com/#webpage",
          "url": "https://reelpostly.com/",
          "name": "ReelPostly - Sora 2 AI Video Generator & Multi-Platform Publisher | Create Once, Publish Everywhere",
          "headline": "Create once, publish across platforms",
          "description": "Create AI videos with OpenAI Sora 2, generate captions, download trending content, and publish to Instagram, TikTok, YouTube, Facebook, LinkedIn & Twitter. All-in-one video creator with Sora-2 integration. 3-day free trial.",
          "inLanguage": "en",
          "isPartOf": { "@id": "https://reelpostly.com/#website" },
          "about": { "@id": "https://reelpostly.com/#app" },
          "primaryImageOfPage": {
            "@type": "ImageObject",
            "url": "https://reelpostly.com/og-hero.jpg"
          },
          "publisher": { "@id": "https://reelpostly.com/#org" },
          "mainEntity": {
            "@type": "ItemList",
            "name": "ReelPostly Features",
            "itemListElement": [
              {
                "@type": "ListItem",
                "position": 1,
                "name": "Sora 2 AI Video Generation",
                "item": "https://reelpostly.com/#ai-video-generation",
                "description": "Create stunning AI videos with OpenAI Sora 2. Generate professional videos from text prompts in minutes."
              },
              {
                "@type": "ListItem",
                "position": 2,
                "name": "Multi-Platform Publishing",
                "item": "https://reelpostly.com/#multi-platform-posting",
                "description": "Publish to Instagram, TikTok, YouTube, Facebook, LinkedIn, and X from one dashboard."
              },
              {
                "@type": "ListItem",
                "position": 3,
                "name": "AI Captions & Hashtags",
                "item": "https://reelpostly.com/#ai-captions",
                "description": "AI-powered captions, hashtag recommendations, and per-platform customization."
              },
              {
                "@type": "ListItem",
                "position": 4,
                "name": "Video Download & Repurposing",
                "item": "https://reelpostly.com/#video-download",
                "description": "Download trending videos and repurpose them with your unique perspective."
              },
              {
                "@type": "ListItem",
                "position": 5,
                "name": "Instant Post Confirmation",
                "item": "https://reelpostly.com/#confirmation-links",
                "description": "Direct, hyperlinked previews for each live post after publishing."
              }
            ]
          },
          "potentialAction": {
            "@type": "RegisterAction",
            "name": "Start Free Today",
            "target": {
              "@type": "EntryPoint",
              "urlTemplate": "https://reelpostly.com/register",
              "actionPlatform": [
                "https://schema.org/DesktopWebPlatform",
                "https://schema.org/MobileWebPlatform"
              ]
            }
          }
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
      <section id="sora" className="hero-section modern-hero">
        <div className="hero-container">
          <div className="hero-content">
            <div className="hero-badge">
              <span className="badge-icon">🎬</span>
              <span>Powered by OpenAI Sora 2 • Available Now</span>
            </div>
            <h1 className="hero-title">Share Sora videos across platforms</h1>
              <p className="hero-subtitle">
              Save time and cost - Create one Sora video, add comments, and publish to multiple platforms in seconds.   </p>
            <div className="hero-cta">
              <button onClick={handleSoraLogin} className="cta-primary cta-sora">
                Try it for free
              </button>
            </div>
            <div className="hero-video">
              <div className="video-embed-hero">
                <iframe 
                  width="100%" 
                  height="100%" 
                  src="https://www.youtube.com/embed/kCkV-lsHjx4?autoplay=1&loop=1&playlist=kCkV-lsHjx4&mute=1&controls=0&showinfo=0&rel=0" 
                  title="Sora-2 AI Video Generation Demo" 
                  frameBorder="0" 
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                  allowFullScreen
                ></iframe>
              </div>
            </div>
            <div className="social-proof">
              <p className="social-proof-text">Video creation now powered by OpenAI's Sora 2 model</p>
            </div>
          </div>
        </div>
      </section>

      {/* CROSS-POSTING Section */}
      {/* <section className="modern-main-feature">
        <div className="modern-container">
          <div className="modern-content">
            <div className="modern-text">
              <h2 className="modern-badge">CROSS-POSTING</h2>
              <h3 className="modern-title">Post to all platforms instantly</h3>
              <p className="modern-description">
                Publish everywhere in 30 seconds, not 30 minutes. Manage all your personal and brand accounts without switching back and forth. Connect your social media accounts and publish your content across all platforms with a single click - no learning curve required.
              </p>
              <div className="modern-actions">
                <button onClick={() => setShowWaitlistModal(true)} className="modern-cta">Start posting</button>
                <button className="modern-link">View platforms</button>
              </div>
            </div>
            <div className="modern-visual">
              <div className="platform-showcase">
                <div className="platform-grid">
                  <div className="platform-item">Facebook</div>
                  <div className="platform-item">Instagram</div>
                  <div className="platform-item">Twitter</div>
                  <div className="platform-item">LinkedIn</div>
                  <div className="platform-item">TikTok</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section> */}

      {/* AI VIDEO GENERATION Section */}
      {/* <section className="modern-main-feature">
        <div className="modern-container">
          <div className="modern-content modern-reverse">
            <div className="modern-visual">
              <div className="window-demo">
                <div className="window-header">
                  <div className="window-controls">
                    <div className="control close"></div>
                    <div className="control minimize"></div>
                    <div className="control maximize"></div>
                  </div>
                  <div className="window-title">Sora Video Generator</div>
                </div>
                <div className="window-content">
                  <img 
                    src="/sora-demo.png" 
                    alt="Sora-2 AI Video Generation Demo" 
                    className="demo-image"
                  />
                </div>
              </div>
            </div>
            <div className="modern-text">
              <h2 className="modern-badge">AI VIDEO GENERATION</h2>
              <h3 className="modern-title">Create stunning videos with Sora-2</h3>
              <p className="modern-description">
                Generate professional AI videos in minutes. Just describe what you want to see, and Sora-2 creates unique, high-quality videos for your content. No video editing skills required.
              </p>
              <div className="modern-actions">
                <button onClick={() => setShowWaitlistModal(true)} className="modern-cta">Get started</button>
                <button onClick={handleSoraLogin} className="modern-link">Sign In to Sora Dashboard</button>
              </div>
            </div>
          </div>
        </div>
      </section> */}

      {/* Features Section */}
      <section id="features" className="features-section">
        {/* Video Downloads */}
        {/* <div className="feature-block feature-block-dark modern-layout">
          <div className="feature-container">
            <div className="feature-content">
              <div className="feature-visual">
                <div className="window-demo">
                  <div className="window-header">
                    <div className="window-controls">
                      <div className="control close"></div>
                      <div className="control minimize"></div>
                      <div className="control maximize"></div>
                    </div>
                    <div className="window-title">Caption Generator</div>
                  </div>
                  <div className="window-content">
                    <img 
                      src="/captions-demo.png" 
                      alt="AI Caption Generation Demo - ReelPostly Smart Captions" 
                      className="demo-image"
                    />
                  </div>
                </div>
              </div>
              <div className="feature-text">
                <div className="feature-badge">AI CAPTIONS</div>
                <h2 className="feature-title">Generate captions that convert</h2>
                <p className="feature-description">
                  Fine-tune every caption to match your tone, audience, and brand voice. Adjust for different demographics, content styles, and calls to action. Make each post feel truly personalized.
                </p>
                <button onClick={() => setShowWaitlistModal(true)} className="feature-cta">Try captions</button>
              </div>
            </div>
          </div>
        </div> */}

        {/* Video Downloads */}
        {/* <div className="feature-block feature-block-dark modern-layout">
          <div className="feature-container">
            <div className="feature-content">
              <div className="feature-text">
                <div className="feature-badge">CONTENT REPURPOSING</div>
                <h2 className="feature-title">Download and repurpose trending videos</h2>
                <p className="feature-description">
                  Find popular videos across platforms and repurpose them for your content strategy. Download high-quality videos and give them new life with your unique perspective.
                </p>
                <button onClick={() => setShowWaitlistModal(true)} className="feature-cta">Start downloading</button>
              </div>
              <div className="feature-visual">
                <div className="window-demo">
                  <div className="window-header">
                    <div className="window-controls">
                      <div className="control close"></div>
                      <div className="control minimize"></div>
                      <div className="control maximize"></div>
                    </div>
                    <div className="window-title">Video Downloader</div>
                  </div>
                  <div className="window-content">
                    <img 
                      src="/download-demo.png" 
                      alt="Video Download and Repurpose Demo" 
                      className="demo-image"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div> */}
            
        {/* Multi-Platform Publishing */}
        <div className="feature-block feature-block-light">
          <div className="feature-container">
            <div className="feature-badge">CROSS-POSTING</div>
            <h2 className="feature-title">Post to popular platforms instantly</h2>
            <p className="feature-description">
            Post to the platforms below in seconds, not minutes. Just connect your social accounts and share your content across these four platforms with one click.   </p>
            <button onClick={handleSoraLogin} className="cta-primary cta-sora">Try it for free</button>
            <div className="platforms-showcase">
              <PlatformIcons />
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      {/* <section className="testimonials-section">
        <div className="testimonials-container">
          <h2 className="testimonials-title">Loved by busy creators</h2>
          <p className="testimonials-subtitle">Here's what our users are saying</p>
          
          <div className="testimonials-grid">
            <div className="testimonial-card">
              <p className="testimonial-text">"The video quality options are perfect! I use Sora-2 Pro for my premium content and Standard for quick posts. The quality difference is amazing."</p>
              <div className="testimonial-author">
                <div className="author-name">Sarah Chen</div>
                <div className="author-handle">@sarahcreates</div>
              </div>
            </div>
            
            <div className="testimonial-card">
              <p className="testimonial-text">"I love the 4, 8, and 12-second video options! Perfect for different platforms - quick clips for TikTok and longer stories for Instagram."</p>
              <div className="testimonial-author">
                <div className="author-name">Mike Rodriguez</div>
                <div className="author-handle">@mikebuilds</div>
              </div>
            </div>
            
            <div className="testimonial-card">
              <p className="testimonial-text">"The portrait and landscape orientations are game-changers! Perfect for Instagram stories and YouTube shorts. No more cropping issues!"</p>
              <div className="testimonial-author">
                <div className="author-name">Jessica Park</div>
                <div className="author-handle">@jessicaonline</div>
              </div>
            </div>
            
            <div className="testimonial-card">
              <p className="testimonial-text">"The video enhancement features are incredible! Adding captions, adjusting effects, and customizing every detail makes my videos stand out."</p>
              <div className="testimonial-author">
                <div className="author-name">David Kim</div>
                <div className="author-handle">@davidtech</div>
              </div>
            </div>
            
            <div className="testimonial-card">
              <p className="testimonial-text">"Publishing directly to Facebook, Instagram, LinkedIn, and YouTube with one click saves me hours! The multi-platform publishing is seamless."</p>
              <div className="testimonial-author">
                <div className="author-name">Alex Johnson</div>
                <div className="author-handle">@alexgrows</div>
              </div>
            </div>
            
            <div className="testimonial-card">
              <p className="testimonial-text">"The credit system is perfect! $20 for 8 credits means I can create 8 high-quality videos. Much better than paying per platform!"</p>
              <div className="testimonial-author">
                <div className="author-name">Emma Watson</div>
                <div className="author-handle">@emmacontent</div>
              </div>
            </div>
          </div>
        </div>
      </section> */}

      {/* Pricing Section */}
      {/* <section id="pricing">
        <PricingSection />
      </section> */}


      {/* Final CTA */}
      {/* <section className="final-cta-section">
        <div className="final-cta-container">
          <h2 className="final-cta-title">Ready to transform your content strategy?</h2>
          <p className="final-cta-subtitle">
            Join creators who save hours every week with Reelpostly. Start your free trial today.
          </p>
          <button onClick={handleSoraLogin} className="cta-primary cta-sora">
            Try it for free
          </button>
          <p className="final-cta-note">3-day free trial • No credit card required • Cancel anytime</p>
        </div>
      </section> */}

      {/* FAQ Section */}
      <section id="faq" className="faq-section">
        <div className="faq-container">
          <h2 className="section-title">Frequently Asked Questions</h2>
          <p className="section-subtitle">Everything you need to know about Sora-2 AI video generation</p>
          
          <div className="faq-grid">
            <div className={`faq-item ${openFAQ === 0 ? 'active' : ''}`} onClick={() => toggleFAQ(0)}>
              <div className="faq-question-wrapper">
                <h3 className="faq-question">What video quality options are available?</h3>
                <span className="faq-icon">{openFAQ === 0 ? '−' : '+'}</span>
              </div>
              <div className={`faq-answer ${openFAQ === 0 ? 'open' : ''}`}>
                <p>
                  You can choose between Sora-2 Standard ($0.20/video) and Sora-2 Pro ($0.60/video) for highest quality. Both options generate professional videos with different quality levels to match your needs and budget.
                </p>
              </div>
            </div>

            <div className={`faq-item ${openFAQ === 1 ? 'active' : ''}`} onClick={() => toggleFAQ(1)}>
              <div className="faq-question-wrapper">
                <h3 className="faq-question">What video durations can I create?</h3>
                <span className="faq-icon">{openFAQ === 1 ? '−' : '+'}</span>
              </div>
              <div className={`faq-answer ${openFAQ === 1 ? 'open' : ''}`}>
                <p>
                  You can generate videos in 4, 8, or 12-second durations. Choose the length that works best for your content - shorter clips for quick attention or longer videos for more detailed storytelling.
                </p>
              </div>
            </div>

            <div className={`faq-item ${openFAQ === 2 ? 'active' : ''}`} onClick={() => toggleFAQ(2)}>
              <div className="faq-question-wrapper">
                <h3 className="faq-question">What video orientations are supported?</h3>
                <span className="faq-icon">{openFAQ === 2 ? '−' : '+'}</span>
              </div>
              <div className={`faq-answer ${openFAQ === 2 ? 'open' : ''}`}>
                <p>
                  Create videos in Portrait (720x1280) for Instagram/TikTok, Landscape (1280x720) for YouTube/Twitter, Tall Portrait (1024x1792), or Wide Landscape (1792x1024) formats to match your platform requirements.
                </p>
              </div>
            </div>

            <div className={`faq-item ${openFAQ === 3 ? 'active' : ''}`} onClick={() => toggleFAQ(3)}>
              <div className="faq-question-wrapper">
                <h3 className="faq-question">How do I enhance my generated videos?</h3>
                <span className="faq-icon">{openFAQ === 3 ? '−' : '+'}</span>
              </div>
              <div className={`faq-answer ${openFAQ === 3 ? 'open' : ''}`}>
                <p>
                  After generating your video, you can add captions, adjust effects, apply filters, and customize every detail to make your videos truly stand out with your own voice and style.
                </p>
              </div>
            </div>

            <div className={`faq-item ${openFAQ === 4 ? 'active' : ''}`} onClick={() => toggleFAQ(4)}>
              <div className="faq-question-wrapper">
                <h3 className="faq-question">Can I publish videos directly to social platforms?</h3>
                <span className="faq-icon">{openFAQ === 4 ? '−' : '+'}</span>
              </div>
              <div className={`faq-answer ${openFAQ === 4 ? 'open' : ''}`}>
                <p>
                  Yes! You can publish your enhanced videos directly to Facebook, Instagram, LinkedIn, and YouTube with one click. Connect your accounts and share your content across multiple platforms instantly.
                </p>
              </div>
            </div>

            <div className={`faq-item ${openFAQ === 5 ? 'active' : ''}`} onClick={() => toggleFAQ(5)}>
              <div className="faq-question-wrapper">
                <h3 className="faq-question">How do credits work for video generation?</h3>
                <span className="faq-icon">{openFAQ === 5 ? '−' : '+'}</span>
              </div>
              <div className={`faq-answer ${openFAQ === 5 ? 'open' : ''}`}>
                <p>
                  Each video generation costs 1 credit. You can purchase 8 credits for $20. Credits are deducted from your account after successful video generation, and you can see your remaining balance in real-time.
                </p>
              </div>
            </div>
          </div>
          
          {/* Try it for free button at end of FAQ */}
          <div style={{ textAlign: 'center', marginTop: '3rem' }}>
            <button onClick={handleSoraLogin} className="cta-primary cta-sora">
              Try it for free
            </button>
          </div>
        </div>
      </section>

      
      

      <Footer />

      {/* Waitlist Modal */}
      <WaitlistModal 
        isOpen={showWaitlistModal} 
        onClose={() => setShowWaitlistModal(false)} 
      />
    </div>
  );
};

export default LandingPage;
