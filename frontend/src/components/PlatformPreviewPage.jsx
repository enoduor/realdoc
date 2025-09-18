import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useContent } from '../context/ContentContext';
import { publishNow } from '../api';
import PlatformPreviewPanel from './PlatformPreviewPanel';
import SubscriptionCheck, { useSubscriptionCheck } from './SubscriptionCheck';

const PlatformPreviewPage = () => {
  
  const { content } = useContent();
  const { requireSubscription } = useSubscriptionCheck();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  // Tracker removed for Platform Preview; only edit/preview panel remains

  const getAuthToken = useCallback(async () => {
    try {
      const token = await window.Clerk.session?.getToken();
      return token;
    } catch (e) {
      console.error('Error getting auth token:', e);
      return null;
    }
  }, []);

  const handlePublishNow = useCallback(async (publishData) => {
    // Check subscription before proceeding
    if (!requireSubscription('Platform Preview')) {
      return;
    }
    
    setIsLoading(true);
    setError('');
    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Authentication required');
      const response = await publishNow(publishData);
      // No tracker on Platform Preview
      setSuccess('Post published successfully!');
      return response;
    } catch (err) {
      const msg = err.message || 'Failed to publish post';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken, requireSubscription]);

  useEffect(() => {
    if (success || error) {
      const t = setTimeout(() => { setSuccess(''); setError(''); }, 5000);
      return () => clearTimeout(t);
    }
  }, [success, error]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Platform Publisher</h1>
          <Link to="/app" className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-md">Back to Dashboard</Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <SubscriptionCheck featureName="Platform Preview" />
        
        {success && (
          <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">{success}</div>
        )}
        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">{error}</div>
        )}

        <div className="grid grid-cols-1 gap-8">
          <div>
            <PlatformPreviewPanel onPublishNow={handlePublishNow} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default PlatformPreviewPage;


