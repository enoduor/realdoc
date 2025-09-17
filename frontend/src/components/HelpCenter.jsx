import React from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';

const HelpCenter = () => {
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
            <h1 className="hero-title">Help Center</h1>
            <p className="hero-subtitle">
              Get support, find answers, and help us improve Reelpostly for you
            </p>
          </div>
        </div>
      </section>

      {/* Help Content */}
      <section className="features-section">
        <div className="features-container">
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">📚</div>
              <h3>Getting Started</h3>
              <p>Learn how to create your first post and connect your social media accounts</p>
              <Link to="/register" className="cta-secondary">Get Started</Link>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔧</div>
              <h3>Platform Setup</h3>
              <p>Step-by-step guides for connecting Instagram, TikTok, LinkedIn, Twitter, Facebook, and YouTube</p>
              <Link to="/register" className="cta-secondary">Connect Platforms</Link>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🤖</div>
              <h3>AI Features</h3>
              <p>Learn how to use our AI-powered caption and hashtag generation tools</p>
              <Link to="/register" className="cta-secondary">Try AI Features</Link>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📱</div>
              <h3>Mobile Support</h3>
              <p>Tips for using Reelpostly on mobile devices and troubleshooting common issues</p>
              <Link to="/register" className="cta-secondary">Mobile Guide</Link>
            </div>
            <div className="feature-card">
              <div className="feature-icon">💳</div>
              <h3>Billing & Subscriptions</h3>
              <p>Manage your subscription, update payment methods, and understand billing cycles</p>
              <Link to="/register" className="cta-secondary">Manage Billing</Link>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔒</div>
              <h3>Account Security</h3>
              <p>Secure your account, manage passwords, and understand our privacy and security measures</p>
              <Link to="/register" className="cta-secondary">Security Guide</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Feedback Section */}
      <section className="cta-section">
        <div className="cta-container">
          <h2>Help Us Improve</h2>
          <p>
            We're constantly working to make Reelpostly better for creators like you. 
            Your feedback helps us understand how you use our tool and what capabilities 
            you need to grow your audience more effectively.
          </p>
          <p>
            <strong>Tell us:</strong> How would you like to use our AI-powered multi-platform content generator? 
            What features would help you create better content and reach more people?
          </p>
          <a 
            href="https://docs.google.com/forms/d/e/1FAIpQLSdXGiQBAVMQy3lXGkNdRwqgfWw20E_VlXODYloiMo7L3bwYCw/viewform"
            target="_blank"
            rel="noopener noreferrer"
            className="cta-button-large"
          >
            Share Your Feedback
          </a>
          <p className="cta-note">Your input helps us build features that matter to you</p>
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

export default HelpCenter;
