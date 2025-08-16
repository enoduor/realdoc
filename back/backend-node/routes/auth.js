const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { clerkAuthMiddleware } = require("../middleware/clerkAuth");

// Register route
router.post("/register", async (req, res) => {
  try {
    console.log("📝 Attempting to register user:", req.body.email);
    
    // Check if user already exists
    let user = await User.findOne({ email: req.body.email });
    if (user) {
      return res.status(400).json({ error: "User already exists" });
    }

    // Create new user with bcrypt (not bcryptjs)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(req.body.password, salt);
    
    user = new User({
      email: req.body.email,
      password: hashedPassword
    });

    await user.save();

    console.log("✅ User registered successfully:", user.email);
    res.json({
      success: true,
      id: user._id,
      message: "User created successfully"
    });
  } catch (error) {
    console.error("❌ Registration error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Login route
router.post("/login", async (req, res) => {
  try {
    console.log("🔑 Login attempt for:", req.body.email);
    
    // Find user
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      console.log("❌ User not found:", req.body.email);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Check password using bcrypt (not bcryptjs)
    const validPassword = await bcrypt.compare(req.body.password, user.password);
    if (!validPassword) {
      console.log("❌ Invalid password for:", req.body.email);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Create token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    console.log("✅ Login successful for:", user.email);
    res.json({
      success: true,
      token,
      userId: user._id,
      email: user.email
    });
  } catch (error) {
    console.error("❌ Login error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ Link temporary user with Clerk user
router.post("/link-temp-user", clerkAuthMiddleware, async (req, res) => {
  try {
    const { email } = req.body;
    const clerkUserId = req.user.userId;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Find temporary user by email
    const tempUser = await User.findOne({ 
      email: email,
      clerkUserId: { $exists: false } // Only find users without clerkUserId
    });

    if (!tempUser) {
      return res.status(404).json({ error: "No temporary user found with this email" });
    }

    // Link the temporary user to the Clerk user
    tempUser.clerkUserId = clerkUserId;
    await tempUser.save();

    console.log(`✅ Linked temporary user ${tempUser._id} to Clerk user ${clerkUserId}`);

    res.json({
      success: true,
      message: "Temporary user linked successfully",
      user: {
        subscriptionStatus: tempUser.subscriptionStatus,
        selectedPlan: tempUser.selectedPlan,
        billingCycle: tempUser.billingCycle,
        hasActiveSubscription: tempUser.canCreatePosts()
      }
    });

  } catch (error) {
    console.error("❌ Error linking temporary user:", error);
    res.status(500).json({ error: "Failed to link temporary user" });
  }
});

module.exports = router;