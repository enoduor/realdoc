import React from 'react';
import { Link } from 'react-router-dom';
import PricingSection from './PricingSection';
import './LandingPage.css';

const PricingPage = () => {
  return (
    <div className="pricing-page">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Link to="/app" className="text-xl font-bold text-gray-900">
                  Repostly
                </Link>
              </div>
            </div>
            <div className="flex items-center">
              <Link 
                to="/app" 
                className="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Pricing Section */}
      <PricingSection />

      {/* Footer */}
      <footer className="bg-gray-50 border-t">
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-gray-500">
              &copy; 2024 Repostly. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PricingPage;
