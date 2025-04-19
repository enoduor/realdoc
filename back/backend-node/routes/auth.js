const express = require("express");
const router = express.Router();

router.post("/register", async (req, res) => {
  try {
    // Just echo back what we received
    console.log("Received registration request:", req.body);
    
    res.json({ 
      message: "Request received",
      data: req.body
    });

  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;