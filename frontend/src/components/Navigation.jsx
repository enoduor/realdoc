import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import './Navigation.css';

const Navigation = () => {
  const { isSignedIn, user } = useUser();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  // Handle Sora Videos Dashboard login
  const handleSoraLogin = () => {
    window.location.href = '/login?redirect=sora';
  };

  // Handle Sora API login - redirect to API dashboard
  const handleSoraApiLogin = () => {
    if (isSignedIn) {
      window.location.href = '/app/sora-api-dashboard';
    } else {
      window.location.href = '/login?redirect=sora-api-dashboard';
    }
  };

  // Determine which handler to use based on current page
  const handleTryItFree = () => {
    const currentPath = window.location.pathname;
    if (currentPath.includes('/sora-api')) {
      handleSoraApiLogin();
    } else {
      handleSoraLogin();
    }
  };

  // Determine which Sign In redirect to use based on current page
  const getSignInPath = () => {
    const currentPath = window.location.pathname;
    if (currentPath.includes('/sora-api')) {
      return '/login?redirect=sora'; // Sora API page Sign In goes to Sora dashboard
    } else {
      return '/login?redirect=sora'; // Main page Sign In goes to Sora dashboard
    }
  };

  // Get the appropriate button text based on current page
  const getSignInButtonText = () => {
    const currentPath = window.location.pathname;
    if (currentPath.includes('/sora-api')) {
      return 'Login';
    } else {
      return 'Sign In';
    }
  };

  return (
    <nav className="navigation">
      <div className="nav-container">
        <div className="nav-logo">
          <Link to="/" className="logo-link">
            <img src="/logo.png" alt="ReelPostly" className="logo-image" />
          </Link>
        </div>

        {/* Desktop Navigation */}
        <div className="nav-links">
          <Link to="/" className="nav-link">Home</Link>
          <a href="/#sora" className="nav-link">Sora Videos</a>
          <a href="/#features" className="nav-link">Features</a>
          {/* <a href="/#pricing" className="nav-link">Pricing</a> */}
          <Link to="/sora-api" className="nav-link">Sora API</Link>
        </div>

        <div className="nav-actions">
          {isSignedIn ? (
            <>
              <button onClick={handleTryItFree} className="nav-btn nav-btn-primary">Try it for free</button>
            </>
            ) : (
              <>
                <Link to={getSignInPath()} className="nav-btn nav-btn-primary">{getSignInButtonText()}</Link>
              </>
            )}
        </div>

        {/* Mobile Menu Button */}
        <button className="mobile-menu-btn" onClick={toggleMenu}>
          <span className="hamburger"></span>
          <span className="hamburger"></span>
          <span className="hamburger"></span>
        </button>
      </div>

      {/* Mobile Navigation */}
      {isMenuOpen && (
        <div className="mobile-nav">
          <div className="mobile-nav-links">
            <Link to="/" className="mobile-nav-link" onClick={() => setIsMenuOpen(false)}>Home</Link>
            <a href="/#sora" className="mobile-nav-link" onClick={() => setIsMenuOpen(false)}>Sora Videos</a>
            <a href="/#features" className="mobile-nav-link" onClick={() => setIsMenuOpen(false)}>Features</a>
            {/* <a href="/#pricing" className="mobile-nav-link" onClick={() => setIsMenuOpen(false)}>Pricing</a> */}
            <Link to="/about" className="mobile-nav-link" onClick={() => setIsMenuOpen(false)}>About</Link>
            <Link to="/help" className="mobile-nav-link" onClick={() => setIsMenuOpen(false)}>Help</Link>
            <Link to="/sora-api" className="mobile-nav-link" onClick={() => setIsMenuOpen(false)}>Sora API</Link>
          </div>
          <div className="mobile-nav-actions">
            {isSignedIn ? (
              <>
                <button onClick={handleTryItFree} className="mobile-nav-btn mobile-nav-btn-primary">Try it for free</button>
              </>
            ) : (
              <>
                <Link to={getSignInPath()} className="mobile-nav-btn mobile-nav-btn-primary" onClick={() => setIsMenuOpen(false)}>{getSignInButtonText()}</Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navigation;
