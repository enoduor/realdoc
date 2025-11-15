import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
// import { useUser } from '@clerk/clerk-react';
import './Navigation.css';

const Navigation = () => {
  // COMMENTED OUT: Clerk authentication
  // const { isSignedIn, user } = useUser();
  const isSignedIn = false; // Allow access without authentication
  const user = null;
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  // Navigate to Documentation Generator
  const handleGetStarted = () => {
    if (isSignedIn) {
      navigate('/app/documentation-generator');
    } else {
      navigate('/login');
    }
  };

  return (
    <nav className="navigation">
      <div className="nav-container">
        <div className="nav-logo">
          <Link to="/" className="logo-link">
            <span className="logo-text">RealDoc</span>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <div className="nav-links">
          <Link to="/seo" className="nav-link">SEO Generator</Link>
          <Link to="/analytics" className="nav-link">Website Analyzer</Link>
          <Link to="/documentation" className="nav-link">Document Generator</Link>
          <a href="/#pricing" className="nav-link">Pricing</a>
        </div>

        <div className="nav-actions">
          {isSignedIn ? (
            <>
              <button onClick={handleGetStarted} className="nav-btn nav-btn-primary">Generate Docs</button>
            </>
            ) : (
              <>
                <Link to="/login" className="nav-btn nav-btn-primary">Sign In</Link>
              </>
            )}
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
            <a href="/#pricing" className="mobile-nav-link" onClick={() => setIsMenuOpen(false)}>Pricing</a>
            <Link to="/about" className="mobile-nav-link" onClick={() => setIsMenuOpen(false)}>About</Link>
            <Link to="/seo" className="mobile-nav-link" onClick={() => setIsMenuOpen(false)}>SEO Generator</Link>
            <Link to="/analytics" className="mobile-nav-link" onClick={() => setIsMenuOpen(false)}>Website Analyzer</Link>
            <Link to="/documentation" className="mobile-nav-link" onClick={() => setIsMenuOpen(false)}>Document Generator</Link>
          </div>
          <div className="mobile-nav-actions">
            {isSignedIn ? (
              <>
                <button onClick={() => { handleGetStarted(); setIsMenuOpen(false); }} className="mobile-nav-btn mobile-nav-btn-primary">Generate Docs</button>
              </>
            ) : (
              <>
                <Link to="/login" className="mobile-nav-btn mobile-nav-btn-primary" onClick={() => setIsMenuOpen(false)}>Sign In</Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navigation;
