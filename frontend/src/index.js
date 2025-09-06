import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';

// --- Helpers for BASE + URL building ----------------------------------------
const ORIGIN =
  (typeof window !== 'undefined' && window.location && window.location.origin)
    ? window.location.origin
    : '';

const PUBLIC_BASE_RAW = process.env.PUBLIC_URL || '/repostly/';

// Normalize PUBLIC_BASE to always have exactly one trailing slash
const PUBLIC_BASE = (() => {
  const t = String(PUBLIC_BASE_RAW || '/');
  return t.endsWith('/') ? t : `${t}/`;
})();

// Join helper (same as in api.js / ContentService.js)
const joinUrl = (a, b = '') =>
  `${String(a).replace(/\/+$/, '')}/${String(b).replace(/^\/+/, '')}`;

// Resolve Clerk publishable key from env or <meta>
function resolveClerkKey() {
  const key = process.env.REACT_APP_CLERK_PUBLISHABLE_KEY;
  if (key && key !== 'undefined') return key;
  const meta = document.querySelector('meta[name="clerk-publishable-key"]');
  return meta?.getAttribute('content') || '';
}

// Clerk config with normalized BASE
const clerkConfig = {
  publishableKey: resolveClerkKey(),
  afterSignInUrl: joinUrl(PUBLIC_BASE, 'app'),
  afterSignUpUrl: joinUrl(PUBLIC_BASE, 'app'),
  afterSignOutUrl: PUBLIC_BASE, // e.g. "/repostly/"
};

// React Router basename (no trailing slash)
const BASENAME = PUBLIC_BASE.replace(/\/+$/, '');

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ClerkProvider {...clerkConfig}>
      <BrowserRouter basename={BASENAME}>
        <App />
      </BrowserRouter>
    </ClerkProvider>
  </React.StrictMode>
);