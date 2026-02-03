// src/context/AuthContext.js
import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";

/** Helper: fetch JSON with optional Clerk token */
async function fetchJSON(path, { method = "GET", token, body } = {}) {
  const res = await fetch(path.startsWith("/api") ? path : `/api${path}`, {
    method,
    credentials: "include",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text(); // read once
  const isJson = (res.headers.get("content-type") || "").includes("application/json");
  const data = isJson ? (()=>{ try { return JSON.parse(text); } catch { return { raw:text }; } })() : text;
  if (!res.ok) {
    const msg = typeof data === "string" ? data : data?.error || res.statusText;
    throw new Error(msg);
  }
  return data;
}

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const { isSignedIn, getToken } = useAuth();
  const { user, isLoaded } = useUser();

  const [me, setMe] = useState(null);        // DB snapshot (normalized)
  const [loading, setLoading] = useState(false); // Set to false since we're not loading Clerk
  const [error, setError]   = useState(null);

  const createOrLink = useCallback(async () => {
    const token = await getToken().catch(() => undefined);
    if (!token || !user) return;

    // Send minimal trusted fields; backend is idempotent & handles races
    await fetchJSON("/api/auth/create-or-link", {
      method: "POST",
      token,
      body: {
        email: user?.primaryEmailAddress?.emailAddress,
        firstName: user?.firstName || "",
        lastName: user?.lastName || "",
      },
    });
  }, [getToken, user]);

  const loadMe = useCallback(async () => {
    const token = await getToken().catch(() => undefined);
    if (!token) return null;
    const data = await fetchJSON("/api/auth/me", { token });
    setMe(data);
    return data;
  }, [getToken]);

  // Bootstrap when Clerk is ready
  useEffect(() => {
    let cancelled = false;

    async function boot() {
      setLoading(true);
      setError(null);

      try {
        if (!isLoaded) return;
        if (!isSignedIn || !user) {
          setMe(null);
          return;
        }
        // 1) Ensure DB user exists & is linked
        await createOrLink();
        // 2) Pull fresh DB snapshot
        await loadMe();
      } catch (e) {
        if (!cancelled) setError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    boot();
    return () => { cancelled = true; };
  }, [isLoaded, isSignedIn, user, createOrLink, loadMe]);

  // Expose a manual refresh (e.g., after webhooks)
  const refresh = useCallback(async () => {
    try { return await loadMe(); } catch (e) { setError(e); throw e; }
  }, [loadMe]);

  const value = useMemo(() => ({
    clerkUser: user || null,   // raw Clerk user (null when Clerk is disabled)
    isSignedIn: !!isSignedIn,  // false when Clerk is disabled
    me,                        // DB-backed snapshot (subscriptionStatus, plan, etc.)
    loading,
    error,
    refresh,
  }), [user, isSignedIn, me, loading, error, refresh]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuthContext() {
  return useContext(AuthCtx);
}