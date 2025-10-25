'use client';
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

// Singleton FFmpeg loader (v0.12 API)
let __ffmpegInstance = null;
const getFFmpeg = async () => {
  if (!__ffmpegInstance) {
    __ffmpegInstance = new FFmpeg({ log: false });
    await __ffmpegInstance.load();
  }
  return __ffmpegInstance;
};

// MediaRecorder support helpers
const isTypeSupported = (mime) =>
  typeof window !== 'undefined' && window.MediaRecorder && typeof window.MediaRecorder.isTypeSupported === 'function'
    ? window.MediaRecorder.isTypeSupported(mime)
    : false;

/**
 * Preview-enhance and save MP4 directly from the preview video.
 * Prefers a local Blob/Object URL (no CORS). Does NOT fetch S3.
 *
 * Props:
 *  - mediaUrl: string (fallback if no mediaBlob)
 *  - mediaBlob?: Blob (preferred; guarantees CORS-clean canvas)
 *  - mediaType: string
 *  - videoSize: "WIDTHxHEIGHT" (e.g., "1280x720" or "720x1280")
 *  - onDownload?: (objectUrl, blob) => void
 *  - onClose?: () => void
 */
const PreviewEnhancements = ({
  mediaUrl,
  mediaBlob,
  mediaType,
  videoSize,
  onDownload,
  onClose,
  originalKey,
  platform,
  subscriptionPlan,
  onUploadComplete,
  onAssetChange, // NEW: notify parent when enhanced asset is ready
}) => {
  const [watermarkEnabled, setWatermarkEnabled] = useState(true);
  const [watermarkPosition, setWatermarkPosition] = useState('top-left');
  const [watermarkLogo, setWatermarkLogo] = useState(null);
  const [watermarkLogoUrl, setWatermarkLogoUrl] = useState(null);
  const [watermarkLogoImage, setWatermarkLogoImage] = useState(null);
  const [textOverlay, setTextOverlay] = useState('');
  const [textPosition, setTextPosition] = useState('bottom-center');
  const [textColor, setTextColor] = useState('#ffffff');
  const [textSize, setTextSize] = useState(24);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [activeTab, setActiveTab] = useState('watermark');
  const [isProcessing, setIsProcessing] = useState(false);
  const [needsUserGesture, setNeedsUserGesture] = useState(false);
  // Helper: play video with sound on user gesture (for browsers that require it)
  const playWithSound = async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      // Ensure any AudioContext we created is running
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        await audioCtxRef.current.resume().catch(() => {});
      }
      v.muted = false;
      v.defaultMuted = false;
      v.volume = 1.0;
      await v.play();
      setNeedsUserGesture(false);
    } catch (e) {
      // If autoplay still blocked, keep overlay visible
      setNeedsUserGesture(true);
    }
  };

  // Handle logo upload
  const handleLogoUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        alert('Logo file size must be less than 2MB');
        return;
      }
      
      // Validate file type
      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
      if (!allowedTypes.includes(file.type)) {
        alert('Please upload a PNG, JPG, or SVG file');
        return;
      }
      
      setWatermarkLogo(file);
      const url = URL.createObjectURL(file);
      setWatermarkLogoUrl(url);
      
      // Preload and resize the image to 250x250
      const img = new Image();
      img.onload = () => {
        // Create a canvas to resize the image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Set canvas size to 125x125 (50% of 250x250)
        canvas.width = 125;
        canvas.height = 125;
        
        // Draw the image resized to 125x125
        ctx.drawImage(img, 0, 0, 125, 125);
        
        // Convert canvas to blob and create new URL
        canvas.toBlob((blob) => {
          const resizedUrl = URL.createObjectURL(blob);
          setWatermarkLogoUrl(resizedUrl);
          
          // Create a new image object with the resized image
          const resizedImg = new Image();
          resizedImg.onload = () => {
            setWatermarkLogoImage(resizedImg);
          };
          resizedImg.src = resizedUrl;
        }, 'image/png');
      };
      img.src = url;
    }
  };

  // Prefer/track enhanced preview & latest asset
  const [overrideSrc, setOverrideSrc] = useState(null);    // enhanced URL to show in preview
  const [latestAsset, setLatestAsset] = useState(null);    // enhanced asset to hand to parent

  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const objectUrlRef = useRef(null);
  const audioCtxRef = useRef(null);

  // Prefer an override (uploaded enhanced URL), else local Blob URL (no CORS), else provided mediaUrl
  const resolvedSrc = useMemo(() => {
    if (overrideSrc) return overrideSrc;
    if (mediaBlob instanceof Blob) {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = URL.createObjectURL(mediaBlob);
      return objectUrlRef.current;
    }
    return mediaUrl || '';
  }, [overrideSrc, mediaBlob, mediaUrl]);

  // Clean up Object URL if we created it
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  if (!resolvedSrc) return null;

  // Calculate preview box size (UI only)
  const getPreviewDimensions = () => {
    const [w, h] = (videoSize || '1280x720').split('x').map(Number);
    const ar = w / h;
    if (ar < 1) {
      return { width: 'auto', maxWidth: '300px', height: '533px', maxHeight: '533px' };
    }
    return { width: '100%', maxWidth: '500px', height: '281px', maxHeight: '281px' };
  };
  const previewDimensions = getPreviewDimensions();

  // Try multiple codecs for MediaRecorder (prefer MP4 only if natively supported)
  const makeRecorder = (stream, hasAudio = false) => {
    const mp4Audio = 'video/mp4;codecs=h264,aac';
    const mp4Video = 'video/mp4;codecs=h264';
    const webmVp9Opus = 'video/webm;codecs=vp9,opus';
    const webmVp8Opus = 'video/webm;codecs=vp8,opus';
    const webmVp9 = 'video/webm;codecs=vp9';
    const webmVp8 = 'video/webm;codecs=vp8';

    const candidates = [];
    if (hasAudio && isTypeSupported(mp4Audio)) candidates.push(mp4Audio);
    if (isTypeSupported(mp4Video)) candidates.push(mp4Video);
    if (hasAudio && isTypeSupported(webmVp9Opus)) candidates.push(webmVp9Opus);
    if (hasAudio && isTypeSupported(webmVp8Opus)) candidates.push(webmVp8Opus);
    if (isTypeSupported(webmVp9)) candidates.push(webmVp9);
    if (isTypeSupported(webmVp8)) candidates.push(webmVp8);
    if (isTypeSupported('video/webm')) candidates.push('video/webm');

    for (const mimeType of candidates) {
      try {
        return new MediaRecorder(stream, { mimeType });
      } catch (_) {}
    }
    return new MediaRecorder(stream);
  };

  // Convert a WebM blob to MP4 in-browser using ffmpeg.wasm (lazy-loaded)
  const transcodeWebMToMp4 = async (webmBlob) => {
    if (typeof window === 'undefined') {
      throw new Error('FFmpeg can only run in the browser');
    }
    try {
      const ffmpeg = await getFFmpeg();

      const inputName = 'input.webm';
      const outputName = 'output.mp4';

      try { await ffmpeg.deleteFile?.(inputName); } catch (_) {}
      try { await ffmpeg.deleteFile?.(outputName); } catch (_) {}

      const inputData = await fetchFile(webmBlob);
      await ffmpeg.writeFile(inputName, inputData);

      await ffmpeg.exec([
        '-i', inputName,
        // map first video and first audio if present
        '-map', '0:v:0',
        '-map', '0:a:0?',
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '23',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        // if A/V lengths differ, end at the shortest to avoid silent tails
        '-shortest',
        outputName,
      ]);

      const data = await ffmpeg.readFile(outputName);
      return new Blob([data], { type: 'video/mp4' });
    } catch (e) {
      console.error('FFmpeg transcode failed (v0.12):', e);
      throw new Error('MP4 transcode failed (ffmpeg.wasm)');
    }
  };

  // Draw + record the visible preview video to canvas, overlaying watermark & text
  const processVideoWithEnhancements = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) throw new Error('Missing video/canvas');

    if (video.readyState < 1) {
      await new Promise((res) => video.addEventListener('loadedmetadata', res, { once: true }));
    }

    const ctx = canvas.getContext('2d');

    const vw = video.videoWidth || Math.max(640, video.clientWidth || 640);
    const vh = video.videoHeight || Math.max(360, video.clientHeight || 360);
    canvas.width = vw;
    canvas.height = vh;

    try {
      video.loop = false;
      video.playsInline = true;
      video.muted = false; // Ensure video is not muted for audio capture
      video.volume = 1.0; // Ensure volume is at maximum
      
      // Force video to load audio if not already loaded
      if (video.readyState < 2) {
        await new Promise((resolve) => {
          video.addEventListener('canplay', resolve, { once: true });
          video.load();
        });
      }
    } catch (_) {}

    const durationSec = Number.isFinite(video.duration) ? video.duration : null;
    const maxDurationMs = (durationSec && durationSec > 0 ? durationSec * 1000 : 60000) + 1500;

    const canvasStream = canvas.captureStream(30); // 30fps
    const sourceStream =
      video.captureStream?.() ||
      video.mozCaptureStream?.() ||
      null;

    const combined = new MediaStream();
    const canvasTrack = canvasStream.getVideoTracks()[0];
    if (canvasTrack) combined.addTrack(canvasTrack);

    let hasAudio = !!(sourceStream && sourceStream.getAudioTracks().length > 0);
    if (hasAudio) {
      sourceStream.getAudioTracks().forEach((t) => combined.addTrack(t));
    }
    // Fallback: if no audio tracks captured from <video>, route via WebAudio and record
    if (
      !hasAudio &&
      (window.AudioContext || window.webkitAudioContext)
    ) {
      try {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        const ac = audioCtxRef.current;
        // Resume on user gesture if suspended (clicking "Update Video" counts as a gesture)
        if (ac.state === 'suspended') {
          await ac.resume().catch(() => {});
        }
        const srcNode = ac.createMediaElementSource(video);
        const dest = ac.createMediaStreamDestination();
        // so the user can still hear the sound locally
        srcNode.connect(ac.destination);
        // and also feed a clean stream to the recorder
        srcNode.connect(dest);
        const audioTrack = dest.stream.getAudioTracks()[0];
        if (audioTrack) {
          combined.addTrack(audioTrack);
          hasAudio = true;
        }
      } catch (e) {
        console.warn('WebAudio fallback for audio capture failed:', e);
      }
    }

    const recorder = makeRecorder(combined, hasAudio);
    const chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    let rafId = null;
    const drawFrame = () => {
      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      if (watermarkEnabled && watermarkLogoImage) {
        ctx.save();
        // Fixed square logo size: 125x125 pixels (50% of original)
        const logoWidth = 125;
        const logoHeight = 125;
        
        let x = 10, y = 30;
        switch (watermarkPosition) {
          case 'top-left': x = 10; y = 30; break;
          case 'top-right': x = canvas.width - logoWidth - 10; y = 30; break;
          case 'bottom-left': x = 10; y = canvas.height - logoHeight - 10; break;
          case 'bottom-right': x = canvas.width - logoWidth - 10; y = canvas.height - logoHeight - 10; break;
          case 'center': x = (canvas.width - logoWidth) / 2; y = (canvas.height - logoHeight) / 2; break;
          default: break;
        }
        ctx.globalAlpha = 0.8; // Transparency
        ctx.drawImage(watermarkLogoImage, x, y, logoWidth, logoHeight);
        ctx.restore();
      } else if (watermarkEnabled && !watermarkLogoUrl) {
        // Fallback to text if no logo is uploaded
        ctx.save();
        ctx.font = 'bold 16px Arial';
        ctx.fillStyle = 'rgba(102, 126, 234, 0.8)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 2;
        const wText = 'ReelPostly';
        const wWidth = ctx.measureText(wText).width;
        let x = 10, y = 30;
        switch (watermarkPosition) {
          case 'top-left': x = 10; y = 30; break;
          case 'top-right': x = canvas.width - wWidth - 10; y = 30; break;
          case 'bottom-left': x = 10; y = canvas.height - 10; break;
          case 'bottom-right': x = canvas.width - wWidth - 10; y = canvas.height - 10; break;
          case 'center': x = (canvas.width - wWidth) / 2; y = canvas.height / 2; break;
          default: break;
        }
        ctx.strokeText(wText, x, y);
        ctx.fillText(wText, x, y);
        ctx.restore();
      }

      if (textOverlay) {
        ctx.save();
        ctx.font = `bold ${textSize}px Arial`;
        ctx.fillStyle = textColor;
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.lineWidth = 2;
        const tWidth = ctx.measureText(textOverlay).width;
        let x = (canvas.width - tWidth) / 2;
        let y = canvas.height - 20;
        switch (textPosition) {
          case 'top-center': x = (canvas.width - tWidth) / 2; y = 40; break;
          case 'top-left': x = 20; y = 40; break;
          case 'top-right': x = canvas.width - tWidth - 20; y = 40; break;
          case 'bottom-center': x = (canvas.width - tWidth) / 2; y = canvas.height - 20; break;
          case 'bottom-left': x = 20; y = canvas.height - 20; break;
          case 'bottom-right': x = canvas.width - tWidth - 20; y = canvas.height - 20; break;
          case 'center': x = (canvas.width - tWidth) / 2; y = canvas.height / 2; break;
          default: break;
        }
        ctx.strokeText(textOverlay, x, y);
        ctx.fillText(textOverlay, x, y);
        ctx.restore();
      }

      if (!video.ended) rafId = requestAnimationFrame(drawFrame);
    };

    try { if (video.currentTime > 0) video.currentTime = 0; } catch (_) {}

    await new Promise((res) => {
      if (video.readyState >= 2) res();
      else video.addEventListener('canplay', res, { once: true });
    });

    return new Promise(async (resolve, reject) => {
      const cleanup = () => {
        if (rafId) cancelAnimationFrame(rafId);
        if (stopTimerId) clearTimeout(stopTimerId);
        if (timeoutId) clearTimeout(timeoutId);
        video.removeEventListener('volumechange', preventMuting);
      };

      const timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error('Video processing timeout'));
      }, 30000);

      const stopOnce = () => { try { recorder.stop(); } catch (_) {} };

      const stopTimerId = setTimeout(() => {
        stopOnce();
      }, maxDurationMs);

      recorder.onstop = () => {
        cleanup();
        const type = recorder.mimeType || 'video/webm';
        resolve(new Blob(chunks, { type }));
      };
      recorder.onerror = (err) => { cleanup(); reject(err); };

      const onEnded = () => {
        stopOnce();
        video.removeEventListener('ended', onEnded);
      };
      video.addEventListener('ended', onEnded, { once: true });

      recorder.start();
      
      // Ensure video is not muted before playing and maintain audio
      video.muted = false;
      video.volume = 1.0;
      
      // Add event listener to prevent muting during playback
      const preventMuting = () => {
        if (video.muted) {
          video.muted = false;
        }
      };
      
      video.addEventListener('volumechange', preventMuting);
      
      // Try to start playback; if blocked, the recording will proceed once user interacts
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        try { await audioCtxRef.current.resume(); } catch (_) {}
      }
      try { await video.play(); } catch (_) {}
      rafId = requestAnimationFrame(drawFrame);
    });
  };

  const handleEnhancedSave = async () => {
    setIsProcessing(true);
    try {
      if (!window.MediaRecorder) throw new Error('MediaRecorder not supported');
      if (!videoRef.current || videoRef.current.readyState < 2) throw new Error('Video not ready');
      if (!canvasRef.current) throw new Error('Canvas not available');

      const rawBlob = await processVideoWithEnhancements();
      if (!rawBlob || rawBlob.size === 0) throw new Error('No output from recorder');

      const producedType = (rawBlob.type || '').toLowerCase();

      const MAX_IN_BROWSER_BYTES = 100 * 1024 * 1024; // 100MB
      if (rawBlob.size > MAX_IN_BROWSER_BYTES && (producedType.includes('webm') || producedType === '')) {
        throw new Error('Video too large to convert in-browser. Use server transcode.');
      }

      let finalBlob = null;
      if (producedType.includes('mp4')) {
        finalBlob = rawBlob;
      } else if (producedType.includes('webm') || producedType === '' ) {
        finalBlob = await transcodeWebMToMp4(rawBlob);
      } else {
        finalBlob = await transcodeWebMToMp4(rawBlob);
      }

      if (!finalBlob || finalBlob.size === 0) throw new Error('Empty final MP4 blob');

      const API_BASE = process.env.REACT_APP_PYTHON_API_URL || process.env.NEXT_PUBLIC_PYTHON_API_URL || 'http://localhost:5001';
      const UPLOAD_URL = API_BASE.replace(/\/$/, '') + '/api/v1/upload';

      const form = new FormData();
      form.append('file', new File([finalBlob], 'enhanced.mp4', { type: 'video/mp4' }));
      form.append('enhanced', 'true');
      if (platform && String(platform).toLowerCase() === 'sora') {
        form.append('billing_model', 'tokens');
      }
      if (platform != null) form.append('platform', String(platform));
      if (subscriptionPlan != null) form.append('subscription_plan', String(subscriptionPlan));
      if (originalKey) {
        form.append('replace_original', 'true');
        form.append('original_key', String(originalKey));
      }

      const resp = await fetch(UPLOAD_URL, { method: 'POST', body: form });
      if (!resp.ok) {
        const errTxt = await resp.text().catch(() => '');
        throw new Error(`Upload failed (${resp.status}) ${errTxt}`);
      }

      const data = await resp.json();
      if (!data || !data.url || !data.key) {
        throw new Error('Unexpected upload response');
      }

      // 1) Update in-app preview to the enhanced S3 URL so users stay in flow
      try {
        setOverrideSrc(data.url);
        if (videoRef.current) {
          const v = videoRef.current;
          v.pause();
          v.src = data.url;
          v.crossOrigin = 'anonymous';
          v.muted = false; // Ensure enhanced video is not muted
          v.volume = 1.0; // Set volume to maximum
          v.defaultMuted = false; // Ensure default is not muted
          await v.load?.();
          try { v.currentTime = 0; } catch (_) {}

          v.addEventListener('loadedmetadata', () => {
            v.muted = false;
            v.defaultMuted = false;
            v.volume = 1.0;
          }, { once: true });

          // Do not autoplay with sound to avoid browsers re-muting the element.
          // Show a tap-to-play overlay that starts playback with sound on user gesture.
          setNeedsUserGesture(true);
        }
      } catch (_) {}

      // 2) Persist latest asset so the Publish step picks it up
      const asset = { ...data, replaced: !!originalKey };
      setLatestAsset(asset);
      try {
        sessionStorage.setItem('reelpostly.publishAsset', JSON.stringify(asset));
        window.dispatchEvent(new CustomEvent('reelpostly:enhanced-video-ready', { detail: asset }));
      } catch (_) {}

      // 3) Notify parent to advance publish flow
      if (typeof onAssetChange === 'function') onAssetChange(asset);
      if (typeof onUploadComplete === 'function') onUploadComplete(asset);

      // 4) Intentionally skip onDownload to avoid breaking the app flow
      // if (typeof onDownload === 'function') onDownload(data.url, finalBlob);
    } catch (err) {
      console.error('Enhanced save failed:', err);
      alert(`Export failed: ${err.message}. If this keeps happening, your browser may not support MP4 recording natively (we auto-convert WebM → MP4). If the error mentions upload, check API_BASE and CORS.`);
    } finally {
      setIsProcessing(false);
    }
  };

  const isBlobSrc = resolvedSrc.startsWith('blob:');

  return (
    <div style={{
      border: '2px solid #007bff',
      padding: '15px',
      margin: '15px auto',
      borderRadius: '8px',
      background: '#f8f9fa',
      maxWidth: '600px'
    }}>
      {/* Header */}
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

      {/* Video Preview (this is the same element we record from) */}
      <div style={{
        background: 'white',
        padding: '15px',
        margin: '10px 0',
        border: '1px solid #ddd',
        borderRadius: '6px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        textAlign: 'center'
      }}>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <video
            ref={videoRef}
            src={resolvedSrc}
            controls
            // When blob URL, omit crossOrigin to keep it same-origin-clean
            crossOrigin={isBlobSrc ? undefined : 'anonymous'}
            style={{
              ...previewDimensions,
              borderRadius: '6px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`
            }}
            playsInline
            preload="auto"
            onLoadedData={() => {
              try { 
                if (videoRef.current) {
                  videoRef.current.currentTime = 0;
                  videoRef.current.muted = false; // Ensure enhanced video is not muted
                }
              } catch (_) {}
            }}
            onPlay={() => setNeedsUserGesture(false)}
          />

          {/* UI watermark preview */}
          {watermarkEnabled && (
            <div style={{
              position: 'absolute',
              ...(watermarkPosition === 'top-left' && { top: '10px', left: '10px' }),
              ...(watermarkPosition === 'top-right' && { top: '10px', right: '10px' }),
              ...(watermarkPosition === 'bottom-left' && { bottom: '10px', left: '10px' }),
              ...(watermarkPosition === 'bottom-right' && { bottom: '10px', right: '10px' }),
              ...(watermarkPosition === 'center' && { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }),
              pointerEvents: 'none',
              zIndex: 10
            }}>
              {watermarkLogoUrl ? (
                <img 
                  src={watermarkLogoUrl} 
                  alt="Watermark Logo" 
                  style={{ 
                    width: '125px', 
                    height: '125px', 
                    opacity: 0.8,
                    objectFit: 'contain'
                  }} 
                />
              ) : (
                <span style={{
                  color: 'rgba(102, 126, 234, 0.8)',
                  fontWeight: 'bold',
                  fontSize: '16px',
                  textShadow: '2px 2px 4px rgba(255, 255, 255, 0.9)',
                }}>
                  ReelPostly
                </span>
              )}
            </div>
          )}

          {/* UI text overlay preview */}
          {textOverlay && (
            <div style={{
              position: 'absolute',
              ...(textPosition === 'top-center' && { top: '20px', left: '50%', transform: 'translateX(-50%)' }),
              ...(textPosition === 'top-left' && { top: '20px', left: '20px' }),
              ...(textPosition === 'top-right' && { top: '20px', right: '20px' }),
              ...(textPosition === 'bottom-center' && { bottom: '20px', left: '50%', transform: 'translateX(-50%)' }),
              ...(textPosition === 'bottom-left' && { bottom: '20px', left: '20px' }),
              ...(textPosition === 'bottom-right' && { bottom: '20px', right: '20px' }),
              ...(textPosition === 'center' && { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }),
              color: textColor,
              fontWeight: 'bold',
              fontSize: `${textSize}px`,
              textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
              pointerEvents: 'none',
              zIndex: 10
            }}>
              {textOverlay}
            </div>
          )}

          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              background: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '24px',
              height: '24px',
              cursor: 'pointer',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ✕
          </button>
          {needsUserGesture && (
            <button
              onClick={playWithSound}
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                background: 'rgba(0,0,0,0.7)',
                color: '#fff',
                border: 'none',
                borderRadius: '999px',
                padding: '10px 16px',
                fontSize: '12px',
                cursor: 'pointer',
                zIndex: 20
              }}
            >
              Tap to play with sound
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
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

        {activeTab === 'watermark' && (
          <div style={{ textAlign: 'center' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#333', fontSize: '14px' }}>Logo Watermark</h4>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                <input
                  type="checkbox"
                  checked={watermarkEnabled}
                  onChange={(e) => setWatermarkEnabled(e.target.checked)}
                />
                <span style={{ fontSize: '12px' }}>Enable watermark</span>
              </label>
            </div>
            {watermarkEnabled && (
              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>Upload Logo:</label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                  onChange={handleLogoUpload}
                  style={{ 
                    fontSize: '11px',
                    padding: '4px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    width: '100%',
                    maxWidth: '200px'
                  }}
                />
                <p style={{ fontSize: '10px', color: '#666', margin: '4px 0', lineHeight: '1.3' }}>
                  Recommended: PNG/JPG/SVG, max 2MB. Logo will be displayed as 125x125 pixels square.
                </p>
                {watermarkLogoUrl && (
                  <div style={{ marginTop: '8px' }}>
                    <img 
                      src={watermarkLogoUrl} 
                      alt="Logo Preview" 
                      style={{ 
                        width: '60px', 
                        height: '30px', 
                        objectFit: 'contain',
                        border: '1px solid #ddd',
                        borderRadius: '4px'
                      }} 
                    />
                    <p style={{ fontSize: '10px', color: '#666', margin: '4px 0 0 0' }}>Logo Preview</p>
                  </div>
                )}
              </div>
            )}
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

        {/* Save */}
        <div style={{ marginTop: '15px', textAlign: 'center' }}>
          <button
            onClick={handleEnhancedSave}
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
            {isProcessing ? '⏳ Updating...' : '💾 Update Video'}
          </button>
        </div>

        {/* Hidden canvas – we draw the visible <video> onto this */}
        <div style={{ display: 'none' }}>
          <canvas ref={canvasRef} />
        </div>
      </div>
    </div>
  );
};

export default PreviewEnhancements;