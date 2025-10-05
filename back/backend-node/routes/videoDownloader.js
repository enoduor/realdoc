const express = require('express');
const axios = require('axios');
const router = express.Router();

const BIGVIDEOGRAB_BASE_URL = 'https://bigvideograb.com';

// Detect platform from URL
const detectPlatform = (url) => {
  if (url.includes('tiktok.com')) return 'tiktok';
  if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
  if (url.includes('facebook.com')) return 'facebook';
  if (url.includes('instagram.com')) return 'instagram';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  return null;
};

router.post('/download', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const platform = detectPlatform(url);
    if (!platform) {
      return res.status(400).json({ 
        error: 'Unsupported platform. Please use TikTok, Twitter, Facebook, Instagram, or YouTube URLs.' 
      });
    }

    // Call BigVideoGrab API
    if (platform === 'youtube') {
      // YouTube: Two-step process
      const analyzeResponse = await axios.get(`${BIGVIDEOGRAB_BASE_URL}/api/youtube/analyze?url=${encodeURIComponent(url)}`);
      const videoInfo = analyzeResponse.data;
      const formatId = videoInfo.formats[0].format_id;
      
      const downloadResponse = await axios.get(`${BIGVIDEOGRAB_BASE_URL}/api/youtube/download?url=${encodeURIComponent(url)}&format_id=${formatId}`, {
        responseType: 'stream'
      });
      
      // Set headers for video file
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Disposition', 'attachment; filename="video.mp4"');
      downloadResponse.data.pipe(res);
    } else {
      // Other platforms: Direct download
      const response = await axios.get(`${BIGVIDEOGRAB_BASE_URL}/api/${platform}?url=${encodeURIComponent(url)}`, {
        responseType: 'stream'
      });
      
      // Set headers for video file
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Disposition', 'attachment; filename="video.mp4"');
      response.data.pipe(res);
    }
    
  } catch (error) {
    console.error('Video download error:', error.message);
    res.status(500).json({ 
      error: 'BigVideoGrab API is currently unavailable. Please try again later.',
      details: error.message
    });
  }
});

module.exports = router;
