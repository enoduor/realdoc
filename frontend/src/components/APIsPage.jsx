import React from 'react';
import { Link } from 'react-router-dom';
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
            <Link to="/register" className="nav-btn nav-btn-primary">Sign Up</Link>
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
          <h2 className="section-title">Available APIs</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🚀</div>
              <h3>Main API</h3>
              <p>Core publishing and content management endpoints</p>
              <div style={{marginTop: '1rem'}}>
                <code style={{background: '#f5f5f5', padding: '0.5rem', borderRadius: '4px', display: 'block'}}>
                  POST /api/publish
                </code>
                <code style={{background: '#f5f5f5', padding: '0.5rem', borderRadius: '4px', display: 'block', marginTop: '0.5rem'}}>
                  GET /api/status
                </code>
              </div>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🤖</div>
              <h3>AI API</h3>
              <p>Caption and hashtag generation services</p>
              <div style={{marginTop: '1rem'}}>
                <code style={{background: '#f5f5f5', padding: '0.5rem', borderRadius: '4px', display: 'block'}}>
                  POST /ai/generate-caption
                </code>
                <code style={{background: '#f5f5f5', padding: '0.5rem', borderRadius: '4px', display: 'block', marginTop: '0.5rem'}}>
                  POST /ai/generate-hashtags
                </code>
              </div>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔐</div>
              <h3>Authentication</h3>
              <p>OAuth and user management endpoints</p>
              <div style={{marginTop: '1rem'}}>
                <code style={{background: '#f5f5f5', padding: '0.5rem', borderRadius: '4px', display: 'block'}}>
                  GET /api/auth/&#123;platform&#125;/connect
                </code>
                <code style={{background: '#f5f5f5', padding: '0.5rem', borderRadius: '4px', display: 'block', marginTop: '0.5rem'}}>
                  POST /api/auth/callback
                </code>
              </div>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📱</div>
              <h3>Platform APIs</h3>
              <p>Social media platform integrations</p>
              <div style={{marginTop: '1rem'}}>
                <code style={{background: '#f5f5f5', padding: '0.5rem', borderRadius: '4px', display: 'block'}}>
                  LinkedIn, Twitter, TikTok
                </code>
                <code style={{background: '#f5f5f5', padding: '0.5rem', borderRadius: '4px', display: 'block', marginTop: '0.5rem'}}>
                  Instagram, Facebook, YouTube
                </code>
              </div>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3>Analytics API</h3>
              <p>Content performance and insights</p>
              <div style={{marginTop: '1rem'}}>
                <code style={{background: '#f5f5f5', padding: '0.5rem', borderRadius: '4px', display: 'block'}}>
                  GET /api/analytics/posts
                </code>
                <code style={{background: '#f5f5f5', padding: '0.5rem', borderRadius: '4px', display: 'block', marginTop: '0.5rem'}}>
                  GET /api/analytics/engagement
                </code>
              </div>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📁</div>
              <h3>Media API</h3>
              <p>File upload and media management</p>
              <div style={{marginTop: '1rem'}}>
                <code style={{background: '#f5f5f5', padding: '0.5rem', borderRadius: '4px', display: 'block'}}>
                  POST /api/media/upload
                </code>
                <code style={{background: '#f5f5f5', padding: '0.5rem', borderRadius: '4px', display: 'block', marginTop: '0.5rem'}}>
                  GET /api/media/&#123;id&#125;
                </code>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* API Access Guide */}
      <section className="cta-section">
        <div className="cta-container">
          <h2>How to Access Our APIs</h2>
          <div style={{textAlign: 'left', maxWidth: '800px', margin: '0 auto'}}>
            <h3>1. Authentication</h3>
            <p>All API requests require authentication using Clerk JWT tokens:</p>
            <code style={{background: '#f5f5f5', padding: '1rem', borderRadius: '4px', display: 'block', margin: '1rem 0'}}>
              Authorization: Bearer YOUR_CLERK_JWT_TOKEN
            </code>

            <h3>2. Base URLs</h3>
            <p>Use these base URLs for API access:</p>
            <ul style={{textAlign: 'left', margin: '1rem 0'}}>
              <li><strong>Main API:</strong> <code>https://api.reelpostly.com</code></li>
              <li><strong>AI Services:</strong> <code>https://ai.reelpostly.com</code></li>
              <li><strong>Media Storage:</strong> <code>https://media.reelpostly.com</code></li>
            </ul>

            <h3>3. Rate Limits</h3>
            <p>API requests are limited to:</p>
            <ul style={{textAlign: 'left', margin: '1rem 0'}}>
              <li>100 requests per minute for authenticated users</li>
              <li>10 requests per minute for unauthenticated requests</li>
              <li>Burst capacity up to 200 requests per minute</li>
            </ul>

            <h3>4. Getting Started</h3>
            <p>To start using our APIs:</p>
            <ol style={{textAlign: 'left', margin: '1rem 0'}}>
              <li>Create a Reelpostly account</li>
              <li>Connect your social media platforms</li>
              <li>Generate your API token from the dashboard</li>
              <li>Start making requests to our endpoints</li>
            </ol>
          </div>
          
          <div style={{marginTop: '2rem'}}>
            <Link to="/register" className="cta-button-large">
              Get API Access
            </Link>
            <p className="cta-note">Start building with our APIs today</p>
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

export default APIsPage;
