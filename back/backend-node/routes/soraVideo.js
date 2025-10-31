const express = require("express");
const router = express.Router();
const { requireAuth } = require('@clerk/express');
const User = require("../models/User");
const axios = require('axios');

const PYTHON_API_BASE_URL = process.env.PYTHON_API_BASE_URL || 'http://localhost:5001';

/**
 * Protected endpoint for Sora video generation
 * 1. Requires authentication (Clerk)
 * 2. Checks user has credits
 * 3. Deducts credits
 * 4. Proxies request to Python backend
 */
router.post("/generate-video-simple", requireAuth(), async (req, res) => {
  try {
    const clerkUserId = req.auth().userId;
    
    if (!clerkUserId) {
      return res.status(401).json({ error: "Unauthenticated" });
    }

    // Find user in database
    let user = await User.findOne({ clerkUserId });
    
    // Auto-create user if not found (with default values)
    if (!user) {
      const { Clerk } = require('@clerk/clerk-sdk-node');
      const clerk = new Clerk({ secretKey: process.env.CLERK_SECRET_KEY });
      
      let email = null;
      let firstName = null;
      let lastName = null;
      
      try {
        const clerkUser = await clerk.users.getUser(clerkUserId);
        email = clerkUser.emailAddresses?.[0]?.emailAddress || null;
        firstName = clerkUser.firstName || null;
        lastName = clerkUser.lastName || null;
      } catch (clerkError) {
        console.error('Error fetching user from Clerk:', clerkError);
      }
      
      user = new User({
        clerkUserId,
        email,
        firstName,
        lastName,
        soraVideoCredits: 0,
        subscriptionStatus: 'none',
        selectedPlan: 'none',
        billingCycle: 'none'
      });
      await user.save();
      console.log(`✅ Auto-created user for ${clerkUserId}`);
    }

    // Check if user has credits
    const currentCredits = user.soraVideoCredits || 0;
    const creditsNeeded = 1;
    
    if (currentCredits < creditsNeeded) {
      return res.status(402).json({ 
        error: "Insufficient credits",
        detail: `You need ${creditsNeeded} credit(s) to generate a video. You have ${currentCredits} credit(s).`,
        currentCredits,
        requiredCredits: creditsNeeded
      });
    }

    // Deduct credits BEFORE generating video
    user.soraVideoCredits = currentCredits - creditsNeeded;
    await user.save();
    
    console.log(`🎬 [Sora Video] Deducted ${creditsNeeded} credit(s) for user ${clerkUserId}. Remaining: ${user.soraVideoCredits}`);

    try {
      // Forward request to Python backend
      const pythonResponse = await axios.post(
        `${PYTHON_API_BASE_URL}/api/v1/video/generate-video-simple`,
        req.body,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 60000 // 60 second timeout
        }
      );

      // Return Python backend response
      res.json({
        ...pythonResponse.data,
        creditsDeducted: creditsNeeded,
        remainingCredits: user.soraVideoCredits
      });

    } catch (pythonError) {
      // If Python backend fails, refund the credits
      user.soraVideoCredits = currentCredits;
      await user.save();
      console.log(`💸 [Sora Video] Refunded ${creditsNeeded} credit(s) for user ${clerkUserId} due to generation failure`);
      
      if (pythonError.response) {
        // Python backend returned an error response
        return res.status(pythonError.response.status).json({
          error: pythonError.response.data?.detail || 'Video generation failed',
          ...pythonError.response.data
        });
      } else {
        // Network or other error
        return res.status(500).json({
          error: 'Failed to generate video',
          detail: pythonError.message
        });
      }
    }

  } catch (error) {
    console.error("❌ Error in Sora video generation:", error);
    res.status(500).json({ error: "Failed to process video generation request" });
  }
});

module.exports = router;

