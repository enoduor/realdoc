import React from 'react';
import { Link } from 'react-router-dom';
import PricingSection from './PricingSection';
import PlatformIcons from './PlatformIcons';
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
            <h1 className="hero-title">Create Once, Publish Everywhere</h1>
            <p className="hero-subtitle">
            Save hours and skip juggling tools. Repurpose a single video, auto-caption it, and publish across Instagram, TikTok, YouTube, Facebook, LinkedIn, and X in seconds — and yes, you can even download videos for free from our platform and get started instantly.
            </p>
            <div className="hero-cta">
              <Link to="/register" className="cta-primary">
                Sign Up
              </Link>
              <Link to="/login" className="cta-secondary">
                Sign In
              </Link>
            </div>
            <div className="hero-stats">
              <div className="stat">
                <span className="stat-number">1000+</span>
                <span className="stat-label">Get Discount</span>
              </div>
              <div className="stat">
                <span className="stat-number">Referrals</span>
                <span className="stat-label">Get Discount</span>
              </div>
              <div className="stat">
                <span className="stat-number">25</span>
                <span className="stat-label">Languages</span>
              </div>
            </div>
          </div>
          <div className="hero-image">
            <div className="hero-visual">
              <PlatformIcons />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features-section">
        <div className="features-container">
          <h2 className="section-title">Everything You Need to Succeed</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🤖</div>
              <h3>AI-Powered Content</h3>
              <p>Generate engaging captions and hashtags with AI technology</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔄</div>
              <h3>Seamless Repurposing</h3>
              <p>instantly convert and share your post to TikTok, Reels, Shorts, and more.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3> 1-Click Publishing</h3>
              <p>Go live across five socual media accounts directly from one workspace.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔄</div>
              <h3>Multi-Platform Sync</h3>
              <p>Track all your social accounts posts from a single platform</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🎨</div>
              <h3>Customize Posts</h3>
              <p>Create and edit your posts with our built-in Content and Hashtag Editor</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📥</div>
              <h3>Download free videos</h3>
              <p>Download Publicly available videos instantly then repurpose and publish</p>
            </div>
          </div>
          
          {/* VideoGrab Platform Button */}
          <div className="videograb-platform-section">
            <a 
              href="https://bigvideograb.com/" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="cta-button-large videograb-platform-btn"
            >
              Grab Videos from 5 platforms
            </a>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing">
        <PricingSection />
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-container">
          <h2>Ready to Transform Your Social Media?</h2>
          <p>Join thousands of creators who are already growing their audience with Reelpostly</p>
          <Link to="/register" className="cta-button-large">
            Sign Up
          </Link>
          <p className="cta-note">Start your 3-day free trial with a credit card (not charged) and cancel anytime</p>
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
                <li><a href="#features">Features</a></li>
                <li><a href="#pricing">Pricing</a></li>
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
                <li><Link to="/privacy">Privacy Policy</Link></li>
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

export default LandingPage;
