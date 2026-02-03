import React from 'react';
import { SignIn } from '@clerk/clerk-react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';

const ClerkLogin = () => {
  const { isSignedIn, isLoaded } = useUser();
  const [searchParams] = useSearchParams();
  
  // Check for redirect parameter from URL only
  const redirectTo = searchParams.get('redirect');
  
  let afterSignInPath = '/documentation-generator'; // Default to Documentation Generator
  
  if (redirectTo === 'documentation-generator') {
    afterSignInPath = '/documentation-generator';
  } else if (redirectTo === 'dashboard') {
    afterSignInPath = '/';
  }


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

  // Redirect to app if already authenticated
  if (isSignedIn) {
    return <Navigate to={afterSignInPath} replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-gray-900">
            Welcome to RealDoc
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to your account to continue
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <SignIn 
            redirectUrl={afterSignInPath}
            afterSignInUrl={afterSignInPath}
            appearance={{
              elements: {
                formButtonPrimary: 'bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md w-full',
                card: 'bg-transparent shadow-none',
                headerTitle: 'text-2xl font-bold text-gray-900',
                headerSubtitle: 'text-gray-600',
                socialButtonsBlockButton: 'bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium py-2 px-4 rounded-md w-full mb-2',
                dividerLine: 'bg-gray-300',
                dividerText: 'text-gray-500',
                formFieldInput: 'block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500',
                formFieldLabel: 'block text-sm font-medium text-gray-700 mb-1',
                footerActionLink: 'text-blue-600 hover:text-blue-500',
              }
            }}
          />
          
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <Link 
                to={redirectTo ? `/register?redirect=${redirectTo}` : "/register"} 
                className="font-medium text-blue-600 hover:text-blue-500"
              >
                Get Started Now
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClerkLogin;