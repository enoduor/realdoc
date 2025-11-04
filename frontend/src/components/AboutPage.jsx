import React from 'react';
import { Link } from 'react-router-dom';
import Navigation from './Navigation';
import Footer from './Footer';
import './LandingPage.css';

const AboutPage = () => {
  return (
    <div className="landing-page">
      <Navigation />

      {/* Hero Section */}
      <section className="hero-section modern-hero">
        <div className="hero-container">
          <div className="hero-content">
            <h1 className="hero-title">About RealDoc</h1>
            <p className="hero-subtitle">
              We're making documentation generation simple, fast, and accessible for everyone.
            </p>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="features-section">
        <div className="features-container">
          <div className="legal-content">
            <div className="legal-header">
              <h2 className="legal-title">Our Mission</h2>
              <p className="legal-intro">
                RealDoc was created to solve a common problem: creating comprehensive documentation for applications is time-consuming and often requires specialized technical writing skills. We believe that great documentation should be accessible to everyone, regardless of their technical background.
              </p>
            </div>

            <div className="legal-section">
              <h3 className="legal-section-title">What We Do</h3>
              
              <div className="legal-subsection">
                <h4 className="legal-subsection-title">📚 AI-Powered Documentation Generation</h4>
                <p>We use advanced AI to generate comprehensive documentation for your applications, including user guides, API documentation, developer guides, and more.</p>
              </div>

              <div className="legal-subsection">
                <h4 className="legal-subsection-title">⚡ Save Time and Resources</h4>
                <p>What used to take days or weeks can now be done in minutes. Focus on building your product while we handle the documentation.</p>
              </div>

              <div className="legal-subsection">
                <h4 className="legal-subsection-title">🎯 Customizable Output</h4>
                <p>Choose your technical level, style, tone, target audience, and output format. Generate documentation that matches your needs perfectly.</p>
              </div>

              <div className="legal-subsection">
                <h4 className="legal-subsection-title">🔧 Multiple Documentation Types</h4>
                <p>Generate user guides for end users, API documentation for developers, admin docs for system administrators, and more.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="features-section">
        <div className="features-container">
          <div className="legal-content">
            <div className="legal-header">
              <h2 className="legal-title">Our Values</h2>
            </div>
          
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🎯</div>
              <h3>Simplicity</h3>
              <p>We believe documentation generation should be simple and straightforward. No complex workflows, no confusing interfaces.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3>Speed</h3>
              <p>Generate comprehensive documentation in minutes, not days. Get your documentation ready quickly so you can focus on what matters.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🎨</div>
              <h3>Quality</h3>
              <p>We're committed to generating high-quality, well-structured documentation that follows best practices and industry standards.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔧</div>
              <h3>Flexibility</h3>
              <p>Customize your documentation to match your needs. Choose formats, styles, and technical levels that work for your audience.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🤝</div>
              <h3>Support</h3>
              <p>We're here to help. Our team is committed to providing excellent support and continuously improving our platform.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📈</div>
              <h3>Innovation</h3>
              <p>We're constantly improving our AI models and adding new features to make documentation generation even better.</p>
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
              <h2 className="legal-title">Get in Touch</h2>
              <p className="legal-intro">
                Have questions or feedback? We'd love to hear from you.
              </p>
            </div>
          <a 
            href="https://docs.google.com/forms/d/e/1FAIpQLSdXGiQBAVMQy3lXGkNdRwqgfWw20E_VlXODYloiMo7L3bwYCw/viewform"
            target="_blank"
            rel="noopener noreferrer"
            className="cta-button-large"
          >
            Contact Us
          </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default AboutPage;
