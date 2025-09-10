import React, { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ContentProvider } from "./context/ContentContext";
import ClerkLogin from "./components/Auth/ClerkLogin";
import ClerkRegister from "./components/Auth/ClerkRegister";
import ClerkProtectedRoute from "./components/Auth/ClerkProtectedRoute";
import CaptionGenerator from "./components/CaptionGenerator";
import HashtagGenerator from "./components/HashtagGenerator";
import Dashboard from "./components/Dashboard";
import MediaUploader from "./components/MediaUploader";
import PlatformPreviewPage from "./components/PlatformPreviewPage";
import SchedulerPage from "./components/SchedulerPage";
import LandingPage from "./components/LandingPage";
import PricingPage from "./components/PricingPage";
import "./App.css";

export default function App() {
  // Debug logging for troubleshooting
  useEffect(() => {
    console.log('🚀 App component mounted');
    console.log('🔍 Current URL:', window.location.href);
    console.log('🔍 Current pathname:', window.location.pathname);
    console.log('🔍 Current route:', window.location.pathname);
  }, []);

  return (
    <ContentProvider>
      <div className="App">
        <Routes>
          {/* Public */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/login" element={<ClerkLogin />} />
          <Route path="/register" element={<ClerkRegister />} />
          <Route path="/pricing" element={<PricingPage />} />

          {/* Protected */}
          <Route
            path="/app"
            element={
              <ClerkProtectedRoute>
                <Dashboard />
              </ClerkProtectedRoute>
            }
          />
          <Route
            path="/app/caption-generator"
            element={
              <ClerkProtectedRoute>
                <CaptionGenerator />
              </ClerkProtectedRoute>
            }
          />
          <Route
            path="/app/hashtag-generator"
            element={
              <ClerkProtectedRoute>
                <HashtagGenerator />
              </ClerkProtectedRoute>
            }
          />
          <Route
            path="/app/media-upload"
            element={
              <ClerkProtectedRoute>
                <MediaUploader />
              </ClerkProtectedRoute>
            }
          />
          <Route
            path="/app/platform-preview"
            element={
              <ClerkProtectedRoute>
                <PlatformPreviewPage />
              </ClerkProtectedRoute>
            }
          />
          <Route
            path="/app/scheduler"
            element={
              <ClerkProtectedRoute>
                <SchedulerPage />
              </ClerkProtectedRoute>
            }
          />

          {/* Safety: anything unknown → landing */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </ContentProvider>
  );
}