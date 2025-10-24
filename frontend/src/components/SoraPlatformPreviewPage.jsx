import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useContent } from '../context/ContentContext';
import { publishNow } from '../api';
import PlatformPreviewPanel from './PlatformPreviewPanel';
import ErrorModal from './ErrorModal';

const SoraPlatformPreviewPage = () => {
  
  const { content } = useContent();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [errorModal, setErrorModal] = useState({ 
    show: false, 
    title: '', 
    message: '', 
    type: 'error'
  });
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
    // Subscription check removed - handled by dashboard
    
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
      setErrorModal({
        show: true,
        title: 'Publish Failed',
        message: msg,
        type: 'error'
      });
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

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
          <h1 className="text-xl font-bold">Sora Platform Publisher</h1>
          <Link 
            to="/app/sora/video-generator"
            className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-md"
          >
            Back to Video Generator
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {success && (
          <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">{success}</div>
        )}

        {/* Main Content Grid - Same layout as VideoGenerator */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="lg:col-span-2">
            <PlatformPreviewPanel onPublishNow={handlePublishNow} bypassDailyLimits={true} />
          </div>
        </div>
      </main>

      {/* Error Modal */}
      <ErrorModal
        isOpen={errorModal.show}
        onClose={() => setErrorModal({ show: false, title: '', message: '', type: 'error' })}
        title={errorModal.title}
        message={errorModal.message}
        type={errorModal.type}
      />
    </div>
  );
};

export default SoraPlatformPreviewPage;
