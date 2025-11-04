import React from "react";
import ReactDOM from "react-dom/client";
// import { ClerkProvider } from "@clerk/clerk-react";
import { AuthProvider } from "./context/AuthContext";
import { BrowserRouter } from "react-router-dom";
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
const PUBLIC_BASE = "/";                 // app lives at domain root
const BASENAME = "/";                    // BrowserRouter basename (no trailing slash)

/** ---------- URL helper ---------- */
const joinUrl = (a, b = "") =>
  `${String(a).replace(/\/+$/, "")}/${String(b).replace(/^\/+/, "")}`;

// /** ---------- Clerk key resolver (env or <meta>) ---------- */
// function resolveClerkKey() {
//   const k = process.env.REACT_APP_CLERK_PUBLISHABLE_KEY;
//   if (k && k !== "undefined" && k !== "null") return k;
//   const meta = document.querySelector('meta[name="clerk-publishable-key"]');
//   return meta?.getAttribute("content") || "";
// }

// // Detect if we're running on production
// const isProdHost = typeof window !== "undefined" && 
//   (window.location.hostname === "realdoc.com" || 
//    window.location.hostname === "www.realdoc.com");


// const clerkConfig = {
//   publishableKey: resolveClerkKey(),
//   fallbackRedirectUrl: joinUrl(PUBLIC_BASE, "app/documentation-generator"),
//   afterSignInUrl: joinUrl(PUBLIC_BASE, "app/documentation-generator"),
//   afterSignUpUrl: joinUrl(PUBLIC_BASE, "app/documentation-generator"),
//   afterSignOutUrl: PUBLIC_BASE,
// };

// // Only use custom frontendApi in production
// if (isProdHost) {
//   clerkConfig.frontendApi = "https://clerk.realdoc.com";
// }



ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {/* <ClerkProvider {...clerkConfig}> */}
      <AuthProvider>
        <BrowserRouter basename={BASENAME}>
          <App />
        </BrowserRouter>
      </AuthProvider>
    {/* </ClerkProvider> */}
  </React.StrictMode>
);