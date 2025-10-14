import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navigation from './Navigation';
import PricingSection from './PricingSection';
import PlatformIcons from './PlatformIcons';
import Footer from './Footer';
import WaitlistModal from './WaitlistModal';
import './LandingPage.css';

const LandingPage = () => {
  const [openFAQ, setOpenFAQ] = useState(null);
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);

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
      <section className="hero-section">
        <div className="hero-container">
          <div className="hero-content">
            <h1 className="hero-title">Create once and publish to all platforms</h1>
            <p className="hero-subtitle">
              Post to all social platforms from one dashboard. Easy to use, fairly priced, with human support.
            </p>
            <div className="hero-cta">
              <button onClick={() => setShowWaitlistModal(true)} className="cta-primary">
                Try it for free
              </button>
              <Link to="/login" className="cta-secondary">
                Sign In
              </Link>
            </div>
            <div className="social-proof">
              <p className="social-proof-text">Video creation now powered by OpenAI's Sora 2 model</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features-section">
        {/* AI Video Generation */}
        <div className="feature-block feature-block-dark">
          <div className="feature-container">
            <div className="feature-badge">AI VIDEO GENERATION</div>
            <h2 className="feature-title">Create stunning videos with Sora-2</h2>
            <p className="feature-description">
              Generate professional AI videos in minutes. Just describe what you want to see, and Sora-2 creates unique, high-quality videos for your content. No video editing skills required.
            </p>
            <button onClick={() => setShowWaitlistModal(true)} className="feature-cta">Get started</button>
            <div className="feature-visual">
              <div className="video-embed">
                <iframe 
                  width="100%" 
                  height="100%" 
                  src="https://www.youtube.com/embed/kCkV-lsHjx4?autoplay=1&loop=1&playlist=kCkV-lsHjx4&mute=1" 
                  title="Sora-2 AI Video Generation Demo" 
                  frameBorder="0" 
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                  allowFullScreen
                ></iframe>
              </div>
            </div>
          </div>
            </div>

        {/* AI Captions */}
        <div className="feature-block feature-block-light">
          <div className="feature-container">
            <div className="feature-badge">AI CAPTIONS</div>
            <h2 className="feature-title">Generate captions that convert</h2>
            <p className="feature-description">
              Fine-tune every caption to match your tone, audience, and brand voice. Adjust for different demographics, content styles, and calls to action. Make each post feel truly personalized.
            </p>
            <button onClick={() => setShowWaitlistModal(true)} className="feature-cta">Try captions</button>
            <div className="feature-visual">
              <div className="video-embed">
                <img 
                  src="/captions.png" 
                  alt="AI Caption Generation Demo - ReelPostly Smart Captions" 
                  className="feature-image"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Video Downloads */}
        <div className="feature-block feature-block-dark">
          <div className="feature-container">
            <div className="feature-badge">CONTENT REPURPOSING</div>
            <h2 className="feature-title">Download and repurpose trending videos</h2>
            <p className="feature-description">
              Find popular videos across platforms and repurpose them for your content strategy. Download high-quality videos and give them new life with your unique perspective.
            </p>
            <button onClick={() => setShowWaitlistModal(true)} className="feature-cta">Start downloading</button>
            <div className="feature-visual">
              <div className="video-embed">
            <iframe
              width="100%"
              height="100%"
                  src="https://www.youtube.com/embed/VsJspuzH2WQ?autoplay=1&loop=1&playlist=VsJspuzH2WQ&mute=1" 
                  title="Video Download and Repurpose Demo" 
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div>
            </div>
          </div>
            </div>
            
        {/* Multi-Platform Publishing */}
        <div className="feature-block feature-block-light">
          <div className="feature-container">
            <div className="feature-badge">CROSS-POSTING</div>
            <h2 className="feature-title">Post to all platforms instantly</h2>
            <p className="feature-description">
            Post everywhere in seconds, not minutes. Just connect your social accounts and share your content across every platform with one click with no setup and no learning curve.   </p>
            <button onClick={() => setShowWaitlistModal(true)} className="feature-cta">Start posting</button>
            <div className="platforms-showcase">
              <PlatformIcons />
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="testimonials-section">
        <div className="testimonials-container">
          <h2 className="testimonials-title">Loved by busy creators</h2>
          <p className="testimonials-subtitle">Here's what our users are saying</p>
          
          <div className="testimonials-grid">
            <div className="testimonial-card">
              <p className="testimonial-text">"Reelpostly saves me hours every week. The AI video generation is a game-changer for my content strategy."</p>
              <div className="testimonial-author">
                <div className="author-name">Sarah Chen</div>
                <div className="author-handle">@sarahcreates</div>
              </div>
            </div>
            
            <div className="testimonial-card">
              <p className="testimonial-text">"Finally, a social media tool that actually understands creators. The caption AI is incredibly smart."</p>
              <div className="testimonial-author">
                <div className="author-name">Mike Rodriguez</div>
                <div className="author-handle">@mikebuilds</div>
              </div>
            </div>
            
            <div className="testimonial-card">
              <p className="testimonial-text">"Best investment for my business. I can focus on creating while Reelpostly handles the distribution."</p>
              <div className="testimonial-author">
                <div className="author-name">Jessica Park</div>
                <div className="author-handle">@jessicaonline</div>
              </div>
            </div>
            
            <div className="testimonial-card">
              <p className="testimonial-text">"The Sora integration is insane. I'm creating professional videos without any editing experience."</p>
              <div className="testimonial-author">
                <div className="author-name">David Kim</div>
                <div className="author-handle">@davidtech</div>
              </div>
            </div>
            
            <div className="testimonial-card">
              <p className="testimonial-text">"$9/month for this level of features? This should be illegal. Best value in social media tools."</p>
              <div className="testimonial-author">
                <div className="author-name">Alex Johnson</div>
                <div className="author-handle">@alexgrows</div>
              </div>
            </div>
            
            <div className="testimonial-card">
              <p className="testimonial-text">"Downloaded trending videos, added my spin with AI captions, published everywhere. Growth has been amazing!"</p>
              <div className="testimonial-author">
                <div className="author-name">Emma Watson</div>
                <div className="author-handle">@emmacontent</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing">
        <PricingSection />
      </section>


      {/* Final CTA */}
      <section className="final-cta-section">
        <div className="final-cta-container">
          <h2 className="final-cta-title">Ready to transform your content strategy?</h2>
          <p className="final-cta-subtitle">
            Join creators who save hours every week with Reelpostly. Start your free trial today.
          </p>
          <button onClick={() => setShowWaitlistModal(true)} className="cta-primary-large">
            Try for free
          </button>
          <p className="final-cta-note">3-day free trial • No credit card required • Cancel anytime</p>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="faq-section">
        <div className="faq-container">
          <h2 className="section-title">Frequently Asked Questions</h2>
          <p className="section-subtitle">Everything you need to know about Reelpostly</p>
          
          <div className="faq-grid">
            <div className={`faq-item ${openFAQ === 0 ? 'active' : ''}`} onClick={() => toggleFAQ(0)}>
              <div className="faq-question-wrapper">
                <h3 className="faq-question">How does AI video generation work?</h3>
                <span className="faq-icon">{openFAQ === 0 ? '−' : '+'}</span>
              </div>
              <div className={`faq-answer ${openFAQ === 0 ? 'open' : ''}`}>
                <p>
                  Simply describe what you want to see, and our Sora-2 AI creates a professional video in 1-2 minutes. No video editing experience needed. You can choose duration, orientation, and quality.
                </p>
              </div>
            </div>

            <div className={`faq-item ${openFAQ === 1 ? 'active' : ''}`} onClick={() => toggleFAQ(1)}>
              <div className="faq-question-wrapper">
                <h3 className="faq-question">What platforms can I publish to?</h3>
                <span className="faq-icon">{openFAQ === 1 ? '−' : '+'}</span>
              </div>
              <div className={`faq-answer ${openFAQ === 1 ? 'open' : ''}`}>
                <p>
                  We support Instagram, Facebook, Twitter/X, LinkedIn, YouTube, and TikTok. Connect unlimited accounts and publish to all platforms with one click.
                </p>
              </div>
            </div>

            <div className={`faq-item ${openFAQ === 2 ? 'active' : ''}`} onClick={() => toggleFAQ(2)}>
              <div className="faq-question-wrapper">
                <h3 className="faq-question">Can I customize captions per platform?</h3>
                <span className="faq-icon">{openFAQ === 2 ? '−' : '+'}</span>
              </div>
              <div className={`faq-answer ${openFAQ === 2 ? 'open' : ''}`}>
                <p>
                  Yes! Our AI generates platform-optimized captions, and you can fine-tune each one to match your brand voice, audience demographics, and content style before publishing.
                </p>
              </div>
            </div>

            <div className={`faq-item ${openFAQ === 3 ? 'active' : ''}`} onClick={() => toggleFAQ(3)}>
              <div className="faq-question-wrapper">
                <h3 className="faq-question">How does video downloading work?</h3>
                <span className="faq-icon">{openFAQ === 3 ? '−' : '+'}</span>
              </div>
              <div className={`faq-answer ${openFAQ === 3 ? 'open' : ''}`}>
                <p>
                  Enter a video URL from supported platforms, and we'll download it for you. Perfect for repurposing trending content with your own unique spin and AI-generated captions.
                </p>
              </div>
            </div>

            <div className={`faq-item ${openFAQ === 4 ? 'active' : ''}`} onClick={() => toggleFAQ(4)}>
              <div className="faq-question-wrapper">
                <h3 className="faq-question">Can I cancel anytime?</h3>
                <span className="faq-icon">{openFAQ === 4 ? '−' : '+'}</span>
              </div>
              <div className={`faq-answer ${openFAQ === 4 ? 'open' : ''}`}>
                <p>
                  Yes, there's no lock-in. Cancel your subscription anytime during the month. You'll still have access to all features until the end of your billing period.
                </p>
              </div>
            </div>

            <div className={`faq-item ${openFAQ === 5 ? 'active' : ''}`} onClick={() => toggleFAQ(5)}>
              <div className="faq-question-wrapper">
                <h3 className="faq-question">Do I need to share my social media passwords?</h3>
                <span className="faq-icon">{openFAQ === 5 ? '−' : '+'}</span>
              </div>
              <div className={`faq-answer ${openFAQ === 5 ? 'open' : ''}`}>
                <p>
                  No, we never ask for passwords. We use official OAuth authentication provided by each platform, which means you log in securely through their official pages.
                </p>
              </div>
            </div>

            <div className={`faq-item ${openFAQ === 6 ? 'active' : ''}`} onClick={() => toggleFAQ(6)}>
              <div className="faq-question-wrapper">
                <h3 className="faq-question">Is there a free trial?</h3>
                <span className="faq-icon">{openFAQ === 6 ? '−' : '+'}</span>
              </div>
              <div className={`faq-answer ${openFAQ === 6 ? 'open' : ''}`}>
                <p>
                  Yes! Get a 3-day free trial with full access to all features. No credit card required upfront. Cancel anytime with our 30-day money-back guarantee.
                </p>
              </div>
            </div>

            <div className={`faq-item ${openFAQ === 7 ? 'active' : ''}`} onClick={() => toggleFAQ(7)}>
              <div className="faq-question-wrapper">
                <h3 className="faq-question">What makes Reelpostly different?</h3>
                <span className="faq-icon">{openFAQ === 7 ? '−' : '+'}</span>
              </div>
              <div className={`faq-answer ${openFAQ === 7 ? 'open' : ''}`}>
                <p>
                  We combine AI video generation, smart caption writing, content repurposing, and multi-platform publishing in one affordable tool. Most platforms charge $75-200/month for similar features.
                </p>
              </div>
            </div>
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
