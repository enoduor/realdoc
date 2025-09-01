import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ContentProvider } from './context/ContentContext';
import ClerkLogin from './components/Auth/ClerkLogin';
import ClerkRegister from './components/Auth/ClerkRegister';
import ClerkProtectedRoute from './components/Auth/ClerkProtectedRoute';
import RootRedirect from './components/Auth/RootRedirect';
import CaptionGenerator from './components/CaptionGenerator';
import HashtagGenerator from './components/HashtagGenerator';
import Dashboard from './components/Dashboard';
import MediaUploader from './components/MediaUploader';
import PlatformPreviewPage from './components/PlatformPreviewPage';
import SchedulerPage from './components/SchedulerPage';
import LandingPage from './components/LandingPage';
import PricingPage from './components/PricingPage';
import './App.css';

function App() {
  return (
    <ContentProvider>
      <Router>
        <div className="App">
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<RootRedirect />} />
            <Route path="/landing" element={<LandingPage />} />
            <Route path="/login" element={<ClerkLogin />} />
            <Route path="/register" element={<ClerkRegister />} />
            <Route path="/pricing" element={<PricingPage />} />
            
            {/* Protected routes */}
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
          </Routes>
        </div>
      </Router>
    </ContentProvider>
  );
}

export default App;