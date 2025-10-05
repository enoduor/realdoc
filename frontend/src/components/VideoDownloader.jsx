import React, { useState } from 'react';
import { useContent } from '../context/ContentContext';

const VideoDownloader = () => {
  const { updateContent } = useContent();
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const handleDownload = async () => {
    if (!videoUrl.trim()) {
      setError('Please enter a video URL');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/video-downloader/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: videoUrl })
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      // Handle video file download
      if (response.headers.get('content-type')?.includes('video/')) {
        // Create download link for video file
        const blob = await response.blob();
        const downloadUrl = URL.createObjectURL(blob);
        setResult(downloadUrl);
      } else {
        // Handle JSON response (fallback)
        const data = await response.json();
        setResult(data);
      }

    } catch (err) {
      setError(err.message || 'Download failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">Download Videos</h2>
      <p className="text-gray-600 mb-6">Paste a video url from your social media account here.</p>
      
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Video URL</label>
        <input
          type="url"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="https://www.tiktok.com/@user/video/1234567890"
          className="w-full p-3 border rounded-lg"
        />
      </div>
      
      <button 
        onClick={handleDownload} 
        disabled={loading}
        className={`w-full py-3 px-4 rounded-lg font-medium text-white ${
          loading 
            ? 'bg-gray-400 cursor-not-allowed' 
            : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {loading ? 'Downloading...' : 'Download Video'}
      </button>

      {error && (
        <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-6">
          <h3 className="text-lg font-medium mb-2">Video Ready!</h3>
          
          <div className="mt-4 p-3 bg-green-100 text-green-700 rounded-lg">
            <p className="font-medium">✅ Video downloaded successfully!</p>
            <p className="text-sm mb-3">Your video is ready to download.</p>
            
            <a 
              href={result} 
              download="video.mp4"
              className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              📥 Download Video
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoDownloader;
