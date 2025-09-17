import React from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';

const AboutPage = () => {
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
            <a href="/#features" className="nav-link">Features</a>
            <a href="/#pricing" className="nav-link">Pricing</a>
            <Link to="/about" className="nav-link">About</Link>
            <a 
              href="https://bigvideograb.com/" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="nav-link"
            >
              Grab videos
            </a>
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
            <h1 className="hero-title">The Problem We're Solving</h1>
            <p className="hero-subtitle">
              Social media creators are drowning in complexity. We're here to simplify.
            </p>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="features-section">
        <div className="features-container">
          <h2 className="section-title">The Multi-Tool Nightmare</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">😵‍💫</div>
              <h3>Tool Overload</h3>
              <p>Creators juggle 5-10 different apps: Canva for design, Hootsuite for scheduling, CapCut for editing, Buffer for analytics, and separate apps for each platform. It's overwhelming and expensive.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⏰</div>
              <h3>Time Drain</h3>
              <p>What should take 5 minutes becomes a 2-hour ordeal. Upload to Instagram, resize for TikTok, reformat for LinkedIn, adjust for Twitter, create thumbnails for YouTube. The same content, endless repetition.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">💰</div>
              <h3>Cost Explosion</h3>
              <p>Monthly subscriptions add up fast: $30 for design tools, $50 for scheduling, $25 for analytics, $40 for video editing. That's $145/month just to post content across platforms.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🤯</div>
              <h3>Mental Overload</h3>
              <p>Remembering different posting times, platform-specific formats, hashtag strategies, and engagement patterns. Your brain becomes a social media operations center instead of a creative hub.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📱</div>
              <h3>Platform Confusion</h3>
              <p>Each platform has different rules, formats, and best practices. What works on Instagram fails on LinkedIn. TikTok trends don't translate to YouTube. You're constantly learning new systems.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3>Analytics Chaos</h3>
              <p>Data scattered across multiple dashboards. Instagram insights here, TikTok analytics there, YouTube Studio somewhere else. No unified view of your content performance.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="cta-section">
        <div className="cta-container">
          <h2>Our Solution: One Tool, All Platforms</h2>
          <p>
            Reelpostly eliminates the multi-tool nightmare. Create once, publish everywhere. 
            Our AI handles the complexity while you focus on what matters: creating amazing content.
          </p>
          <div className="features-grid" style={{marginTop: '2rem'}}>
            <div className="feature-card">
              <div className="feature-icon">🎯</div>
              <h3>One Workspace</h3>
              <p>All your social media management in one place. No more switching between apps.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🤖</div>
              <h3>AI-Powered</h3>
              <p>Smart captions and hashtags that adapt to each platform automatically.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3>Instant Publishing</h3>
              <p>One click publishes to all connected platforms simultaneously.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3>Unified Analytics</h3>
              <p>Track performance across all platforms from one comprehensive dashboard.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Feedback Section */}
      <section className="features-section">
        <div className="features-container">
          <h2 className="section-title">Help Us Build Your Perfect Tool</h2>
          <p style={{textAlign: 'center', marginBottom: '2rem', fontSize: '1.1rem'}}>
            We're constantly evolving based on creator feedback. Tell us how you'd like us to modify 
            the app to help you better reach your audience and grow your brand.
          </p>
          <div style={{textAlign: 'center'}}>
            <a 
              href="https://docs.google.com/forms/d/e/1FAIpQLSdXGiQBAVMQy3lXGkNdRwqgfWw20E_VlXODYloiMo7L3bwYCw/viewform"
              target="_blank"
              rel="noopener noreferrer"
              className="cta-button-large"
            >
              Share Your Ideas
            </a>
            <p className="cta-note">Your input shapes our roadmap</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-container">
          <div className="footer-content">
            <div className="footer-section">
              <h4>Reelpostly</h4>
              <p>Made for solo creators, startups, small businesses.<br/>
              <strong>Create once, publish everywhere.</strong></p>
            </div>
            <div className="footer-section">
              <h4>Product</h4>
              <ul>
                <li><a href="/#features">Features</a></li>
                <li><a href="/#pricing">Pricing</a></li>
                <li><a 
                  href="https://bigvideograb.com/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  Grab videos
                </a></li>
              </ul>
            </div>
            <div className="footer-section">
              <h4>Support</h4>
              <ul>
                <li><Link to="/help">Help Center</Link></li>
                <li><a 
                  href="https://bigvideograb.com/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  Grab videos
                </a></li>
                <li><Link to="/apis">Our APIs</Link></li>
              </ul>
            </div>
            <div className="footer-section">
              <h4>Company</h4>
              <ul>
                <li><Link to="/about">About</Link></li>
                <li><Link to="/terms">Terms of Service</Link></li>
                <li><Link to="/partner">Partner with us</Link></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2024 Reelpostly. All rights reserved.</p>
            <div className="footer-links">
              <Link to="/terms">Terms of Service & Privacy Policy</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AboutPage;
