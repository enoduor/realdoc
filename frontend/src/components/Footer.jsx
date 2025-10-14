import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Linkedin, 
  Twitter, 
  Instagram, 
  Youtube, 
  Music,
  Facebook
} from 'lucide-react';
import './LandingPage.css'; // Import the CSS that contains footer styles

const Footer = () => {
  return (
    <footer className="landing-footer">
      <div className="footer-container">
        <div className="footer-content">
          <div className="footer-section">
            <h4>Reelpostly</h4>
            <p>Made for solo creators, startups, small businesses.<br/>
            <strong>Create once, publish everywhere.</strong></p>
          </div>
          <div className="footer-section">
            <h4>Product</h4>
            <ul>
              <li><a href="/#features">Features</a></li>
              <li><a href="/#pricing">Pricing</a></li>
            </ul>
          </div>
          <div className="footer-section">
            <h4>Support</h4>
            <ul>
              <li><Link to="/help">Help Center</Link></li>
              <li><Link to="/privacy">Privacy Policy</Link></li>
              <li><Link to="/sora-api#get-api-key">Sora 2 API</Link></li>
            </ul>
          </div>
          <div className="footer-section">
            <h4>Company</h4>
            <ul>
              <li><Link to="/about">About</Link></li>
              <li><Link to="/terms">Terms of Service</Link></li>
              <li><Link to="/partner">Our Values</Link></li>
            </ul>
          </div>
        </div>
        {/* <div className="social-media-section">
          <h4>Follow Us</h4>
          <div className="social-links">
            <a 
              href="https://www.instagram.com/reelpostly1/" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="social-link instagram"
              title="Follow us on Instagram"
            >
              <Instagram size={20} />
            </a>
            <a 
              href="https://www.tiktok.com/@reelpostly1" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="social-link tiktok"
              title="Follow us on TikTok"
            >
              <Music size={20} />
            </a>
            <a 
              href="https://www.facebook.com/Reelpostly/" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="social-link facebook"
              title="Follow us on Facebook"
            >
              <Facebook size={20} />
            </a>
            <a 
              href="https://x.com/repostly101" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="social-link twitter"
              title="Follow us on X (Twitter)"
            >
              <Twitter size={20} />
            </a>
            <a 
              href="https://www.linkedin.com/in/reel-postly-396365382/" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="social-link linkedin"
              title="Connect with us on LinkedIn"
            >
              <Linkedin size={20} />
            </a>
            <a 
              href="https://www.youtube.com/@ReelPostly" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="social-link youtube"
              title="Subscribe to our YouTube channel"
            >
              <Youtube size={20} />
            </a>
          </div>
        </div> */}
        <div className="footer-bottom">
          <p>&copy; 2024 Reelpostly. All rights reserved.</p>
          <div className="footer-links">
            <Link to="/terms">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
