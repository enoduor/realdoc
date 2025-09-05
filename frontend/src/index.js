import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';

// === Clerk Configuration (inlined) ===
// Resolve Clerk publishable key from build-time env or injected meta tag
function resolveClerkKey() {
  const key = process.env.REACT_APP_CLERK_PUBLISHABLE_KEY;
  if (key && key !== 'undefined') return key;
  const meta = document.querySelector('meta[name="clerk-publishable-key"]');
  return meta?.getAttribute('content') || '';
}

const clerkConfig = {
  publishableKey: resolveClerkKey(),
  get basePath() {
    // Production: use /repostly/, Local: use /repostly/ (with trailing slash for basePath)
    const base = '/repostly/';
    return base && base !== '/' ? base : '';
  },
  appearance: {
    baseTheme: 'light',
    variables: {
      colorPrimary: '#3b82f6',
      colorBackground: '#ffffff',
      colorText: '#1f2937',
    },
  },
  get signInUrl() { return `${this.basePath}login`; },
  get signUpUrl() { return `${this.basePath}register`; },
  get afterSignInUrl() { return `${this.basePath}app`; },
  get afterSignUpUrl() { return `${this.basePath}app`; },
  get afterSignOutUrl() { return `${this.basePath}`; }
};

// === Debug logging (remove in production) ===
console.log('Clerk Config:', {
  publishableKey: clerkConfig.publishableKey ? 'Set' : 'Not set',
  hasKey: !!clerkConfig.publishableKey
});

// === Root render ===
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}
const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <ClerkProvider {...clerkConfig}>
      <BrowserRouter basename="/repostly/">
        <App />
      </BrowserRouter>
    </ClerkProvider>
  </React.StrictMode>
);