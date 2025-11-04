import React from 'react';
import { Link } from 'react-router-dom';
// import { useClerk } from '@clerk/clerk-react';

const AccountDeleted = () => {
  // COMMENTED OUT: Clerk authentication
  // const { signOut } = useClerk();
  const signOut = async () => {};

  const handleSignOut = async () => {
    try {
      // Clear any remaining user data
      localStorage.clear();
      
      // Sign out from Clerk
      const ORIGIN = window.location.origin;
      const PUBLIC_BASE_RAW = process.env.PUBLIC_URL || '/';
      const PUBLIC_BASE = PUBLIC_BASE_RAW.endsWith('/') ? PUBLIC_BASE_RAW : `${PUBLIC_BASE_RAW}/`;
      const redirectUrl = `${ORIGIN}${PUBLIC_BASE}`;
      
      await signOut({
        redirectUrl: redirectUrl,
        callbackUrl: redirectUrl
      });
    } catch (error) {
      console.error('Error during sign out:', error);
      // Force redirect to home page
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="text-center">
            {/* Success Icon */}
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
              <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            
            {/* Title */}
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Account Deleted Successfully
            </h2>
            
            {/* Description */}
            <p className="text-gray-600 mb-6">
              Your account and all associated data have been permanently deleted from our system.
            </p>
            
            {/* What was deleted */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
              <h3 className="text-sm font-medium text-gray-900 mb-2">Data that was removed:</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Your user account and profile information</li>
                <li>• All generated documentation</li>
                <li>• All documentation history</li>
                <li>• Your subscription and billing information</li>
                <li>• All usage history and analytics</li>
              </ul>
              <p className="text-sm text-blue-600 mt-3 font-medium">
                You can come back and reactivate within 30 days, after which we shall delete it permanently.
              </p>
            </div>
            
            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                onClick={handleSignOut}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
              >
                Sign Out & Return to Home
              </button>
              
              <Link
                to="/"
                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                Return to Home Page
              </Link>
            </div>
            
            {/* Footer message */}
            <p className="text-xs text-gray-500 mt-6">
              Thank you for using RealDoc. We're sorry to see you go!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountDeleted;
