import React from 'react';
import './WaitlistModal.css';

const WaitlistModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const handleFormClick = () => {
    window.open('https://docs.google.com/forms/d/e/1FAIpQLSdXGiQBAVMQy3lXGkNdRwqgfWw20E_VlXODYloiMo7L3bwYCw/viewform', '_blank');
  };

  return (
    <div className="waitlist-overlay" onClick={onClose}>
      <div className="waitlist-content" onClick={(e) => e.stopPropagation()}>
        <button className="waitlist-close" onClick={onClose}>×</button>
        
        <div className="waitlist-header">
          <div className="waitlist-badge">
            <span className="badge-pulse">🔥</span>
            <span>Get Early Access</span>
          </div>
          <h2>Join Our Priority Waitlist</h2>
        </div>

        <div className="waitlist-body">
          <p className="waitlist-intro">
            We're experiencing demand for our <strong>AI documentation generation</strong> and are carefully onboarding users to ensure the best experience.
          </p>

          <div className="waitlist-benefits">
            <div className="benefit-item">
              <span className="benefit-icon">⚡</span>
              <div className="benefit-text">
                <strong>AI Documentation Generation</strong>
                <p>Generate comprehensive documentation with AI-powered tools</p>
              </div>
            </div>
            <div className="benefit-item">
              <span className="benefit-icon">🎯</span>
              <div className="benefit-text">
                <strong>Multiple Documentation Types</strong>
                <p>Generate user guides, API docs, developer guides, and more</p>
              </div>
            </div>
            <div className="benefit-item">
              <span className="benefit-icon">🚀</span>
              <div className="benefit-text">
                <strong>Priority Onboarding</strong>
                <p>First-come, first-served access to our complete platform</p>
              </div>
            </div>
          </div>

          <div className="waitlist-promise">
            <p>
              <strong>We onboard users one at a time</strong> to maintain quality and ensure your success. 
              Once we receive your information, you'll hear back <strong>within 12 hours</strong> as long as we have your email.
            </p>
          </div>

          <button className="waitlist-cta" onClick={handleFormClick}>
            Join Waitlist - Fill Out Quick Form
          </button>

          <p className="waitlist-note">
            Takes less than 30 seconds • Get early access to AI documentation generation
          </p>
        </div>
      </div>
    </div>
  );
};

export default WaitlistModal;

