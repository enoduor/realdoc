import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ClerkProvider } from "@clerk/clerk-react";
import "./index.css";
import App from "./App";

// Turn off console logs in production (errors still visible)
if (process.env.NODE_ENV === 'production') {
  console.log = () => {};
  console.debug = () => {};
  console.info = () => {};
  console.warn = () => {};
  // Keep console.error for critical issues
}

/** ---------- Root-domain routing (no subpath) ---------- */
const BASENAME = "/";                    // BrowserRouter basename (no trailing slash)
const clerkPubKey = process.env.REACT_APP_CLERK_PUBLISHABLE_KEY;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={clerkPubKey}>
      <BrowserRouter basename={BASENAME}>
        <App />
      </BrowserRouter>
    </ClerkProvider>
  </React.StrictMode>
);