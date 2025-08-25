// Clerk Configuration
// Replace these with your actual Clerk keys from https://dashboard.clerk.com/
export const clerkConfig = {
  publishableKey: process.env.REACT_APP_CLERK_PUBLISHABLE_KEY,
  // Optional: Customize appearance
  appearance: {
    baseTheme: 'light',
    variables: {
      colorPrimary: '#3b82f6',
      colorBackground: '#ffffff',
      colorText: '#1f2937',
    },
  },
  // Optional: Configure sign-in options
  signIn: {
    redirectUrl: '/app',
  },
  // Optional: Configure sign-up options
  signUp: {
    redirectUrl: '/app',
  },
};

// Debug: Log the configuration (remove in production)
console.log('Clerk Config:', {
  publishableKey: clerkConfig.publishableKey ? 'Set' : 'Not set',
  hasKey: !!clerkConfig.publishableKey
});
