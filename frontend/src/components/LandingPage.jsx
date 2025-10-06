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
            {/* <a 
              href="https://bigvideograb.com/" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="nav-link"
            >
              Grab videos
            </a> */}
          </div>
          <div className="nav-actions">
            <Link to="/login" className="nav-btn nav-btn-secondary">Sign In</Link>
            <Link to="/register" className="nav-btn nav-btn-primary">Sign Up</Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-container">
          <div className="hero-content">
            <h1 className="hero-title">Create Once, Publish Everywhere!</h1>
            <p className="hero-subtitle">
            Creators are overwhelmed by too many tools and endless complexity. That's why we want you to join us in building an all-in-one platform so you can create, edit, and publish without ever leaving the app. We make it simple, so you can focus on creating, not juggling.  </p>
            <div className="hero-benefits">
                <ul className="space-y-3 text-left">
                    <li className="flex items-start">
                        <span className="text-green-500 mr-3 mt-1">✅</span>
                        <span>Save time, reduce costs, manage everything from one dashboard</span>
                    </li>
                    <li className="flex items-start">
                        <span className="text-green-500 mr-3 mt-1">✅</span>
                        <span>Create once and publish to all major platforms instantly</span>
                    </li>
                    <li className="flex items-start">
                        <span className="text-green-500 mr-3 mt-1">✅</span>
                        <span>Customize posts per platform with simple toggle and one-click publish</span>
                    </li>
                    <li className="flex items-start">
                        <span className="text-green-500 mr-3 mt-1">✅</span>
                        <span>Get direct, hyperlinked confirmations after each post publishes</span>
                    </li>
                    <li className="flex items-start">
                        <span className="text-green-500 mr-3 mt-1">✅</span>
                        <span>Craft engaging captions and hashtags effortlessly with AI tools</span>
                    </li>
                </ul>
            </div>
            <div id="hero-cta" className="hero-cta">
              <Link to="/register" className="cta-primary">
                Sign Up
              </Link>
              <Link to="/login" className="cta-secondary">
                Sign In
              </Link>
            </div>
            {/* <div className="hero-stats">
              <div className="stat">
                <span className="stat-number">Lifetime</span>
                <a 
                  href="https://docs.google.com/forms/d/e/1FAIpQLSdXGiQBAVMQy3lXGkNdRwqgfWw20E_VlXODYloiMo7L3bwYCw/viewform"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="stat-label text-white font-bold"
                >
                 Fill this form
                </a>
              </div>
            
              <div className="stat">
                <span className="stat-number">Launch Day </span>
                <a 
                  href="https://docs.google.com/forms/d/e/1FAIpQLSdXGiQBAVMQy3lXGkNdRwqgfWw20E_VlXODYloiMo7L3bwYCw/viewform"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="stat-label text-white font-bold"
                >
                 Get 30% Discount
                </a>
              </div>
            </div> */}
          </div>
          <div className="hero-image">
            <div className="hero-visual">
              <PlatformIcons />
            </div>
          </div>
        </div>
      </section>

      {/* Official Cards Section */}
      <section className="official-cards-section">
        <div className="official-cards-container">
          <div className="official-cards-grid">
            {/* Start Creating Card */}
            <div className="official-card start-creating-card">
              <div className="card-icon">🎯</div>
              <h3 className="card-title">Start with Captions</h3>
              <p className="card-description">
                Complete content creation workflow - captions, hashtags, media, and publishing
              </p>
              <Link to="/register" className="card-button start-creating-button">
                Get Started
              </Link>
            </div>

            {/* Download Videos Card */}
            {/* <div className="official-card download-videos-card">
              <div className="card-icon">📥</div>
              <h3 className="card-title">Start with Videos</h3>
              <p className="card-description">
                Find Videos to download and repurpose
              </p>
              <div className="platform-status">
                <span className="status-badge">TikTok, Facebook & Twitter</span>
              </div>
              <Link to="/register" className="card-button download-videos-button">
                Download Now
              </Link>
            </div> */}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="rp-section">
        <div className="features-container">
          <h2>How ReelPostly Works</h2>
          <p className="features-subtitle">Transform your content creation workflow with intelligent automation</p>
          
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🤖</div>
              <h3>AI-Powered Content Generation</h3>
              <p>Our intelligent system creates platform-specific captions and hashtags that feel natural on every channel. No more generic content—each post is tailored for maximum engagement.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">⚙️</div>
              <h3>Smart Platform Customization</h3>
              <p>Fine-tune your content for each platform with our intuitive editor. Adjust tone, length, and style to match each channel's unique audience and format requirements.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">✅</div>
              <h3>Instant Confirmation & Tracking</h3>
              <p>Get immediate confirmation with direct links to your live posts across all platforms. Track performance and engagement with built-in analytics and post monitoring.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pain Points Section */}
      <section id="pain-points" className="rp-section">
        <div className="pain-points-container">
          <h2>Stop Struggling With These Common Problems</h2>
          <p className="pain-points-subtitle">We built ReelPostly to solve the biggest frustrations in social media publishing</p>
          
          <div className="pain-points-grid">
            <div className="pain-point-card">
              <div className="pain-point-icon">⏰</div>
              <h3>Manual Posting Takes Forever</h3>
              <p>You spend hours uploading the same content to multiple platforms, tweaking formats, and managing different posting schedules. ReelPostly simplifies it with one upload shared everywhere.</p>
              <div className="pain-point-solution">
                <strong>Save valuable time and stay consistent across all your social channels.</strong>
              </div>
            </div>
            
            <div className="pain-point-card">
              <div className="pain-point-icon">💰</div>
              <h3>Overpriced Tools</h3>
              <p>Most social media tools charge enterprise-level prices for basic posting features that should be affordable for everyone. ReelPostly is built for individuals and small teams.</p>
              <div className="pain-point-solution">
                <strong>Get professional-grade automation without the heavy cost.</strong>
              </div>
            </div>
            
            <div className="pain-point-card">
              <div className="pain-point-icon">🎯</div>
              <h3>Too Many Unnecessary Features</h3>
              <p>Many tools are packed with complex options you'll never use, making simple posting feel overwhelming. ReelPostly focuses on what matters most.</p>
              <div className="pain-point-solution">
                <strong>No clutter, just a clean workflow that gets your content live faster.</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="rp-section">
        <div className="benefits-container">
          <h2>Why Creators Choose ReelPostly</h2>
          <p className="benefits-subtitle">Join thousands of content creators who've streamlined their workflow</p>
          
          <div className="benefits-list">
            <div className="benefit-item">
              <div className="benefit-icon">⏱️</div>
              <div className="benefit-content">
                <h4>Save Hours Every Week</h4>
                <p>One workflow replaces six separate uploads. What used to take hours now takes minutes.</p>
              </div>
            </div>
            
            <div className="benefit-item">
              <div className="benefit-icon">🎯</div>
              <div className="benefit-content">
                <h4>Platform-Optimized Content</h4>
                <p>AI generates content that performs better on each platform, increasing your reach and engagement.</p>
              </div>
            </div>
            
            <div className="benefit-item">
              <div className="benefit-icon">📊</div>
              <div className="benefit-content">
                <h4>Real-Time Performance Tracking</h4>
                <p>Monitor your posts across all platforms with instant confirmation links and engagement metrics.</p>
              </div>
            </div>
            
            <div className="benefit-item">
              <div className="benefit-icon">🚀</div>
              <div className="benefit-content">
                <h4>Effortless Publishing</h4>
                <p>Focus on creating great content while we handle the technical details of multi-platform publishing.</p>
              </div>
            </div>
          </div>
          
          <div className="benefits-cta">
            <Link to="/register" className="cta-primary">
              Start Creating Today
            </Link>
            <Link to="/login" className="cta-secondary">
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing">
        <PricingSection />
      </section>

      {/* Message from the Founder */}
      <section className="rp-section">
        <h2>Hello Creators,</h2>
        <p><strong>Create once, publish everywhere with intelligent automation.</strong> ReelPostly transforms your content creation workflow by publishing across all six major platforms with AI-generated captions and hashtags tailored for each audience.</p>
        
        <p><strong>One workflow. Six platforms. Zero hassle.</strong> Stop juggling multiple tools and start creating content that works everywhere.</p>
        
        <p style={{ textAlign: 'center', marginTop: '2rem', color: '#667eea', fontWeight: '600' }}>— The ReelPostly Team</p>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-container">
          <h2>Ready to Transform Your Social Media?</h2>
          <p>Start creating and publishing content across all platforms with Reelpostly</p>
          <Link to="/register" className="cta-primary">
                Sign Up
              </Link>
          <p className="cta-note">Start your 3-day free trial and cancel anytime</p>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default LandingPage;
