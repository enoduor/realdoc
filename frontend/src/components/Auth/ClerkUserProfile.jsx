import React from 'react';
import { UserButton, useUser, useClerk } from '@clerk/clerk-react';

const ClerkUserProfile = () => {
  const { user } = useUser();
  const { signOut } = useClerk();

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
      
      // Simple redirect logic - Sora dashboards logout goes to API landing page
      const currentPath = window.location.pathname;
      let redirectPath = '/sora-api'; // Default to Sora API landing page
      
      if (currentPath.includes('/sora-api-dashboard')) {
        redirectPath = '/sora-api'; // API dashboard logout → API landing page
      } else if (currentPath.includes('/sora')) {
        redirectPath = '/sora-api'; // Sora dashboard logout → API landing page
      }
      
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
      <div className="text-sm text-gray-700">
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
      />
    </div>
  );
};

export default ClerkUserProfile;
