import React from 'react';
import { Link } from 'react-router-dom';
import Navigation from './Navigation';
import PricingSection from './PricingSection';
import './LandingPage.css';

const PricingPage = () => {
  return (
    <div className="pricing-page">
      <Navigation />

      {/* Pricing Section */}
      <PricingSection />

      {/* Footer */}
      <footer className="bg-gray-50 border-t">
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-gray-500">
              &copy; 2024 RealDoc. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PricingPage;
