import React from 'react';
// import { useUser } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';

const ClerkProtectedRoute = ({ children }) => {
  // COMMENTED OUT: Clerk authentication check
  // const { isSignedIn, isLoaded } = useUser();

  // Mock values for development without Clerk
  const isSignedIn = true; // Allow access without authentication
  const isLoaded = true;

  // Show loading while Clerk is initializing
  // COMMENTED OUT: Clerk loading check
  // if (!isLoaded) {
  //   return (
  //     <div className="min-h-screen bg-gray-50 flex items-center justify-center">
  //       <div className="text-center">
  //         <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
  //         <p className="mt-4 text-gray-600">Loading authentication...</p>
  //       </div>
  //     </div>
  //   );
  // }

  // COMMENTED OUT: Redirect if not signed in - allow access for now
  // if (!isSignedIn) {
  //   return <Navigate to="/" replace />;
  // }

  // Render children if authenticated - subscription checks happen in individual components
  return children;
};

export default ClerkProtectedRoute;
