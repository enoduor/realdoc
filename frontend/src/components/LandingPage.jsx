import React from 'react';
import { Link } from 'react-router-dom';
import PricingSection from './PricingSection';
import PlatformIcons from './PlatformIcons';
import Footer from './Footer';
import './LandingPage.css';

const LandingPage = () => {
  return (
    <div className="landing-page">
      {/* Navigation Bar */}
      <nav className="landing-nav">
        <div className="nav-container">
          <div className="nav-logo">
            <Link to="/" className="logo-link">
              <img src="/logo.png" alt="Reelpostly" className="logo-image" />
              <span className="logo-text">ReelPostly</span>
            </Link>
          </div>
          <div className="nav-links">
            <a href="#features" className="nav-link">Features</a>
            <a href="#pricing" className="nav-link">Pricing</a>
            <Link to="/about" className="nav-link">About</Link>
          </div>
          <div className="nav-actions">
            <Link to="/login" className="nav-btn nav-btn-secondary">Sign In</Link>
            <Link to="/register" className="nav-btn nav-btn-primary">Try it for free</Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-container">
          <div className="hero-content">
            <h1 className="hero-title">Create Videos with AI<br/> Publish Across Platforms</h1>
            <p className="hero-subtitle">
              Create videos with Sora-2 AI, write captions that actually connect, grab trending content, and post to all your platforms. Reelpostly has everything you need in one simple dashboard.
            </p>
            <div className="hero-cta">
              <Link to="/register" className="cta-primary">
                Try it for free
              </Link>
              <Link to="/login" className="cta-secondary">
                Sign In
              </Link>
            </div>
            <div className="social-proof">
              <p className="social-proof-text">Trusted by creators worldwide • Powered by Sora-2</p>
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
            <Link to="/register" className="feature-cta">Get started</Link>
            <div className="feature-visual">
              <div className="video-placeholder">
                <span className="placeholder-icon">🎬</span>
                <p className="placeholder-text">AI-Generated Video</p>
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
            <Link to="/register" className="feature-cta">Try captions</Link>
            <div className="feature-visual">
              <div className="caption-preview">
                <div className="caption-example">
                  <p className="caption-text">"🚀 Transform your social media game with AI..."</p>
                  <div className="caption-tags">#SocialMedia #ContentCreation #AI</div>
                </div>
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
            <Link to="/register" className="feature-cta">Start downloading</Link>
            <div className="feature-visual">
              <div className="video-placeholder">
                <span className="placeholder-icon">📥</span>
                <p className="placeholder-text">Video Download Tool</p>
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
              Publish everywhere in 30 seconds, not 30 minutes. Connect your social media accounts and publish your content across all platforms with a single click - no learning curve required.
            </p>
            <Link to="/register" className="feature-cta">Start posting</Link>
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

      {/* Supported Platforms */}
      <section className="platforms-section">
        <div className="platforms-container">
          <h2 className="section-title">Supported Platforms</h2>
          <p className="section-subtitle">Post to all these platforms from one dashboard</p>
          <div className="platforms-grid">
            <PlatformIcons />
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="faq-section">
        <div className="faq-container">
          <h2 className="section-title">Frequently Asked Questions</h2>
          <p className="section-subtitle">Everything you need to know about Reelpostly</p>
          
          <div className="faq-grid">
            <div className="faq-item">
              <h3 className="faq-question">How does AI video generation work?</h3>
              <p className="faq-answer">
                Simply describe what you want to see, and our Sora-2 AI creates a professional video in 1-2 minutes. No video editing experience needed. You can choose duration, orientation, and quality.
              </p>
            </div>

            <div className="faq-item">
              <h3 className="faq-question">What platforms can I publish to?</h3>
              <p className="faq-answer">
                We support Instagram, Facebook, Twitter/X, LinkedIn, YouTube, and TikTok. Connect unlimited accounts and publish to all platforms with one click.
              </p>
            </div>

            <div className="faq-item">
              <h3 className="faq-question">Can I customize captions per platform?</h3>
              <p className="faq-answer">
                Yes! Our AI generates platform-optimized captions, and you can fine-tune each one to match your brand voice, audience demographics, and content style before publishing.
              </p>
            </div>

            <div className="faq-item">
              <h3 className="faq-question">How does video downloading work?</h3>
              <p className="faq-answer">
                Enter a video URL from supported platforms, and we'll download it for you. Perfect for repurposing trending content with your own unique spin and AI-generated captions.
              </p>
            </div>

            <div className="faq-item">
              <h3 className="faq-question">Can I cancel anytime?</h3>
              <p className="faq-answer">
                Yes, there's no lock-in. Cancel your subscription anytime during the month. You'll still have access to all features until the end of your billing period.
              </p>
            </div>

            <div className="faq-item">
              <h3 className="faq-question">Do I need to share my social media passwords?</h3>
              <p className="faq-answer">
                No, we never ask for passwords. We use official OAuth authentication provided by each platform, which means you log in securely through their official pages.
              </p>
            </div>

            <div className="faq-item">
              <h3 className="faq-question">Is there a free trial?</h3>
              <p className="faq-answer">
                Yes! Get a 3-day free trial with full access to all features. No credit card required upfront. Cancel anytime with our 30-day money-back guarantee.
              </p>
            </div>

            <div className="faq-item">
              <h3 className="faq-question">What makes Reelpostly different?</h3>
              <p className="faq-answer">
                We combine AI video generation, smart caption writing, content repurposing, and multi-platform publishing in one affordable tool. Most platforms charge $75-200/month for similar features.
              </p>
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
          <Link to="/register" className="cta-primary-large">
            Try for free
          </Link>
          <p className="final-cta-note">3-day free trial • No credit card required • Cancel anytime</p>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default LandingPage;
