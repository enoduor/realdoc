import React from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css'; // Import the CSS that contains footer styles

const Footer = () => {
  return (
    <footer className="landing-footer">
      <div className="footer-container">
        <div className="footer-content">
          <div className="footer-section">
            <img src="/logo.png" alt="RealDoc" className="footer-logo" />
            <p>AI-powered documentation generator for creating comprehensive documentation for your online applications.</p>
          </div>
          <div className="footer-section">
            <h4>Product</h4>
            <ul>
              <li><Link to="/#features">Features</Link></li>
              <li><Link to="/#pricing">Pricing</Link></li>
            </ul>
          </div>
          <div className="footer-section">
            <h4>Support</h4>
            <ul>
              <li><Link to="/help">Help Center</Link></li>
            </ul>
          </div>
          <div className="footer-section">
            <h4>Company</h4>
            <ul>
              <li><Link to="/terms">Terms of Service</Link></li>
              <li><Link to="/privacy">Privacy Policy</Link></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2024 RealDoc. All rights reserved.</p>
          <div className="footer-links">
            <Link to="/terms">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
