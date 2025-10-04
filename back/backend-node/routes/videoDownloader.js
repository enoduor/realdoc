const express = require('express');
const axios = require('axios');
const router = express.Router();

router.post('/download', async (req, res) => {
  const response = await axios.post('https://bigvideograb.com/api/download', req.body);
  res.json(response.data);
});

module.exports = router;
