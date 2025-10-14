import React, { useState, useRef, useEffect } from 'react';

const PreviewEnhancements = ({ mediaUrl, mediaType, onDownload }) => {
  const [watermarkEnabled, setWatermarkEnabled] = useState(true);
  const [watermarkPosition, setWatermarkPosition] = useState('top-left');
  const [textOverlay, setTextOverlay] = useState('');
  const [textPosition, setTextPosition] = useState('bottom-center');
  const [textColor, setTextColor] = useState('#ffffff');
  const [textSize, setTextSize] = useState(24);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [activeTab, setActiveTab] = useState('watermark');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const canvasRef = useRef(null);
  const videoRef = useRef(null);

  // Debug: Log when component renders
  console.log('PreviewEnhancements rendering with:', { mediaUrl, mediaType });

  if (!mediaUrl) {
    console.log('PreviewEnhancements: No mediaUrl provided');
    return null;
  }

  // Function to apply enhancements to video
  const applyEnhancements = async () => {
    if (!videoRef.current || !canvasRef.current) return null;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Apply filters
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
    
    // Draw video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Apply watermark
    if (watermarkEnabled) {
      ctx.save();
      ctx.font = 'bold 16px Arial';
      ctx.fillStyle = 'rgba(102, 126, 234, 0.8)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 2;
      
      const watermarkText = 'ReelPostly';
      const textMetrics = ctx.measureText(watermarkText);
      const textWidth = textMetrics.width;
      const textHeight = 20;
      
      let x, y;
      switch (watermarkPosition) {
        case 'top-left':
          x = 10;
          y = 30;
          break;
        case 'top-right':
          x = canvas.width - textWidth - 10;
          y = 30;
          break;
        case 'bottom-left':
          x = 10;
          y = canvas.height - 10;
          break;
        case 'bottom-right':
          x = canvas.width - textWidth - 10;
          y = canvas.height - 10;
          break;
        case 'center':
          x = (canvas.width - textWidth) / 2;
          y = canvas.height / 2;
          break;
        default:
          x = 10;
          y = 30;
      }
      
      ctx.strokeText(watermarkText, x, y);
      ctx.fillText(watermarkText, x, y);
      ctx.restore();
    }

    // Apply text overlay
    if (textOverlay) {
      ctx.save();
      ctx.font = `bold ${textSize}px Arial`;
      ctx.fillStyle = textColor;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.lineWidth = 2;
      
      const textMetrics = ctx.measureText(textOverlay);
      const textWidth = textMetrics.width;
      
      let x, y;
      switch (textPosition) {
        case 'top-center':
          x = (canvas.width - textWidth) / 2;
          y = 40;
          break;
        case 'top-left':
          x = 20;
          y = 40;
          break;
        case 'top-right':
          x = canvas.width - textWidth - 20;
          y = 40;
          break;
        case 'bottom-center':
          x = (canvas.width - textWidth) / 2;
          y = canvas.height - 20;
          break;
        case 'bottom-left':
          x = 20;
          y = canvas.height - 20;
          break;
        case 'bottom-right':
          x = canvas.width - textWidth - 20;
          y = canvas.height - 20;
          break;
        case 'center':
          x = (canvas.width - textWidth) / 2;
          y = canvas.height / 2;
          break;
        default:
          x = (canvas.width - textWidth) / 2;
          y = canvas.height - 20;
      }
      
      ctx.strokeText(textOverlay, x, y);
      ctx.fillText(textOverlay, x, y);
      ctx.restore();
    }

    return canvas.toDataURL('image/jpeg', 0.9);
  };

  // Enhanced download function
  const handleEnhancedDownload = async () => {
    setIsProcessing(true);
    try {
      // For video, we'll create a canvas-based enhancement
      if (mediaType === 'video') {
        const enhancedDataUrl = await applyEnhancements();
        if (enhancedDataUrl) {
          const link = document.createElement('a');
          link.href = enhancedDataUrl;
          link.download = `enhanced_${Date.now()}.jpg`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      } else {
        // For images, apply enhancements directly
        const enhancedDataUrl = await applyEnhancements();
        if (enhancedDataUrl) {
          const link = document.createElement('a');
          link.href = enhancedDataUrl;
          link.download = `enhanced_${Date.now()}.jpg`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      }
    } catch (error) {
      console.error('Error processing enhanced video:', error);
      alert('Error processing video. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ 
      border: '2px solid #007bff', 
      padding: '15px', 
      margin: '15px auto', 
      borderRadius: '8px',
      background: '#f8f9fa',
      maxWidth: '600px'
    }}>
      {/* Debug indicator */}
      <div style={{ 
        background: '#e3f2fd', 
        padding: '10px', 
        margin: '8px 0', 
        border: '1px solid #2196f3', 
        borderRadius: '6px',
        textAlign: 'center'
      }}>
        <strong style={{ color: '#1976d2', fontSize: '14px' }}>
          🎨 Video Enhancement Controls
        </strong>
        <p style={{ margin: '3px 0 0 0', color: '#424242', fontSize: '12px' }}>
          Add watermark, text overlays, and apply filters to your video
        </p>
      </div>
      
      {/* Tab Navigation */}
      <div style={{ 
        background: 'white', 
        padding: '12px', 
        margin: '10px 0', 
        border: '1px solid #ddd', 
        borderRadius: '6px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', gap: '4px', marginBottom: '15px', justifyContent: 'center' }}>
          <button 
            onClick={() => setActiveTab('watermark')}
            style={{ 
              padding: '6px 12px', 
              background: activeTab === 'watermark' ? '#007bff' : '#f8f9fa',
              color: activeTab === 'watermark' ? 'white' : '#333',
              border: '1px solid #ddd', 
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: '500',
              fontSize: '12px'
            }}
          >
            🏷️ Watermark
          </button>
          <button 
            onClick={() => setActiveTab('text')}
            style={{ 
              padding: '6px 12px', 
              background: activeTab === 'text' ? '#28a745' : '#f8f9fa',
              color: activeTab === 'text' ? 'white' : '#333',
              border: '1px solid #ddd', 
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: '500',
              fontSize: '12px'
            }}
          >
            📝 Text
          </button>
          <button 
            onClick={() => setActiveTab('filters')}
            style={{ 
              padding: '6px 12px', 
              background: activeTab === 'filters' ? '#ffc107' : '#f8f9fa',
              color: activeTab === 'filters' ? 'black' : '#333',
              border: '1px solid #ddd', 
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: '500',
              fontSize: '12px'
            }}
          >
            🎨 Filters
          </button>
        </div>

        {/* Watermark Controls */}
        {activeTab === 'watermark' && (
          <div style={{ textAlign: 'center' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#333', fontSize: '14px' }}>ReelPostly Watermark</h4>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                <input 
                  type="checkbox" 
                  checked={watermarkEnabled}
                  onChange={(e) => setWatermarkEnabled(e.target.checked)}
                />
                <span style={{ fontSize: '12px' }}>Enable ReelPostly watermark</span>
              </label>
            </div>
            {watermarkEnabled && (
              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>Position:</label>
                <select 
                  value={watermarkPosition}
                  onChange={(e) => setWatermarkPosition(e.target.value)}
                  style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '12px' }}
                >
                  <option value="top-left">Top Left</option>
                  <option value="top-right">Top Right</option>
                  <option value="bottom-left">Bottom Left</option>
                  <option value="bottom-right">Bottom Right</option>
                  <option value="center">Center</option>
                </select>
              </div>
            )}
          </div>
        )}

        {/* Text Overlay Controls */}
        {activeTab === 'text' && (
          <div style={{ textAlign: 'center' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#333', fontSize: '14px' }}>Text Overlay</h4>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>Text:</label>
              <input 
                type="text" 
                value={textOverlay}
                onChange={(e) => setTextOverlay(e.target.value)}
                placeholder="Enter text to overlay..."
                style={{ 
                  width: '80%', 
                  padding: '6px', 
                  borderRadius: '4px', 
                  border: '1px solid #ddd',
                  fontSize: '12px'
                }}
              />
            </div>
            {textOverlay && (
              <>
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>Position:</label>
                  <select 
                    value={textPosition}
                    onChange={(e) => setTextPosition(e.target.value)}
                    style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '12px' }}
                  >
                    <option value="top-center">Top Center</option>
                    <option value="top-left">Top Left</option>
                    <option value="top-right">Top Right</option>
                    <option value="bottom-center">Bottom Center</option>
                    <option value="bottom-left">Bottom Left</option>
                    <option value="bottom-right">Bottom Right</option>
                    <option value="center">Center</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', justifyContent: 'center', alignItems: 'center' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>Color:</label>
                    <input 
                      type="color" 
                      value={textColor}
                      onChange={(e) => setTextColor(e.target.value)}
                      style={{ width: '30px', height: '30px', border: 'none', borderRadius: '4px' }}
                    />
                  </div>
                  <div style={{ flex: 1, maxWidth: '200px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>
                      Size: {textSize}px
                    </label>
                    <input 
                      type="range" 
                      min="12" 
                      max="72" 
                      value={textSize}
                      onChange={(e) => setTextSize(parseInt(e.target.value))}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Filters Controls */}
        {activeTab === 'filters' && (
          <div style={{ textAlign: 'center' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#333', fontSize: '14px' }}>Video Filters</h4>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>
                Brightness: {brightness}%
              </label>
              <input 
                type="range" 
                min="0" 
                max="200" 
                value={brightness}
                onChange={(e) => setBrightness(parseInt(e.target.value))}
                style={{ width: '80%' }}
              />
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>
                Contrast: {contrast}%
              </label>
              <input 
                type="range" 
                min="0" 
                max="200" 
                value={contrast}
                onChange={(e) => setContrast(parseInt(e.target.value))}
                style={{ width: '80%' }}
              />
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>
                Saturation: {saturation}%
              </label>
              <input 
                type="range" 
                min="0" 
                max="200" 
                value={saturation}
                onChange={(e) => setSaturation(parseInt(e.target.value))}
                style={{ width: '80%' }}
              />
            </div>
          </div>
        )}

        {/* Download Button */}
        <div style={{ marginTop: '15px', textAlign: 'center' }}>
          <button 
            onClick={handleEnhancedDownload}
            disabled={isProcessing}
            style={{ 
              padding: '8px 20px', 
              background: isProcessing ? '#6c757d' : '#6f42c1', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              fontWeight: '500',
              fontSize: '12px'
            }}
          >
            {isProcessing ? '⏳ Processing...' : '💾 Download Enhanced'}
          </button>
        </div>

        {/* Hidden canvas and video for processing */}
        <div style={{ display: 'none' }}>
          <video 
            ref={videoRef}
            src={mediaUrl}
            crossOrigin="anonymous"
            onLoadedData={() => {
              if (videoRef.current) {
                videoRef.current.currentTime = 0; // Set to first frame
              }
            }}
          />
          <canvas ref={canvasRef} />
        </div>
      </div>
    </div>
  );
};

export default PreviewEnhancements;