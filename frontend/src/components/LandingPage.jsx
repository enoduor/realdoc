import React from 'react';
import { Link } from 'react-router-dom';
import PricingSection from './PricingSection';
import PlatformIcons from './PlatformIcons';
import Footer from './Footer';
import './LandingPage.css';

const LandingPage = () => {
  return (
    <div className="landing-page">
      {/* Navigation Bar */}
      <nav className="landing-nav">
        <div className="nav-container">
          <div className="nav-logo">
            <Link to="/" className="logo-link">
              <img src="/logo.png" alt="Reelpostly" className="logo-image" />
              <span className="logo-text">ReelPostly</span>
            </Link>
          </div>
          <div className="nav-links">
            <a href="#features" className="nav-link">Features</a>
            <a href="#pricing" className="nav-link">Pricing</a>
            <Link to="/about" className="nav-link">About</Link>
            {/* <a 
              href="https://bigvideograb.com/" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="nav-link"
            >
              Grab videos
            </a> */}
          </div>
          <div className="nav-actions">
            <Link to="/login" className="nav-btn nav-btn-secondary">Sign In</Link>
            <Link to="/register" className="nav-btn nav-btn-primary">Sign Up</Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-container">
          <div className="hero-content">
            <h1 className="hero-title">Create Once, Publish Everywhere!</h1>
            <p className="hero-subtitle">
            Creators are overwhelmed by too many tools and endless complexity. That's why we want you to join us in building an all-in-one platform so you can create, edit, and publish without ever leaving the app. We make it simple, so you can focus on creating, not juggling.  </p>
            <div className="hero-benefits">
                <ul className="space-y-3 text-left">
                    <li className="flex items-start">
                        <span className="text-green-500 mr-3 mt-1">✅</span>
                        <span>Save time, reduce costs, manage everything from one dashboard</span>
                    </li>
                    <li className="flex items-start">
                        <span className="text-green-500 mr-3 mt-1">✅</span>
                        <span>Create once and publish to all major platforms instantly</span>
                    </li>
                    <li className="flex items-start">
                        <span className="text-green-500 mr-3 mt-1">✅</span>
                        <span>Customize posts per platform with simple toggle and one-click publish</span>
                    </li>
                    <li className="flex items-start">
                        <span className="text-green-500 mr-3 mt-1">✅</span>
                        <span>Get direct, hyperlinked confirmations after each post publishes</span>
                    </li>
                    <li className="flex items-start">
                        <span className="text-green-500 mr-3 mt-1">✅</span>
                        <span>Craft engaging captions and hashtags effortlessly with AI tools</span>
                    </li>
                </ul>
            </div>
            <div id="hero-cta" className="hero-cta">
              <Link to="/register" className="cta-primary">
                Sign Up
              </Link>
              <Link to="/login" className="cta-secondary">
                Sign In
              </Link>
            </div>
            {/* <div className="hero-stats">
              <div className="stat">
                <span className="stat-number">Lifetime</span>
                <a 
                  href="https://docs.google.com/forms/d/e/1FAIpQLSdXGiQBAVMQy3lXGkNdRwqgfWw20E_VlXODYloiMo7L3bwYCw/viewform"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="stat-label text-white font-bold"
                >
                 Fill this form
                </a>
              </div>
            
              <div className="stat">
                <span className="stat-number">Launch Day </span>
                <a 
                  href="https://docs.google.com/forms/d/e/1FAIpQLSdXGiQBAVMQy3lXGkNdRwqgfWw20E_VlXODYloiMo7L3bwYCw/viewform"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="stat-label text-white font-bold"
                >
                 Get 30% Discount
                </a>
              </div>
            </div> */}
          </div>
          <div className="hero-image">
            <div className="hero-visual">
              <PlatformIcons />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features-section">
        <div className="features-container">
          
          <section id="multi-platform-posting" className="rp-section">
            <h2>One Post. Six Platforms. Zero Stress.</h2>
            <p>With ReelPostly, you don't need to repeat the same upload six times. Publish your content to Instagram, TikTok, YouTube, Facebook, LinkedIn, and Twitter, all in one go. One dashboard, one post, one publish.</p>
            <ul>
              <li>✅ Save hours every week</li>
              <li>✅ Stay consistent across all channels</li>
              <li>✅ Focus on creating, not copy-pasting</li>
            </ul>
          </section>

          <section id="ai-workflow" className="rp-section">
            <h2>Smarter Publishing with AI</h2>

            <h3 id="ai-captions">Generate Captions & Hashtags Instantly</h3>
            <p>Let our <strong>AI captions and hashtags generator</strong> do the heavy lifting. With one click, ReelPostly creates tailored copy for each platform so your post feels natural whether it's on TikTok or LinkedIn.</p>

            <h3 id="toggle-customize">Toggle & Customize Per Platform</h3>
            <p>Need to tweak tone or length? Use our simple toggle editor to adjust content per channel, then publish everything at once.</p>
          </section>

          <section id="confirmation-links" className="rp-section">
            <h2>Instant Post Confirmation</h2>
            <p>No second guessing. After you publish, ReelPostly gives you a direct, hyperlinked preview of your live post on every platform so you know your message went out exactly as planned.</p>
          </section>

          <section id="simplicity" className="rp-section">
            <h2>Simplicity Without the Noise</h2>
            <p>Unlike other <strong>social media posting tools</strong>, ReelPostly doesn't drown you in dashboards and charts. We don't track your posts after publishing, we help you focus on creating and keeping your message consistent across every platform.</p>
            <ul>
              <li>✅ No confusing analytics clutter</li>
              <li>✅ One-click publishing workflow</li>
              <li>✅ Grow faster with less effort</li>
            </ul>
          </section>

          {/* <section id="videograb-funnel" className="rp-section">
            <h2>Free Video Downloader</h2>
            <p>In case you don't have any content to repurpose, you can start with <strong>free publicly available videos</strong> right away. Once you have your video,  repurpose your TikToks, Twitter Shorts, or Facebook Reels, then with a single click, send them straight to ReelPostly for multi-platform publishing.</p>
            <p>It's the fastest way to go from download → caption → share everywhere.</p>
            
            <div className="videograb-platform-section">
              <a 
                href="https://bigvideograb.com/" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="cta-button-large videograb-platform-btn"
              >
                Grab Free Videos
              </a>
            </div>
          </section> */}

          <section id="why-reelpostly" className="rp-section">
            <h2>Why Choose ReelPostly?</h2>
            <ul>
              <li>🚀 <strong>Time Saved</strong>: One workflow replaces six uploads.</li>
              <li>✨ <strong>AI-Powered</strong>: Smart captions & hashtags per platform.</li>
              <li>🔗 <strong>Direct Proof</strong>: See your post live with confirmation links.</li>
              <li>🧘 <strong>Simplicity</strong>: No extra noise, just effortless publishing.</li>
              <li>🎥 <strong>Free Funnel</strong>: <a href="https://bigvideograb.com/" target="_blank" rel="noopener noreferrer">Download</a> → <a href="https://reelpostly.com/login">Repurpose</a> → Publish everywhere.</li>
            </ul>
            <Link to="/register" className="cta-button-large">Sign Up</Link>
          </section>

        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing">
        <PricingSection />
      </section>

      {/* Message from the Founder */}
      <section className="rp-section">
        <h2>Hello Creators,</h2>
        <p>At ReelPostly, we understand how challenging it can be to keep track of multiple social media accounts while trying to deliver a consistent message. What began as a personal need to simplify video posting across platforms has now grown into a solution built for creators like you.</p>
        
        <p>ReelPostly was designed to make multi-platform publishing seamless. Instead of juggling separate tools and accounts, our platform allows you to publish consistent content across six major platforms—all in one place.</p>
        
        <p>Unlike most posting tools, ReelPostly is built around automation. It generates captions and hashtags for you, adapts them for each platform, and ensures that your message stays uniform, consistent, and on-brand everywhere.</p>
        
        <p>If you'd like to explore before committing, you can start by grabbing publicly available videos through our platform and take advantage of our three-day free trial.</p>
        
        <h3>Why ReelPostly?</h3>
        <ul>
          <li><strong>Save time:</strong> Eliminate the hours spent manually posting and managing multiple accounts.</li>
          <li><strong>Reduce costs:</strong> Say goodbye to stacking third-party tools that quickly add up to hundreds of dollars a month.</li>
          <li><strong>Focus on creating:</strong> Let ReelPostly handle distribution so you can concentrate on what you do best.</li>
        </ul>
        
        <p>We're excited to welcome you to our growing community of creators. To celebrate our launch, 10 of the first 100 subscribers across all six platforms will receive a one-month coupon at no cost.</p>
        
        <p>Follow us on our social channels, share your feedback, and join us in shaping the future of effortless, automated content publishing.</p>
        
        <p style={{ textAlign: 'center', marginTop: '2rem', color: '#667eea', fontWeight: '600' }}>— The ReelPostly Team</p>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-container">
          <h2>Ready to Transform Your Social Media?</h2>
          <p>Start creating and publishing content across all platforms with Reelpostly</p>
          <Link to="/register" className="cta-primary">
                Sign Up
              </Link>
          <p className="cta-note">Start your 3-day free trial and cancel anytime</p>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default LandingPage;
