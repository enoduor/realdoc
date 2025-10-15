const express = require('express');
const router = express.Router();
const AWS = require('aws-sdk');

// Configure AWS S3
const s3 = new AWS.S3({
  region: process.env.AWS_REGION || 'us-west-2',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

// Proxy S3 media files to avoid CORS issues
router.get('/media/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const bucketName = 'bigvideograb-media';
    
    // Get the object from S3
    const params = {
      Bucket: bucketName,
      Key: `media/${filename}`
    };
    
    const s3Object = await s3.getObject(params).promise();
    
    // Set appropriate headers for video streaming
    res.set({
      'Content-Type': s3Object.ContentType || 'video/mp4',
      'Content-Length': s3Object.ContentLength,
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Range'
    });
    
    // Handle range requests for video streaming
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : s3Object.ContentLength - 1;
      const chunksize = (end - start) + 1;
      
      res.status(206);
      res.set({
        'Content-Range': `bytes ${start}-${end}/${s3Object.ContentLength}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize
      });
      
      res.end(s3Object.Body.slice(start, end + 1));
    } else {
      res.end(s3Object.Body);
    }
    
  } catch (error) {
    console.error('Error proxying media file:', error);
    res.status(404).json({ error: 'Media file not found' });
  }
});

module.exports = router;
