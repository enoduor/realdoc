import React from 'react';
import { Link } from 'react-router-dom';
import Footer from './Footer';
import './LandingPage.css';

const PartnerWithUs = () => {
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
            <a href="/#features" className="nav-link">Features</a>
            <a href="/#pricing" className="nav-link">Pricing</a>
            <Link to="/about" className="nav-link">About</Link>
            <a 
              href="https://bigvideograb.com/" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="nav-link"
            >
              Grab videos
            </a>
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
            <h1 className="hero-title">Partner with Us</h1>
            <p className="hero-subtitle">
              Building a better social media ecosystem together
            </p>
          </div>
        </div>
      </section>

      {/* Social Media Etiquette Section */}
      <section className="features-section">
        <div className="features-container">
          <div className="legal-content">
            <div className="legal-header">
              <h2 className="legal-title">Social Media Growth with Integrity</h2>
              <p className="legal-intro">
                As social media tools become more powerful, it's crucial to use them responsibly. 
                Here's how to grow your audience ethically and sustainably.
              </p>
            </div>
          
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🤝</div>
              <h3>Authentic Engagement</h3>
              <p>Focus on building genuine connections with your audience. Respond to comments, ask questions, and create content that adds real value to people's lives.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📚</div>
              <h3>Educational Content</h3>
              <p>Share knowledge, insights, and experiences that help others. Educational content builds trust and establishes you as an authority in your field.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🎯</div>
              <h3>Quality Over Quantity</h3>
              <p>Better to post less frequently with high-quality content than to flood feeds with mediocre posts. Your audience will appreciate the thoughtfulness.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">💬</div>
              <h3>Respectful Communication</h3>
              <p>Always communicate with respect and empathy. Disagreements are natural, but maintain professionalism and avoid personal attacks.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔄</div>
              <h3>Consistent Brand Voice</h3>
              <p>Maintain a consistent voice and message across all platforms. This helps build recognition and trust with your audience.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3>Transparent Metrics</h3>
              <p>Be honest about your growth and metrics. Authentic growth takes time, and your audience will respect your transparency.</p>
            </div>
          </div>
          </div>
        </div>
      </section>

      {/* Partnership Opportunities */}
      <section className="cta-section">
        <div className="cta-container">
          <div className="legal-content">
            <div className="legal-header">
              <h2 className="legal-title">Partnership Opportunities</h2>
              <p className="legal-intro">
                We're looking for creators, agencies, and businesses who share our vision of 
                ethical social media growth. Join us in building a community that values 
                authenticity and meaningful connections.
              </p>
            </div>
          
          <div className="features-grid" style={{marginTop: '2rem'}}>
            <div className="feature-card">
              <div className="feature-icon">🎨</div>
              <h3>Content Creators</h3>
              <p>Share your expertise and help other creators grow. We're looking for thought leaders who can contribute to our educational content.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🏢</div>
              <h3>Marketing Agencies</h3>
              <p>Partner with us to offer your clients powerful social media management tools while maintaining ethical practices.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔧</div>
              <h3>Technology Partners</h3>
              <p>Help us improve our platform with integrations, features, and innovations that benefit the creator community.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🎓</div>
              <h3>Educational Partners</h3>
              <p>Collaborate with us to create comprehensive learning resources, courses, and workshops for social media creators and marketers.</p>
            </div>
          </div>
          </div>
        </div>
      </section>

      {/* Best Practices Section */}
      <section className="features-section">
        <div className="features-container">
          <div className="legal-content">
            <div className="legal-header">
              <h2 className="legal-title">Best Practices for Social Media Growth</h2>
            </div>
          
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">⏰</div>
              <h3>Optimal Posting Times</h3>
              <p>Research when your audience is most active and post consistently during those times. Use analytics to optimize your posting schedule.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">#️⃣</div>
              <h3>Strategic Hashtag Use</h3>
              <p>Use relevant hashtags that your audience actually searches for. Mix popular and niche hashtags to reach both broad and targeted audiences.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📱</div>
              <h3>Platform-Specific Content</h3>
              <p>Adapt your content for each platform's unique format and audience. What works on Instagram may not work on LinkedIn.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📈</div>
              <h3>Track and Analyze</h3>
              <p>Regularly review your analytics to understand what content resonates with your audience. Use data to inform your content strategy.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🤝</div>
              <h3>Community Building</h3>
              <p>Engage with other creators in your niche. Comment thoughtfully, share others' content, and build genuine relationships.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🎯</div>
              <h3>Clear Value Proposition</h3>
              <p>Make it clear what value you provide to your audience. Whether it's entertainment, education, or inspiration, be consistent in your value delivery.</p>
            </div>
          </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="cta-section">
        <div className="cta-container">
          <div className="legal-content">
            <div className="legal-header">
              <h2 className="legal-title">Ready to Partner with Us?</h2>
              <p className="legal-intro">
                If you're interested in partnering with Reelpostly or have ideas for how we can 
                better serve the creator community, we'd love to hear from you.
              </p>
            </div>
          <a 
            href="https://docs.google.com/forms/d/e/1FAIpQLSdXGiQBAVMQy3lXGkNdRwqgfWw20E_VlXODYloiMo7L3bwYCw/viewform"
            target="_blank"
            rel="noopener noreferrer"
            className="cta-button-large"
          >
            Get in Touch
          </a>
          <p className="cta-note">Let's build the future of social media together</p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default PartnerWithUs;
