import React, { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ContentProvider } from "./context/ContentContext";
import ClerkLogin from "./components/Auth/ClerkLogin";
import ClerkRegister from "./components/Auth/ClerkRegister";
import ClerkProtectedRoute from "./components/Auth/ClerkProtectedRoute";
import DocumentationGenerator from "./components/DocumentationGenerator";
import DocumentationLanding from "./components/DocumentationLanding";
import SEOGenerator from "./components/SEOGenerator";
import SEOLanding from "./components/SEOLanding";
import WebsiteAnalytics from "./components/WebsiteAnalytics";
import AnalyticsLanding from "./components/AnalyticsLanding";
import Dashboard from "./components/Dashboard";
import LandingPage from "./components/LandingPage";
import PricingPage from "./components/PricingPage";
import HelpCenter from "./components/HelpCenter";
import AboutPage from "./components/AboutPage";
import TermsOfService from "./components/TermsOfService";
import PrivacyPolicy from "./components/PrivacyPolicy";
import PartnerWithUs from "./components/PartnerWithUs";
import AccountDeleted from "./components/AccountDeleted";
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
          <Route path="/account-deleted" element={<AccountDeleted />} />

          {/* Feature Landing Pages */}
          <Route path="/documentation" element={<DocumentationLanding />} />
          <Route path="/seo" element={<SEOLanding />} />
          <Route path="/analytics" element={<AnalyticsLanding />} />

          {/* Protected */}
          <Route
            path="/dashboard"
            element={
              <ClerkProtectedRoute>
                <Dashboard />
              </ClerkProtectedRoute>
            }
          />
          <Route
            path="/documentation-generator"
            element={
              <ClerkProtectedRoute>
                <DocumentationGenerator />
              </ClerkProtectedRoute>
            }
          />
          <Route
            path="/seo-generator"
            element={
              <ClerkProtectedRoute>
                <SEOGenerator />
              </ClerkProtectedRoute>
            }
          />
          <Route
            path="/website-analytics"
            element={
              <ClerkProtectedRoute>
                <WebsiteAnalytics />
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