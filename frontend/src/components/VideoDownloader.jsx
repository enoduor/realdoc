import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useContent } from '../context/ContentContext';

const VideoDownloader = () => {
  const navigate = useNavigate();
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
        // Save video to uploads section instead of local download
        const blob = await response.blob();
        const videoFile = new File([blob], 'downloaded-video.mp4', { type: 'video/mp4' });
        
        // Create preview URL immediately for better UX
        const previewUrl = URL.createObjectURL(blob);
        
        // Update content with preview first
        updateContent({
          mediaUrl: previewUrl,
          mediaType: 'video',
          mediaFile: videoFile,
          mediaFilename: 'downloaded-video.mp4'
        });
        
        setResult('Video saved! Uploading to server...');
        
        // Now upload to S3 in the background
        try {
          const uploadFormData = new FormData();
          uploadFormData.append('file', videoFile);
          uploadFormData.append('platform', 'video');
          
          const uploadResponse = await fetch(`${process.env.REACT_APP_AI_API?.replace(/\/$/, '') || 'https://reelpostly.com/ai'}/api/v1/upload`, {
            method: 'POST',
            body: uploadFormData
          });
          
          if (!uploadResponse.ok) {
            throw new Error('Upload to server failed');
          }
          
          const uploadData = await uploadResponse.json();
          
          if (uploadData && uploadData.url) {
            // Update content with S3 URL
            updateContent({
              mediaUrl: uploadData.url,
              mediaType: uploadData.type || 'video',
              mediaDimensions: uploadData.dimensions || null,
              mediaFile: null,
              mediaFilename: uploadData.filename
            });
            
            setResult('✅ Video uploaded successfully! Ready to publish.');
          } else {
            throw new Error('No URL returned from upload');
          }
        } catch (uploadError) {
          console.error('Upload error:', uploadError);
          setError('Video downloaded but upload to server failed. Please try uploading manually from Media Upload page.');
        }
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
          <h3 className="text-lg font-medium mb-2">Video Saved!</h3>
          
          <div className="mt-4 p-3 bg-green-100 text-green-700 rounded-lg">
            <p className="font-medium">✅ Video saved to uploads section!</p>
            <p className="text-sm mb-3">Your video is now available in the Media Upload section for publishing.</p>
            
            <div className="mt-4">
              <button 
                onClick={() => navigate('/app/caption-generator')}
                className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 font-medium"
              >
                🎯 Generate Captions Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoDownloader;
