import React from 'react';
import { Link } from 'react-router-dom';
import Navigation from './Navigation';
import Footer from './Footer';
import './LandingPage.css';

const TermsOfService = () => {
  return (
    <div className="landing-page">
      <Navigation />

      {/* Hero Section */}
      {/* <section className="hero-section">
        <div className="hero-container">
          <div className="hero-content">
            <h1 className="hero-title">Terms of Service</h1>
            <p className="hero-subtitle">
              Last updated: January 2025
            </p>
          </div>
        </div>
      </section> */}

      {/* Terms Content */}
      <section className="features-section">
        <div className="features-container">
          <div className="legal-content">
            <div className="legal-header">
              <h2 className="legal-title">Terms of Service</h2>
              <p className="legal-intro">
                <strong>Last Updated:</strong> {new Date().toLocaleDateString()}
              </p>
              <p className="legal-intro">
                By accessing and using RealDoc ("the Service"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
              </p>
            </div>

            <div className="legal-section">
              <h3 className="legal-section-title">1. Description of Service</h3>
              <p>
                RealDoc is an AI-powered documentation generation platform that allows users to create comprehensive documentation for their online applications. Our service includes AI-powered documentation generation for user guides, API documentation, developer guides, and more.
              </p>
            </div>

            <div className="legal-section">
              <h3 className="legal-section-title">2. User Accounts</h3>
              <p>To access certain features of the Service, you must register for an account. You agree to:</p>
              <ul className="legal-list">
                <li>Provide accurate, current, and complete information during registration</li>
                <li>Maintain and update your account information</li>
                <li>Maintain the security of your password and account</li>
                <li>Accept responsibility for all activities under your account</li>
                <li>Notify us immediately of any unauthorized use of your account</li>
              </ul>
            </div>

            <div className="legal-section">
              <h3 className="legal-section-title">3. Acceptable Use</h3>
              <p>You agree not to use the Service to:</p>
              <ul className="legal-list">
                <li>Violate any applicable laws or regulations</li>
                <li>Infringe on the rights of others</li>
                <li>Transmit harmful, threatening, or offensive content</li>
                <li>Attempt to gain unauthorized access to the Service</li>
                <li>Interfere with the proper functioning of the Service</li>
                <li>Use the Service for any illegal or unauthorized purpose</li>
              </ul>
            </div>

            <div className="legal-section">
              <h3 className="legal-section-title">4. Content and Intellectual Property</h3>
              
              <div className="legal-subsection">
                <h4 className="legal-subsection-title">4.1 Your Content</h4>
                <p>
                  You retain ownership of all content you create, upload, or share through the Service. By using the Service, you grant us a limited license to use, store, and process your content solely for the purpose of providing the Service.
                </p>
              </div>

              <div className="legal-subsection">
                <h4 className="legal-subsection-title">4.2 Our Content</h4>
                <p>
                  The Service and its original content, features, and functionality are owned by RealDoc and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.
                </p>
              </div>
            </div>

            <div className="legal-section">
              <h3 className="legal-section-title">5. AI Service Integration</h3>
              <p>Our Service integrates with third-party AI services for documentation generation. By using our service, you:</p>
              <ul className="legal-list">
                <li>Grant us permission to process your application information for documentation generation</li>
                <li>Agree to comply with AI service providers' terms of service</li>
                <li>Understand that we are not responsible for AI service provider policies or changes</li>
                <li>Accept that AI service availability may affect our Service</li>
              </ul>
            </div>

            <div className="legal-section">
              <h3 className="legal-section-title">6. Payment and Billing</h3>
              <p>If you choose a paid subscription plan:</p>
              <ul className="legal-list">
                <li>Fees are billed in advance on a recurring basis</li>
                <li>All fees are non-refundable unless otherwise stated</li>
                <li>You can cancel your subscription at any time</li>
                <li>We may change our pricing with 30 days' notice</li>
              </ul>
            </div>

            <div className="legal-section">
              <h3 className="legal-section-title">7. Privacy Policy</h3>
              <p>
                Your privacy is important to us. Our collection and use of personal information is governed by our <a href="/privacy" className="legal-link">Privacy Policy</a>, which is incorporated into these Terms by reference.
              </p>
            </div>

            <div className="legal-section">
              <h3 className="legal-section-title">8. Service Availability</h3>
              <p>
                We strive to maintain high service availability but cannot guarantee uninterrupted access. We may temporarily suspend the Service for maintenance, updates, or technical issues.
              </p>
            </div>

            <div className="legal-section">
              <h3 className="legal-section-title">9. Limitation of Liability</h3>
              <p>
                To the maximum extent permitted by law, RealDoc shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses.
              </p>
            </div>

            <div className="legal-section">
              <h3 className="legal-section-title">10. Termination</h3>
              <p>
                We may terminate or suspend your account and access to the Service immediately, without prior notice, for any reason, including breach of these Terms.
              </p>
            </div>

            <div className="legal-section">
              <h3 className="legal-section-title">11. Changes to Terms</h3>
              <p>
                We reserve the right to modify these Terms at any time. We will notify users of any material changes via email or through the Service. Your continued use of the Service after such changes constitutes acceptance of the new Terms.
              </p>
            </div>

            <div className="legal-section">
              <h3 className="legal-section-title">12. Contact Information</h3>
              <p>If you have any questions about these Terms of Service, please contact us through our feedback form:</p>
              <div style={{textAlign: 'center', marginTop: '1rem'}}>
                <a 
                  href="https://docs.google.com/forms/d/e/1FAIpQLSdXGiQBAVMQy3lXGkNdRwqgfWw20E_VlXODYloiMo7L3bwYCw/viewform"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cta-button-large"
                >
                  Contact Us
                </a>
                <p className="cta-note">We'll respond to your questions within 24 hours</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default TermsOfService;