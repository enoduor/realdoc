import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ContentProvider } from "./context/ContentContext";
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
import "./App.css";

export default function App() {
  return (
    <ContentProvider>
      <div className="App">
        <Routes>
          {/* Public */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/help" element={<HelpCenter />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/partner" element={<PartnerWithUs />} />

          {/* Feature Landing Pages */}
          <Route path="/documentation" element={<DocumentationLanding />} />
          <Route path="/seo" element={<SEOLanding />} />
          <Route path="/analytics" element={<AnalyticsLanding />} />

          {/* Public Routes (no auth required) */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/documentation-generator" element={<DocumentationGenerator />} />
          <Route path="/seo-generator" element={<SEOGenerator />} />
          <Route path="/website-analytics" element={<WebsiteAnalytics />} />

          {/* Safety: anything unknown → landing */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </ContentProvider>
  );
}