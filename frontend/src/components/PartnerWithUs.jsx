import React from 'react';
import { Link } from 'react-router-dom';
import Navigation from './Navigation';
import Footer from './Footer';
import './LandingPage.css';

const PartnerWithUs = () => {
  return (
    <div className="landing-page">
      <Navigation />

      {/* Hero Section */}
      <section className="hero-section modern-hero">
        <div className="hero-container">
          <div className="hero-content">
            <h1 className="hero-title">Partner with Us</h1>
            <p className="hero-subtitle">
              Building a better documentation ecosystem together
            </p>
          </div>
        </div>
      </section>

      {/* Partnership Opportunities */}
      <section className="features-section">
        <div className="features-container">
          <div className="legal-content">
            <div className="legal-header">
              <h2 className="legal-title">Partnership Opportunities</h2>
              <p className="legal-intro">
                We're looking for developers, agencies, and businesses who share our vision of 
                making documentation generation accessible and efficient. Join us in building a community that values 
                quality documentation and developer productivity.
              </p>
            </div>
          
          <div className="features-grid" style={{marginTop: '2rem'}}>
            <div className="feature-card">
              <div className="feature-icon">🎨</div>
              <h3>Content Partners</h3>
              <p>Share your expertise and help other developers create better documentation. We're looking for thought leaders who can contribute to our educational content.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🏢</div>
              <h3>Technology Agencies</h3>
              <p>Partner with us to offer your clients powerful documentation generation tools while maintaining best practices.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔧</div>
              <h3>Technology Partners</h3>
              <p>Help us improve our platform with integrations, features, and innovations that benefit the developer community.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🎓</div>
              <h3>Educational Partners</h3>
              <p>Collaborate with us to create comprehensive learning resources, courses, and workshops for developers and technical writers.</p>
            </div>
          </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="cta-section">
        <div className="cta-container">
          <div className="legal-content">
            <div className="legal-header">
              <h2 className="legal-title">Ready to Partner with Us?</h2>
              <p className="legal-intro">
                If you're interested in partnering with RealDoc or have ideas for how we can 
                better serve the developer community, we'd love to hear from you.
              </p>
            </div>
          <a 
            href="https://docs.google.com/forms/d/e/1FAIpQLSdXGiQBAVMQy3lXGkNdRwqgfWw20E_VlXODYloiMo7L3bwYCw/viewform"
            target="_blank"
            rel="noopener noreferrer"
            className="cta-button-large"
          >
            Get in Touch
          </a>
          <p className="cta-note">Let's build the future of documentation together</p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default PartnerWithUs;
