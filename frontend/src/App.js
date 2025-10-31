import React, { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ContentProvider } from "./context/ContentContext";
import ClerkLogin from "./components/Auth/ClerkLogin";
import ClerkRegister from "./components/Auth/ClerkRegister";
import ClerkProtectedRoute from "./components/Auth/ClerkProtectedRoute";
import CaptionGenerator from "./components/CaptionGenerator";
import HashtagGenerator from "./components/HashtagGenerator";
import Dashboard from "./components/Dashboard";
import SoraVideosDashboard from "./components/SoraVideosDashboard";
import MediaUploader from "./components/MediaUploader";
import VideoDownloader from "./components/VideoDownloader";
import SoraVideoGenerator from "./components/SoraVideoGenerator";
import PlatformPreviewPage from "./components/PlatformPreviewPage";
import SchedulerPage from "./components/SchedulerPage";
import SoraPlatformPreviewPage from "./components/SoraPlatformPreviewPage";
import SoraSchedulerPage from "./components/SoraSchedulerPage";
import SoraMediaUploader from "./components/SoraMediaUploader";
import LandingPage from "./components/LandingPage";
import PricingPage from "./components/PricingPage";
import HelpCenter from "./components/HelpCenter";
import AboutPage from "./components/AboutPage";
import TermsOfService from "./components/TermsOfService";
import PrivacyPolicy from "./components/PrivacyPolicy";
import PartnerWithUs from "./components/PartnerWithUs";
import APIsPage from "./components/APIsPage";
import AccountDeleted from "./components/AccountDeleted";
import SoraAPILanding from "./components/SoraAPILanding";
import SoraAPIDashboard from "./components/SoraAPIDashboard";
import "./App.css";

export default function App() {

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
              <Route path="/help" element={<HelpCenter />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/partner" element={<PartnerWithUs />} />
              <Route path="/apis" element={<APIsPage />} />
              <Route path="/sora-api" element={<SoraAPILanding />} />
              <Route path="/account-deleted" element={<AccountDeleted />} />

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
            path="/app/sora"
            element={<SoraVideosDashboard />}
          />
          <Route
            path="/app/sora/video-generator"
            element={<SoraVideoGenerator />}
          />
          <Route
            path="/app/sora/platform-preview"
            element={
              <ClerkProtectedRoute>
                <SoraPlatformPreviewPage />
              </ClerkProtectedRoute>
            }
          />
          <Route
            path="/app/sora/publish-now"
            element={
              <ClerkProtectedRoute>
                <SoraSchedulerPage />
              </ClerkProtectedRoute>
            }
          />
          <Route
            path="/app/sora/upload-media"
            element={
              <ClerkProtectedRoute>
                <SoraMediaUploader />
              </ClerkProtectedRoute>
            }
          />
          <Route
            path="/app/sora/scheduler"
            element={
              <ClerkProtectedRoute>
                <SoraSchedulerPage />
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
            path="/app/sora-api-dashboard"
            element={
              <ClerkProtectedRoute>
                <SoraAPIDashboard />
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
            path="/app/video-downloader"
            element={
              <ClerkProtectedRoute>
                <VideoDownloader />
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