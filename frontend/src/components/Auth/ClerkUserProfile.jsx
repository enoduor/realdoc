import React from 'react';
// import { UserButton, useUser, useClerk } from '@clerk/clerk-react';

const ClerkUserProfile = () => {
  // COMMENTED OUT: Clerk authentication
  // const { user } = useUser();
  // const { signOut } = useClerk();
  const user = null;
  const signOut = async () => {};

  // Handle sign out and clear user-specific data
  const handleSignOut = async () => {
    try {
      // Clear user-specific subscription data from localStorage
      if (user?.primaryEmailAddress?.emailAddress) {
        const userEmail = user.primaryEmailAddress.emailAddress;
        const hasSubscriptionKey = `hasSubscription_${userEmail}`;
        const sessionIdKey = `subscriptionSessionId_${userEmail}`;
        
        localStorage.removeItem(hasSubscriptionKey);
        localStorage.removeItem(sessionIdKey);
        
      }
      
      // Check current path to determine redirect destination
      const currentPath = window.location.pathname;
      const redirectPath = '/';
      
      const ORIGIN = window.location.origin;
      const PUBLIC_BASE_RAW = process.env.PUBLIC_URL || '/';
      const PUBLIC_BASE = PUBLIC_BASE_RAW.endsWith('/') ? PUBLIC_BASE_RAW : `${PUBLIC_BASE_RAW}/`;
      const redirectUrl = `${ORIGIN}${PUBLIC_BASE}${redirectPath}`;
      
      // Sign out with a callback that forces our redirect
      await signOut({
        redirectUrl: redirectUrl,
        callbackUrl: redirectUrl
      });
    } catch (error) {
      console.error('Error during sign out:', error);
    }
  };

  return (
    <div className="flex items-center space-x-4">
      {/* COMMENTED OUT: Clerk UserButton */}
      {/* <div className="text-sm text-gray-700">
        <span className="font-medium">Welcome, </span>
        <span>{user?.firstName || user?.emailAddresses[0]?.emailAddress}</span>
      </div>
      <UserButton 
        appearance={{
          elements: {
            userButtonAvatarBox: 'w-8 h-8',
            userButtonTrigger: 'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
          }
        }}
        signOutCallback={handleSignOut}
      /> */}
      <div className="text-sm text-gray-700">
        <span className="font-medium">Guest User</span>
      </div>
    </div>
  );
};

export default ClerkUserProfile;
