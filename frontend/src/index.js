import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App";

/** ---------- Root-domain routing (no subpath) ---------- */
const PUBLIC_BASE = "/";                 // app lives at domain root
const BASENAME = "/";                    // BrowserRouter basename (no trailing slash)

/** ---------- URL helper ---------- */
const joinUrl = (a, b = "") =>
  `${String(a).replace(/\/+$/, "")}/${String(b).replace(/^\/+/, "")}`;

/** ---------- Clerk key resolver (env or <meta>) ---------- */
function resolveClerkKey() {
  const k = process.env.REACT_APP_CLERK_PUBLISHABLE_KEY;
  if (k && k !== "undefined" && k !== "null") return k;
  const meta = document.querySelector('meta[name="clerk-publishable-key"]');
  return meta?.getAttribute("content") || "";
}

const clerkConfig = {
  publishableKey: resolveClerkKey(),
  afterSignInUrl: joinUrl(PUBLIC_BASE, "app"),
  afterSignUpUrl: joinUrl(PUBLIC_BASE, "app"),
  afterSignOutUrl: PUBLIC_BASE,
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ClerkProvider {...clerkConfig}>
      <BrowserRouter basename={BASENAME}>
        <App />
      </BrowserRouter>
    </ClerkProvider>
  </React.StrictMode>
);