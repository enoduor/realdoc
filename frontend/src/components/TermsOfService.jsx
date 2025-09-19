import React from 'react';
import { Link } from 'react-router-dom';
import Footer from './Footer';
import './LandingPage.css';

const TermsOfService = () => {
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
            <h1 className="hero-title">Terms of Service</h1>
            <p className="hero-subtitle">
              Last updated: January 2025
            </p>
          </div>
        </div>
      </section>

      {/* Terms Content */}
      <section className="features-section">
        <div className="features-container">
          <h2 className="section-title">Service Terms and Conditions</h2>
          <div className="legal-content">
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing and using Reelpostly ("the Service"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
            </p>

            <h2>2. Description of Service</h2>
            <p>
              Reelpostly is a social media management platform that allows users to create, schedule, and publish content across multiple social media platforms including LinkedIn, Twitter, Instagram, Facebook, TikTok, and YouTube. Our service includes AI-powered caption and hashtag generation, content scheduling, and analytics.
            </p>

            <h2>3. User Accounts</h2>
            <p>
              To access certain features of the Service, you must register for an account. You agree to:
            </p>
            <ul>
              <li>Provide accurate, current, and complete information during registration</li>
              <li>Maintain and update your account information</li>
              <li>Maintain the security of your password and account</li>
              <li>Accept responsibility for all activities under your account</li>
              <li>Notify us immediately of any unauthorized use of your account</li>
            </ul>

            <h2>4. Acceptable Use</h2>
            <p>You agree not to use the Service to:</p>
            <ul>
              <li>Violate any applicable laws or regulations</li>
              <li>Infringe on the rights of others</li>
              <li>Transmit harmful, threatening, or offensive content</li>
              <li>Attempt to gain unauthorized access to the Service</li>
              <li>Interfere with the proper functioning of the Service</li>
              <li>Use the Service for any illegal or unauthorized purpose</li>
            </ul>

            <h2>5. Content and Intellectual Property</h2>
            <h3>5.1 Your Content</h3>
            <p>
              You retain ownership of all content you create, upload, or share through the Service. By using the Service, you grant us a limited license to use, store, and process your content solely for the purpose of providing the Service.
            </p>

            <h3>5.2 Our Content</h3>
            <p>
              The Service and its original content, features, and functionality are owned by Reelpostly and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.
            </p>

            <h2>6. Social Media Platform Integration</h2>
            <p>
              Our Service integrates with third-party social media platforms. By connecting your social media accounts, you:
            </p>
            <ul>
              <li>Grant us permission to access and publish content on your behalf</li>
              <li>Agree to comply with each platform's terms of service</li>
              <li>Understand that we are not responsible for platform-specific policies or changes</li>
              <li>Accept that platform availability may affect our Service</li>
            </ul>

            <h2>7. Payment and Billing</h2>
            <p>
              If you choose a paid subscription plan:
            </p>
            <ul>
              <li>Fees are billed in advance on a recurring basis</li>
              <li>All fees are non-refundable unless otherwise stated</li>
              <li>You can cancel your subscription at any time</li>
              <li>We may change our pricing with 30 days' notice</li>
            </ul>

            <h2>8. Privacy and Data Protection</h2>
            <p>
              Your privacy is important to us. Our collection and use of personal information is governed by our Privacy Policy, which is incorporated into these Terms by reference.
            </p>

            <h2>9. Service Availability</h2>
            <p>
              We strive to maintain high service availability but cannot guarantee uninterrupted access. We may temporarily suspend the Service for maintenance, updates, or technical issues.
            </p>

            <h2>10. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, Reelpostly shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses.
            </p>

            <h2>11. Termination</h2>
            <p>
              We may terminate or suspend your account and access to the Service immediately, without prior notice, for any reason, including breach of these Terms.
            </p>

            <h2>12. Changes to Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. We will notify users of any material changes via email or through the Service. Your continued use of the Service after such changes constitutes acceptance of the new Terms.
            </p>

            <h2>13. Contact Information</h2>
            <p>
              If you have any questions about these Terms of Service, please contact us through our Help Center or feedback form.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default TermsOfService;