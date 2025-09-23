import React from 'react';
import { Link } from 'react-router-dom';
import Footer from './Footer';
import './LandingPage.css';

const APIsPage = () => {
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
            <h1 className="hero-title">Our APIs</h1>
            <p className="hero-subtitle">
              Access Reelpostly's powerful APIs for seamless integration
            </p>
          </div>
        </div>
      </section>

      {/* API Content */}
      <section className="features-section">
        <div className="features-container">
          <div className="legal-content">
            <div className="legal-header">
              <h2 className="legal-title">Available APIs</h2>
              <p className="legal-intro">
                Access Reelpostly's powerful APIs for seamless integration with your applications and workflows.
              </p>
            </div>

            <div className="legal-section">
              <h3 className="legal-section-title">Core APIs</h3>
              
              <div className="legal-subsection">
                <h4 className="legal-subsection-title">🚀 Main API</h4>
                <p>Core publishing and content management endpoints</p>
                <div className="legal-code-block">
                  <code>POST /api/publish</code>
                  <code>GET /api/status</code>
                </div>
              </div>

              <div className="legal-subsection">
                <h4 className="legal-subsection-title">🤖 AI API</h4>
                <p>Caption and hashtag generation services</p>
                <div className="legal-code-block">
                  <code>POST /ai/generate-caption</code>
                  <code>POST /ai/generate-hashtags</code>
                </div>
              </div>

              <div className="legal-subsection">
                <h4 className="legal-subsection-title">🔐 Authentication</h4>
                <p>OAuth and user management endpoints</p>
                <div className="legal-code-block">
                  <code>GET /api/auth/{'{platform}'}/connect</code>
                  <code>POST /api/auth/callback</code>
                </div>
              </div>
            </div>

            <div className="legal-section">
              <h3 className="legal-section-title">Platform Integration</h3>
              
              <div className="legal-subsection">
                <h4 className="legal-subsection-title">📱 Platform APIs</h4>
                <p>Social media platform integrations</p>
                <div className="legal-code-block">
                  <code>LinkedIn, Twitter, TikTok</code>
                  <code>Instagram, Facebook, YouTube</code>
                </div>
              </div>

              <div className="legal-subsection">
                <h4 className="legal-subsection-title">📊 Analytics API</h4>
                <p>Content performance and insights</p>
                <div className="legal-code-block">
                  <code>GET /api/analytics/posts</code>
                  <code>GET /api/analytics/engagement</code>
                </div>
              </div>

              <div className="legal-subsection">
                <h4 className="legal-subsection-title">📁 Media API</h4>
                <p>File upload and media management</p>
                <div className="legal-code-block">
                  <code>POST /api/media/upload</code>
                  <code>GET /api/media/{'{id}'}</code>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* API Access Guide */}
      <section className="features-section">
        <div className="features-container">
          <div className="legal-content">
            <div className="legal-header">
              <h2 className="legal-title">How to Access Our APIs</h2>
              <p className="legal-intro">
                Get started with our APIs in just a few simple steps. 
                We provide comprehensive documentation and support for all developers.
              </p>
            </div>

            <div className="legal-section">
              <h3 className="legal-section-title">Authentication</h3>
              <p>All API requests require authentication using Clerk JWT tokens:</p>
              <div className="legal-code-block">
                <code>Authorization: Bearer YOUR_CLERK_JWT_TOKEN</code>
              </div>
            </div>

            <div className="legal-section">
              <h3 className="legal-section-title">Base URLs</h3>
              <p>Use these base URLs for API access:</p>
              <ul className="legal-list">
                <li><strong>Main API:</strong> <code>https://api.reelpostly.com</code></li>
                <li><strong>AI Services:</strong> <code>https://ai.reelpostly.com</code></li>
                <li><strong>Media Storage:</strong> <code>https://media.reelpostly.com</code></li>
              </ul>
            </div>

            <div className="legal-section">
              <h3 className="legal-section-title">Rate Limits</h3>
              <p>API requests are limited to:</p>
              <ul className="legal-list">
                <li>100 requests per minute for authenticated users</li>
                <li>10 requests per minute for unauthenticated requests</li>
                <li>Burst capacity up to 200 requests per minute</li>
              </ul>
            </div>

            <div className="legal-section">
              <h3 className="legal-section-title">Getting Started</h3>
              <p>To start using our APIs:</p>
              <ol className="legal-list">
                <li>Create a Reelpostly account</li>
                <li>Connect your social media platforms</li>
                <li>Generate your API token from the dashboard</li>
                <li>Start making requests to our endpoints</li>
              </ol>
            </div>

            <div className="legal-section">
              <h3 className="legal-section-title">Ready to Start?</h3>
              <p>Get API access and start building with our powerful endpoints:</p>
              <div style={{textAlign: 'center', marginTop: '2rem'}}>
                <Link to="/register" className="cta-button-large">
                  Get API Access
                </Link>
                <p className="cta-note">Start building with our APIs today</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default APIsPage;
