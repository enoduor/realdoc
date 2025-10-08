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
            <Link to="/register" className="nav-btn nav-btn-primary">Get Started Now</Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-container">
          <div className="hero-content">
            <h1 className="hero-title">Create Once, Publish Everywhere!</h1>
            <p className="hero-subtitle">
            Get videos from your device or social media, generate captions and hashtags, and publish across multiple platforms all in one place.
            </p>
            <div className="hero-benefits">
                <ul className="space-y-3 text-left">
                    <li className="flex items-start">
                        <span className="text-green-500 mr-3 mt-1">✅</span>
                        <span>Save time, reduce costs, manage everything in one place</span>
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
                Get Started Now
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
                Initiate your content creation with AI-powered captions and hashtags.
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
              <p>Initiate your workflow with the content and caption generator and then proceed to customize your message within seconds.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">⚙️</div>
              <h3>Smart Platform Customization</h3>
              <p>Adjust tone, length, and style of your content to match each channel's audience and format requirements in one place.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">✅</div>
              <h3>Instant Confirmation & Tracking</h3>
              <p>Get confirmation with direct links to your live posts across all platforms. We do not add analytics that you don't need.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pain Points Section */}
      <section id="pain-points" className="rp-section">
        <div className="pain-points-container">
          <h2>Are you Experiencing  These Common Problems?</h2>
          <p className="pain-points-subtitle">We built ReelPostly to solve the biggest frustrations in social media publishing</p>
          
          <div className="pain-points-grid">
            <div className="pain-point-card">
              <div className="pain-point-icon">⏰</div>
              <h3>Spending too much time Posting</h3>
              <p>You spend hours uploading the same content to multiple platforms, tweaking formats, and managing different posting schedules. ReelPostly simplifies it with one upload shared everywhere.</p>
              <div className="pain-point-solution">
                <strong>Save valuable time and stay consistent across all your social channels.</strong>
              </div>
            </div>
            
            <div className="pain-point-card">
              <div className="pain-point-icon">💰</div>
              <h3>Paying for multiple tools</h3>
              <p>Most social media tools charge enterprise-level prices for basic posting features that should be affordable for everyone. ReelPostly is built for individuals and small teams.</p>
              <div className="pain-point-solution">
                <strong>Get professional-grade automation without the heavy cost.</strong>
              </div>
            </div>
            
            <div className="pain-point-card">
              <div className="pain-point-icon">🎯</div>
              <h3>Paying for features you don't use</h3>
              <p>Many tools are packed with complex options you'll never use, take time to learn, and make simple posting feel overwhelming. ReelPostly focuses on what matters most.</p>
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
          <h2>With ReelPostly, You Can:</h2>
          <p className="benefits-subtitle">Be part of a community streamlining their workflow</p>
          
          <div className="benefits-list">
            <div className="benefit-item">
              <div className="benefit-icon">⏱️</div>
              <div className="benefit-content">
                <h4>Save Hours Every Week</h4>
                <p>One workflow replaces six separate uploads. Saving you time and money.</p>
              </div>
            </div>
            
            <div className="benefit-item">
              <div className="benefit-icon">🎯</div>
              <div className="benefit-content">
                <h4>Platform-Optimized Content</h4>
                <p>AI generates content that you quickly tweak, and focus on your brand messaging .</p>
              </div>
            </div>
            
            <div className="benefit-item">
              <div className="benefit-icon">📊</div>
              <div className="benefit-content">
                <h4>Real-Time Post Notification</h4>
                <p>Monitor your posts launch across all platforms with instant confirmation links.</p>
              </div>
            </div>
            
            <div className="benefit-item">
              <div className="benefit-icon">🚀</div>
              <div className="benefit-content">
                <h4>Effortless Publishing</h4>
                <p>Focus on creating great content that shares the same message across your platforms.</p>
              </div>
            </div>
          </div>
          
          <div className="benefits-cta">
            <Link to="/register" className="cta-primary">
              Are you ready?
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
        <p><strong>Create once, publish everywhere with intelligent automation.</strong> ReelPostly transforms your content creation workflow by publishing across six major platforms with AI-generated captions and hashtags tailored for each audience.</p>
        
        <p><strong>One workflow. Six platforms. Zero hassle.</strong> Stop juggling multiple tools and start creating content that works everywhere.</p>
        
        <p style={{ textAlign: 'center', marginTop: '2rem', color: '#667eea', fontWeight: '600' }}>— The ReelPostly Team</p>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-container">
          <h2>Ready to Transform Your Social Media?</h2>
          <p>Start creating and publishing content across all platforms with Reelpostly</p>
          <Link to="/register" className="cta-primary">
                Get Started Now
              </Link>
          <p className="cta-note">Start your 3-day free trial and cancel anytime</p>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default LandingPage;
