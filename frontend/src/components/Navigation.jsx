import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Navigation.css';

const Navigation = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  // Navigate to Documentation Generator
  const handleGetStarted = () => {
    navigate('/documentation-generator');
  };

  return (
    <nav className="navigation">
      <div className="nav-container">
        <div className="nav-logo">
          <Link to="/" className="logo-link">
            <img src="/logo.png" alt="RealDoc" className="logo-image" />
          </Link>
        </div>

        {/* Desktop Navigation */}
        <div className="nav-links">
          <Link to="/seo" className="nav-link">SEO Generator</Link>
          <Link to="/analytics" className="nav-link">Website Analyzer</Link>
          <Link to="/documentation" className="nav-link">Document Generator</Link>
          <a href="https://reelpostly.com/app/sora/video-generator" target="_blank" rel="noopener noreferrer" className="nav-link">AI UGC Creator</a>
        </div>

        <div className="nav-actions">
          <button onClick={handleGetStarted} className="nav-btn nav-btn-primary">Generate Docs</button>
        </div>

        {/* Mobile Menu Button */}
        <button className={`mobile-menu-btn ${isMenuOpen ? 'active' : ''}`} onClick={toggleMenu}>
          <span className="hamburger"></span>
          <span className="hamburger"></span>
          <span className="hamburger"></span>
        </button>
      </div>

      {/* Mobile Navigation */}
      {isMenuOpen && (
        <div className="mobile-nav">
          <div className="mobile-nav-links">
            <a href="https://reelpostly.com/app/sora/video-generator" target="_blank" rel="noopener noreferrer" className="mobile-nav-link" onClick={() => setIsMenuOpen(false)}>UGC Creator</a>
            <Link to="/about" className="mobile-nav-link" onClick={() => setIsMenuOpen(false)}>About</Link>
            <Link to="/seo" className="mobile-nav-link" onClick={() => setIsMenuOpen(false)}>SEO Generator</Link>
            <Link to="/analytics" className="mobile-nav-link" onClick={() => setIsMenuOpen(false)}>Website Analyzer</Link>
            <Link to="/documentation" className="mobile-nav-link" onClick={() => setIsMenuOpen(false)}>Document Generator</Link>
          </div>
          <div className="mobile-nav-actions">
            <button onClick={() => { handleGetStarted(); setIsMenuOpen(false); }} className="mobile-nav-btn mobile-nav-btn-primary">Generate Docs</button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navigation;
