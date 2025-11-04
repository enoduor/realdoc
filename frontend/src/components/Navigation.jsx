import React, { useState } from 'react';
import { Link } from 'react-router-dom';
// import { useUser } from '@clerk/clerk-react';
import './Navigation.css';

const Navigation = () => {
  // COMMENTED OUT: Clerk authentication
  // const { isSignedIn, user } = useUser();
  const isSignedIn = false; // Allow access without authentication
  const user = null;
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  // Navigate to Documentation Generator
  const handleGetStarted = () => {
    if (isSignedIn) {
      window.location.href = '/app/documentation-generator';
    } else {
      window.location.href = '/login';
    }
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
          <a href="/#features" className="nav-link">Features</a>
          <a href="/#pricing" className="nav-link">Pricing</a>
          <Link to="/help" className="nav-link">Help</Link>
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
            <a href="/#features" className="mobile-nav-link" onClick={() => setIsMenuOpen(false)}>Features</a>
            <a href="/#pricing" className="mobile-nav-link" onClick={() => setIsMenuOpen(false)}>Pricing</a>
            <Link to="/about" className="mobile-nav-link" onClick={() => setIsMenuOpen(false)}>About</Link>
            <Link to="/help" className="mobile-nav-link" onClick={() => setIsMenuOpen(false)}>Help</Link>
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
