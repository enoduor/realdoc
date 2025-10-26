import React from 'react';
import { Link } from 'react-router-dom';
import Navigation from './Navigation';
import Footer from './Footer';
import './LandingPage.css';

const HelpCenter = () => {
  return (
    <div className="landing-page">
      <Navigation />

      {/* Hero Section */}
      {/* <section className="hero-section">
        <div className="hero-container">
          <div className="hero-content">
            <h1 className="hero-title">Help Center</h1>
            <p className="hero-subtitle">
              Get support, find answers, and help us improve Reelpostly for you
            </p>
          </div>
        </div>
      </section> */}

      {/* Help Content */}
      <section className="features-section">
        <div className="features-container">
          <div className="legal-content">
            <div className="legal-header">
              <h2 className="legal-title">Help Center</h2>
              <p className="legal-intro">
                Get support, find answers, and help us improve Reelpostly Sora Video generator. 
                We're here to help you succeed with your social media management. 
                Also, on this page you can test our other AI powered tools for automatic content creation.
                <br />
                <br />
                <strong>What's missing?</strong> What would make your Sora video workflow 10x easier? 
                What Sora API features would save you the most time and help you create better AI videos?
                <br />
                <br />
                <strong>Tell us:</strong> How would you like to use our AI-powered multi-platform content generator? 
                What features would help you create better content and reach more people?
              </p>
            </div>

            <div className="legal-section">
              <h3 className="legal-section-title">Getting Started</h3>
              <div className="legal-subsection">
                <h4 className="legal-subsection-title">📚 First Steps with caption generation tool</h4>
                <p>Learn how to create your first post and connect your social media accounts</p>
                <Link to="/register" className="legal-link">Get Started →</Link>
              </div>
            </div>

            <div className="legal-section">
              <h3 className="legal-section-title">Platform Setup</h3>
              <div className="legal-subsection">
                <h4 className="legal-subsection-title">🔧 Connect Your Platforms</h4>
                <p>Step-by-step guides for connecting Instagram, TikTok, LinkedIn, Twitter, Facebook, and YouTube</p>
                <Link to="/register" className="legal-link">Connect Platforms →</Link>
              </div>
            </div>

            <div className="legal-section">
              <h3 className="legal-section-title">AI Features</h3>
              <div className="legal-subsection">
                <h4 className="legal-subsection-title">🤖 AI-Powered Tools</h4>
                <p>Learn how to use our AI-powered video downloader and caption generation tools</p>
                <Link to="/register" className="legal-link">Try AI Features →</Link>
              </div>
            </div>

            <div className="legal-section">
              <h3 className="legal-section-title">Mobile Support</h3>
              <div className="legal-subsection">
                <h4 className="legal-subsection-title">📱 Mobile Usage</h4>
                <p>Test Reelpostly content creator on mobile devices and troubleshooting common issues</p>
                <Link to="/register" className="legal-link">Mobile Guide →</Link>
              </div>
            </div>

            <div className="legal-section">
              <h3 className="legal-section-title">Billing & Subscriptions</h3>
              <div className="legal-subsection">
                <h4 className="legal-subsection-title">💳 Payment Management</h4>
                <p>Manage your subscription, update payment methods, and understand billing cycles</p>
                <Link to="/register" className="legal-link">Manage Billing →</Link>
              </div>
            </div>

            <div className="legal-section">
              <h3 className="legal-section-title">Account Security</h3>
              <div className="legal-subsection">
                <h4 className="legal-subsection-title">🔒 Security & Privacy</h4>
                <p>Secure your account, manage passwords, and understand our privacy and security measures</p>
                <Link to="/privacy" className="legal-link">Security Guide →</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feedback Section */}
      <section className="cta-section">
        <div className="cta-container">
          <h2>🚀 Help Us Improve Reelpostly</h2>
          <p>
            We're constantly evolving our Sora video generation and Sora API to solve the real problems creators face. 
            Your input shapes every Sora feature we build and every improvement we make.
          </p>
          <p>
            <strong>What's missing?</strong> What would make your Sora video workflow 10x easier? 
            What Sora API features would save you the most time and help you create better AI videos?
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

      <Footer />
    </div>
  );
};

export default HelpCenter;
