import React from 'react';
import { Link } from 'react-router-dom';
import Footer from './Footer';
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
            <Link to="/register" className="nav-btn nav-btn-primary">Get Started Now</Link>
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
          <div className="legal-content">
            <div className="legal-header">
              <h2 className="legal-title">The Multi-Tool Nightmare</h2>
              <p className="legal-intro">
                Social media creators face an overwhelming challenge: managing content across multiple platforms with different tools, formats, and requirements.
              </p>
            </div>

            <div className="legal-section">
              <h3 className="legal-section-title">The Problems Creators Face</h3>
              
              <div className="legal-subsection">
                <h4 className="legal-subsection-title">😵‍💫 Tool Overload</h4>
                <p>Creators juggle 5-10 different apps: Canva for design, Hootsuite for scheduling, CapCut for editing, Buffer for analytics, and separate apps for each platform. It's overwhelming and expensive.</p>
              </div>

              <div className="legal-subsection">
                <h4 className="legal-subsection-title">⏰ Time Drain</h4>
                <p>What should take 5 minutes becomes a 2-hour ordeal. Upload to Instagram, resize for TikTok, reformat for LinkedIn, adjust for Twitter, create thumbnails for YouTube. The same content, endless repetition.</p>
              </div>

              <div className="legal-subsection">
                <h4 className="legal-subsection-title">💰 Cost Explosion</h4>
                <p>Monthly subscriptions add up fast: $30 for design tools, $50 for scheduling, $25 for analytics, $40 for video editing. That's $145/month just to post content across platforms.</p>
              </div>

              <div className="legal-subsection">
                <h4 className="legal-subsection-title">🤯 Mental Overload</h4>
                <p>Remembering different posting times, platform-specific formats, hashtag strategies, and engagement patterns. Your brain becomes a social media operations center instead of a creative hub.</p>
              </div>

              <div className="legal-subsection">
                <h4 className="legal-subsection-title">📱 Platform Confusion</h4>
                <p>Each platform has different rules, formats, and best practices. What works on Instagram fails on LinkedIn. TikTok trends don't translate to YouTube. You're constantly learning new systems.</p>
              </div>

              <div className="legal-subsection">
                <h4 className="legal-subsection-title">📊 Analytics Chaos</h4>
                <p>Data scattered across multiple dashboards. Instagram insights here, TikTok analytics there, YouTube Studio somewhere else. No unified view of your content performance.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="features-section">
        <div className="features-container">
          <div className="legal-content">
            <div className="legal-header">
              <h2 className="legal-title">Our Solution: One Tool, All Platforms</h2>
              <p className="legal-intro">
                Reelpostly eliminates the multi-tool nightmare. Create once, publish everywhere. 
                Our AI handles the complexity while you focus on what matters: creating amazing content.
              </p>
            </div>

            <div className="legal-section">
              <h3 className="legal-section-title">How We Solve the Problem</h3>
              
              <div className="legal-subsection">
                <h4 className="legal-subsection-title">🎯 One Workspace</h4>
                <p>All your social media management in one place. No more switching between apps.</p>
              </div>

              <div className="legal-subsection">
                <h4 className="legal-subsection-title">🤖 AI-Powered</h4>
                <p>Smart captions and hashtags that adapt to each platform automatically.</p>
              </div>

              <div className="legal-subsection">
                <h4 className="legal-subsection-title">⚡ Instant Publishing</h4>
                <p>One click publishes to all connected platforms simultaneously.</p>
              </div>

              <div className="legal-subsection">
                <h4 className="legal-subsection-title">📊 Unified Analytics</h4>
                <p>Track performance across all platforms from one comprehensive dashboard.</p>
              </div>
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

      <Footer />
    </div>
  );
};

export default AboutPage;
