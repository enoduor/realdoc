import React from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';

const PrivacyPolicy = () => {
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
            <a href="https://bigvideograb.com/" className="nav-link" target="_blank" rel="noopener noreferrer">
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
            <h1 className="hero-title">Privacy Policy</h1>
            <p className="hero-subtitle">
              How we collect, use, and protect your information
            </p>
          </div>
        </div>
      </section>

      {/* Privacy Policy Content */}
      <section className="features-section">
        <div className="features-container">
          <h2 className="section-title">Privacy and Data Protection</h2>
          <div className="legal-content">
            <h2>1. Introduction</h2>
            <p>Reelpostly ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our social media management platform and related services.</p>

            <h2>2. Information We Collect</h2>
            <h3>2.1 Personal Information</h3>
            <p>We may collect personal information that you provide directly to us, including:</p>
            <ul>
              <li>Name and contact information (email address, phone number)</li>
              <li>Account credentials and authentication information</li>
              <li>Payment and billing information</li>
              <li>Profile information and preferences</li>
              <li>Content you create, upload, or share through our platform</li>
            </ul>

            <h3>2.2 Social Media Account Information</h3>
            <p>To provide our services, we may collect:</p>
            <ul>
              <li>Social media account credentials (with your explicit consent)</li>
              <li>Posts, images, videos, and other content from your connected accounts</li>
              <li>Analytics and engagement data from your social media platforms</li>
              <li>Follower and audience information</li>
            </ul>

            <h3>2.3 Technical Information</h3>
            <p>We automatically collect certain technical information, including:</p>
            <ul>
              <li>Device information (IP address, browser type, operating system)</li>
              <li>Usage data (pages visited, features used, time spent)</li>
              <li>Cookies and similar tracking technologies</li>
              <li>Log files and error reports</li>
            </ul>

            <h2>3. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul>
              <li>Provide, maintain, and improve our services</li>
              <li>Process transactions and send related information</li>
              <li>Send technical notices, updates, and support messages</li>
              <li>Respond to your comments, questions, and requests</li>
              <li>Monitor and analyze trends, usage, and activities</li>
              <li>Personalize and improve user experience</li>
              <li>Detect, prevent, and address technical issues and security threats</li>
            </ul>

            <h2>4. Information Sharing and Disclosure</h2>
            <h3>4.1 Third-Party Services</h3>
            <p>We may share your information with third-party service providers who assist us in operating our platform, including:</p>
            <ul>
              <li>Social media platforms (for publishing and analytics)</li>
              <li>Payment processors</li>
              <li>Cloud storage providers</li>
              <li>Analytics services</li>
              <li>Customer support tools</li>
            </ul>

            <h3>4.2 Legal Requirements</h3>
            <p>We may disclose your information if required to do so by law or in response to valid requests by public authorities.</p>

            <h3>4.3 Business Transfers</h3>
            <p>In the event of a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction.</p>

            <h2>5. Data Security</h2>
            <p>We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the internet or electronic storage is 100% secure.</p>

            <h2>6. Data Retention</h2>
            <p>We retain your personal information for as long as necessary to provide our services and fulfill the purposes outlined in this Privacy Policy, unless a longer retention period is required or permitted by law.</p>

            <h2>7. Your Rights and Choices</h2>
            <p>Depending on your location, you may have certain rights regarding your personal information, including:</p>
            <ul>
              <li>Access to your personal information</li>
              <li>Correction of inaccurate information</li>
              <li>Deletion of your personal information</li>
              <li>Restriction of processing</li>
              <li>Data portability</li>
              <li>Objection to processing</li>
            </ul>

            <h2>8. Cookies and Tracking Technologies</h2>
            <p>We use cookies and similar technologies to enhance your experience, analyze usage, and provide personalized content. You can control cookie settings through your browser preferences.</p>

            <h2>9. International Data Transfers</h2>
            <p>Your information may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place for such transfers.</p>

            <h2>10. Children's Privacy</h2>
            <p>Our services are not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13.</p>

            <h2>11. Changes to This Privacy Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date.</p>

            <h2>12. Contact Us</h2>
            <p>If you have any questions about this Privacy Policy, please contact us at:</p>
            <ul>
              <li>Email: privacy@reelpostly.com</li>
              <li>Website: <a href="https://reelpostly.com/help">https://reelpostly.com/help</a></li>
            </ul>

            <p><strong>Last Updated:</strong> {new Date().toLocaleDateString()}</p>
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
              <Link to="/privacy">Privacy Policy</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PrivacyPolicy;
