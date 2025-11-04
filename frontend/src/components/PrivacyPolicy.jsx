import React from 'react';
import { Link } from 'react-router-dom';
import Navigation from './Navigation';
import Footer from './Footer';
import './LandingPage.css';

const PrivacyPolicy = () => {
  return (
    <div className="landing-page">
      <Navigation />

      {/* Hero Section */}
      {/* <section className="hero-section">
        <div className="hero-container">
          <div className="hero-content">
            <h1 className="hero-title">Privacy Policy</h1>
            <p className="hero-subtitle">
              How we collect, use, and protect your information
            </p>
          </div>
        </div>
      </section> */}

      {/* Privacy Policy Content */}
      <section className="features-section">
        <div className="features-container">
          <div className="legal-content">
            <div className="legal-header">
              <h2 className="legal-title">Privacy Policy</h2>
              <p className="legal-intro">
                <strong>Last Updated:</strong> {new Date().toLocaleDateString()}
              </p>
              <p className="legal-intro">
                RealDoc ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our documentation generation platform and related services.
              </p>
            </div>

            <div className="legal-section">
              <h3 className="legal-section-title">1. Information We Collect</h3>
              
              <div className="legal-subsection">
                <h4 className="legal-subsection-title">1.1 Personal Information</h4>
                <p>We may collect personal information that you provide directly to us, including:</p>
                <ul className="legal-list">
                  <li>Name and contact information (email address, phone number)</li>
                  <li>Account credentials and authentication information</li>
                  <li>Payment and billing information</li>
                  <li>Profile information and preferences</li>
                  <li>Content you create, upload, or share through our platform</li>
                </ul>
              </div>

              <div className="legal-subsection">
                <h4 className="legal-subsection-title">1.2 Documentation Content</h4>
                <p>To provide our services, we may collect:</p>
                <ul className="legal-list">
                  <li>Documentation content you create and generate</li>
                  <li>Application information you provide for documentation generation</li>
                  <li>Preferences and settings for documentation generation</li>
                </ul>
              </div>

              <div className="legal-subsection">
                <h4 className="legal-subsection-title">1.3 Technical Information</h4>
                <p>We automatically collect certain technical information, including:</p>
                <ul className="legal-list">
                  <li>Device information (IP address, browser type, operating system)</li>
                  <li>Usage data (pages visited, features used, time spent)</li>
                  <li>Cookies and similar tracking technologies</li>
                  <li>Log files and error reports</li>
                </ul>
              </div>
            </div>

            <div className="legal-section">
              <h3 className="legal-section-title">2. How We Use Your Information</h3>
              <p>We use the information we collect to:</p>
              <ul className="legal-list">
                <li>Provide, maintain, and improve our services</li>
                <li>Process transactions and send related information</li>
                <li>Send technical notices, updates, and support messages</li>
                <li>Respond to your comments, questions, and requests</li>
                <li>Monitor and analyze trends, usage, and activities</li>
                <li>Personalize and improve user experience</li>
                <li>Detect, prevent, and address technical issues and security threats</li>
              </ul>
            </div>

            <div className="legal-section">
              <h3 className="legal-section-title">3. Information Sharing and Disclosure</h3>
              
              <div className="legal-subsection">
                <h4 className="legal-subsection-title">3.1 Third-Party Services</h4>
                <p>We may share your information with third-party service providers who assist us in operating our platform, including:</p>
                <ul className="legal-list">
                  <li>AI service providers (for documentation generation)</li>
                  <li>Payment processors</li>
                  <li>Cloud storage providers</li>
                  <li>Analytics services</li>
                  <li>Customer support tools</li>
                </ul>
              </div>

              <div className="legal-subsection">
                <h4 className="legal-subsection-title">3.2 Legal Requirements</h4>
                <p>We may disclose your information if required to do so by law or in response to valid requests by public authorities.</p>
              </div>

              <div className="legal-subsection">
                <h4 className="legal-subsection-title">3.3 Business Transfers</h4>
                <p>In the event of a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction.</p>
              </div>
            </div>

            <div className="legal-section">
              <h3 className="legal-section-title">4. Data Security</h3>
              <p>We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the internet or electronic storage is 100% secure.</p>
            </div>

            <div className="legal-section">
              <h3 className="legal-section-title">5. Data Retention</h3>
              <p>We retain your personal information for as long as necessary to provide our services and fulfill the purposes outlined in this Privacy Policy, unless a longer retention period is required or permitted by law.</p>
            </div>

            <div className="legal-section">
              <h3 className="legal-section-title">6. Your Rights and Choices</h3>
              <p>Depending on your location, you may have certain rights regarding your personal information, including:</p>
              <ul className="legal-list">
                <li>Access to your personal information</li>
                <li>Correction of inaccurate information</li>
                <li>Deletion of your personal information</li>
                <li>Restriction of processing</li>
                <li>Data portability</li>
                <li>Objection to processing</li>
              </ul>
            </div>

            <div className="legal-section">
              <h3 className="legal-section-title">7. Cookies and Tracking Technologies</h3>
              <p>We use cookies and similar technologies to enhance your experience, analyze usage, and provide personalized content. You can control cookie settings through your browser preferences.</p>
            </div>

            <div className="legal-section">
              <h3 className="legal-section-title">8. International Data Transfers</h3>
              <p>Your information may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place for such transfers.</p>
            </div>

            <div className="legal-section">
              <h3 className="legal-section-title">9. Children's Privacy</h3>
              <p>Our services are not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13.</p>
            </div>

            <div className="legal-section">
              <h3 className="legal-section-title">10. Changes to This Privacy Policy</h3>
              <p>We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date.</p>
            </div>

            <div className="legal-section">
              <h3 className="legal-section-title">11. Contact Us</h3>
              <p>If you have any questions about this Privacy Policy, please contact us through our feedback form:</p>
              <div style={{textAlign: 'center', marginTop: '1rem'}}>
                <a 
                  href="https://docs.google.com/forms/d/e/1FAIpQLSdXGiQBAVMQy3lXGkNdRwqgfWw20E_VlXODYloiMo7L3bwYCw/viewform"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cta-button-large"
                >
                  Contact Us
                </a>
                <p className="cta-note">We'll respond to your privacy questions within 24 hours</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
