import React, { useState } from 'react';

const VideoDownloader = () => {
  const [videoUrl, setVideoUrl] = useState('');
  const [result, setResult] = useState(null);

  const handleDownload = async () => {
    const response = await fetch('/api/video-downloader/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: videoUrl })
    });
    const data = await response.json();
    setResult(data);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">Video Downloader</h2>
      
      <div className="mb-4">
        <input
          type="url"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="Paste video URL here"
          className="w-full p-3 border rounded"
        />
      </div>
      
      <button onClick={handleDownload} className="bg-blue-600 text-white px-4 py-2 rounded">
        Download Video
      </button>
      
      {result && (
        <div className="mt-4 p-4 border rounded">
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

export default VideoDownloader;
