import React from 'react';
import { useUser } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';
import LandingPage from '../LandingPage';

const RootRedirect = () => {
  const { isSignedIn, isLoaded } = useUser();

  // Show loading while Clerk is initializing
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect based on authentication status
  if (isSignedIn) {
    return <Navigate to="/app" replace />;
  } else {
    // Show landing page for unauthenticated users instead of redirecting to login
    return <LandingPage />;
  }
};

export default RootRedirect;
