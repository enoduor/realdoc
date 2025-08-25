import React from 'react';
import { Link } from 'react-router-dom';
import PricingSection from './PricingSection';
import './LandingPage.css';

const LandingPage = () => {
  return (
    <div className="landing-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-container">
          <div className="hero-content">
            <h1 className="hero-title">
              Supercharge Your Social Media Presence
            </h1>
            <p className="hero-subtitle">
              Create, schedule, and publish content across all your social media platforms with AI-powered tools. 
              Save time and grow your audience faster than ever before.
            </p>
            <div className="hero-cta">
              <Link to="/register" className="cta-primary">
                Start Free Trial
              </Link>
              <Link to="/login" className="cta-secondary">
                Sign In
              </Link>
            </div>
            <div className="hero-stats">
              <div className="stat">
                <span className="stat-number">10K+</span>
                <span className="stat-label">Active Creators</span>
              </div>
              <div className="stat">
                <span className="stat-number">1M+</span>
                <span className="stat-label">Posts Published</span>
              </div>
              <div className="stat">
                <span className="stat-number">50+</span>
                <span className="stat-label">Countries</span>
              </div>
            </div>
          </div>
          <div className="hero-image">
            <div className="hero-visual">
              <div className="platform-icons">
                <div className="platform-icon linkedin">💼</div>
                <div className="platform-icon twitter">🐦</div>
                <div className="platform-icon instagram">📸</div>
                <div className="platform-icon youtube">▶️</div>
                <div className="platform-icon tiktok">🎵</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="features-container">
          <h2 className="section-title">Everything You Need to Succeed</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🤖</div>
              <h3>AI-Powered Content</h3>
              <p>Generate engaging captions and hashtags with our advanced AI technology</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📅</div>
              <h3>Smart Scheduling</h3>
              <p>Schedule posts across multiple platforms with optimal timing</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3>Analytics & Insights</h3>
              <p>Track performance and optimize your content strategy</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔄</div>
              <h3>Multi-Platform Sync</h3>
              <p>Manage all your social accounts from one dashboard</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🎨</div>
              <h3>Content Studio</h3>
              <p>Create and edit visual content with our built-in tools</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🚀</div>
              <h3>Growth Consulting</h3>
              <p>Get expert advice to scale your social media presence</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <PricingSection />

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-container">
          <h2>Ready to Transform Your Social Media?</h2>
          <p>Join thousands of creators who are already growing their audience with CreatorSync</p>
          <Link to="/register" className="cta-button-large">
            Start Your Free Trial Today
          </Link>
          <p className="cta-note">No credit card required • Cancel anytime</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-container">
          <div className="footer-content">
            <div className="footer-section">
              <h4>CreatorSync</h4>
              <p>Empowering creators to build meaningful connections through social media.</p>
            </div>
            <div className="footer-section">
              <h4>Product</h4>
              <ul>
                <li><Link to="/features">Features</Link></li>
                <li><Link to="/pricing">Pricing</Link></li>
                <li><Link to="/integrations">Integrations</Link></li>
              </ul>
            </div>
            <div className="footer-section">
              <h4>Support</h4>
              <ul>
                <li><Link to="/help">Help Center</Link></li>
                <li><Link to="/contact">Contact Us</Link></li>
                <li><Link to="/status">Status</Link></li>
              </ul>
            </div>
            <div className="footer-section">
              <h4>Company</h4>
              <ul>
                <li><Link to="/about">About</Link></li>
                <li><Link to="/blog">Blog</Link></li>
                <li><Link to="/careers">Careers</Link></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2024 CreatorSync. All rights reserved.</p>
            <div className="footer-links">
              <Link to="/privacy">Privacy Policy</Link>
              <Link to="/terms">Terms of Service</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
