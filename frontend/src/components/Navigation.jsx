import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useUser, useClerk } from '@clerk/clerk-react';
import './Navigation.css';

const Navigation = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoaded, isSignedIn } = useUser();
  const { openSignIn, signOut } = useClerk();

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  // Primary nav action:
  // - If signed out → open Clerk sign in / sign up
  // - If signed in and on dashboard → sign out
  // - If signed in and on other pages → go to dashboard
  const handlePrimaryAction = () => {
    if (!isLoaded) return;

    // Only used when signed out: opens Clerk sign-in / sign-up
    if (!isSignedIn) {
      openSignIn({
        redirectUrl: `${window.location.origin}/dashboard`,
      });
    } else if (location.pathname === '/dashboard') {
      // On dashboard page: sign out
      signOut(() => {
        navigate('/');
      });
    } else {
      // On other pages: navigate to dashboard
      navigate('/dashboard');
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
          <Link to="/seo" className="nav-link">SEO Generator</Link>
          <Link to="/analytics" className="nav-link">Website Analyzer</Link>
          <Link to="/documentation" className="nav-link">Document Generator</Link>
          <a href="https://reelpostly.com/app/sora/video-generator" target="_blank" rel="noopener noreferrer" className="nav-link">AI UGC Creator</a>
        </div>

        <div className="nav-actions">
          {!isLoaded ? null : (
            <>
              {!isSignedIn ? (
                <button
                  onClick={handlePrimaryAction}
                  className="nav-btn nav-btn-primary"
                >
                  Sign in / Sign up
                </button>
              ) : (
                <button
                  onClick={handlePrimaryAction}
                  className="nav-btn nav-btn-primary"
                >
                  {location.pathname === '/dashboard' ? 'Sign out' : 'Dashboard'}
                </button>
              )}
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
            <a href="https://reelpostly.com/app/sora/video-generator" target="_blank" rel="noopener noreferrer" className="mobile-nav-link" onClick={() => setIsMenuOpen(false)}>UGC Creator</a>
            <Link to="/about" className="mobile-nav-link" onClick={() => setIsMenuOpen(false)}>About</Link>
            <Link to="/seo" className="mobile-nav-link" onClick={() => setIsMenuOpen(false)}>SEO Generator</Link>
            <Link to="/analytics" className="mobile-nav-link" onClick={() => setIsMenuOpen(false)}>Website Analyzer</Link>
            <Link to="/documentation" className="mobile-nav-link" onClick={() => setIsMenuOpen(false)}>Document Generator</Link>
          </div>
          <div className="mobile-nav-actions">
            {!isLoaded ? null : (
              <>
                {!isSignedIn ? (
                  <button
                    onClick={() => { handlePrimaryAction(); setIsMenuOpen(false); }}
                    className="mobile-nav-btn mobile-nav-btn-primary"
                  >
                    Sign in / Sign up
                  </button>
                ) : (
                  <button
                    onClick={() => { handlePrimaryAction(); setIsMenuOpen(false); }}
                    className="mobile-nav-btn mobile-nav-btn-primary"
                  >
                    {location.pathname === '/dashboard' ? 'Sign out' : 'Dashboard'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navigation;
