const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { requireAuth } = require('@clerk/express');

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
router.post("/link-temp-user", requireAuth(), async (req, res) => {
  try {
    const { email } = req.body;
    const clerkUserId = req.auth().userId;

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

// ✅ Create or link Clerk user with database user
router.post("/create-clerk-user", requireAuth(), async (req, res) => {
  try {
    const clerkUserId = req.auth().userId;
    const userEmail = req.auth().email;
    const firstName = req.auth().firstName;
    const lastName = req.auth().lastName;

    console.log(`🔗 Creating/linking Clerk user: ${clerkUserId} (${userEmail || 'no email'})`);
    console.log('🔍 Full req.auth object:', JSON.stringify(req.auth(), null, 2));

    // 1) Check if user already exists with this Clerk ID
    let user = await User.findOne({ clerkUserId: clerkUserId });
    
    if (user) {
      console.log(`✅ User already linked: ${user.email}`);
      return res.json({
        success: true,
        message: "User already linked",
        user: {
          subscriptionStatus: user.subscriptionStatus,
          selectedPlan: user.selectedPlan,
          billingCycle: user.billingCycle,
          hasActiveSubscription: user.canCreatePosts()
        }
      });
    }

    // 2) If a user exists by email, link it
    console.log(`🔍 Looking for user with email: "${userEmail}"`);
    user = userEmail ? await User.findOne({ email: userEmail }) : null;
    
    if (user) {
      // Link existing user to Clerk
      console.log(`🔗 Linking existing user ${user.email} to Clerk user ${clerkUserId}`);
      console.log(`📝 Before linking - clerkUserId: ${user.clerkUserId}`);
      user.clerkUserId = clerkUserId;
      user.firstName = firstName;
      user.lastName = lastName;
      await user.save();
      console.log(`✅ After linking - clerkUserId: ${user.clerkUserId}`);
      
      return res.json({
        success: true,
        message: "Existing user linked to Clerk",
        user: {
          subscriptionStatus: user.subscriptionStatus,
          selectedPlan: user.selectedPlan,
          billingCycle: user.billingCycle,
          hasActiveSubscription: user.canCreatePosts()
        }
      });
    }

    // 3) If no email available from Clerk, do not create a user (avoid 500)
    if (!userEmail) {
      console.log('❌ No email present in Clerk auth; cannot create user record');
      return res.status(400).json({
        success: false,
        error: 'Email not available from Clerk. Link a temporary user first or ensure email is present.'
      });
    }

    console.log(`❌ No user found with email: "${userEmail}"`);
    // Create new user for Clerk (email present)
    console.log(`📝 Creating new user for Clerk: ${userEmail}`);
    user = new User({
      email: userEmail,
      clerkUserId: clerkUserId,
      firstName: firstName,
      lastName: lastName,
      subscriptionStatus: 'none',
      selectedPlan: 'starter',
      billingCycle: 'monthly'
    });

    await user.save();

    console.log(`✅ Created new user for Clerk: ${user.email}`);

    res.json({
      success: true,
      message: "New user created for Clerk",
      user: {
        subscriptionStatus: user.subscriptionStatus,
        selectedPlan: user.selectedPlan,
        billingCycle: user.billingCycle,
        hasActiveSubscription: user.canCreatePosts()
      }
    });

  } catch (error) {
    console.error("❌ Error creating/linking Clerk user:", error);
    res.status(500).json({ error: "Failed to create/link Clerk user" });
  }
});

// ✅ Test posting access by email (no auth required for testing)
router.post("/test-posting-access", async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const user = await User.findOne({ email: email });
    
    if (!user) {
      return res.json({
        canPost: false,
        reason: "User not found in database",
        email: email
      });
    }

    const canPost = user.canCreatePosts();
    const hasSubscription = user.hasActiveSubscription();
    const subscriptionStatus = user.subscriptionStatus;

    res.json({
      canPost: canPost,
      hasActiveSubscription: hasSubscription,
      subscriptionStatus: subscriptionStatus,
      selectedPlan: user.selectedPlan,
      billingCycle: user.billingCycle,
      email: user.email,
      reason: canPost ? "User has active subscription" : "User does not have active subscription"
    });

  } catch (error) {
    console.error("❌ Error testing posting access:", error);
    res.status(500).json({ error: "Failed to test posting access" });
  }
});

// 🧪 TEST ENDPOINTS (for testing only - remove in production)

// Test endpoint to find temporary user by email
router.post("/test-find-temp-user", async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const user = await User.findOne({ email: email });
    
    if (!user) {
      return res.json({
        found: false,
        message: "No user found with this email"
      });
    }

    res.json({
      found: true,
      user: {
        id: user._id,
        email: user.email,
        clerkUserId: user.clerkUserId,
        subscriptionStatus: user.subscriptionStatus,
        selectedPlan: user.selectedPlan,
        billingCycle: user.billingCycle,
        hasActiveSubscription: user.canCreatePosts(),
        stripeCustomerId: user.stripeCustomerId,
        stripeSubscriptionId: user.stripeSubscriptionId
      }
    });

  } catch (error) {
    console.error("❌ Error finding temporary user:", error);
    res.status(500).json({ error: "Failed to find temporary user" });
  }
});

// Test endpoint to link temporary user with mock Clerk user ID
router.post("/test-link-temp-user", async (req, res) => {
  try {
    const { email, clerkUserId } = req.body;

    if (!email || !clerkUserId) {
      return res.status(400).json({ error: "Email and clerkUserId are required" });
    }

    // Find temporary user by email
    const tempUser = await User.findOne({ 
      email: email,
      clerkUserId: { $exists: false } // Only find users without clerkUserId
    });

    if (!tempUser) {
      return res.status(404).json({ error: "No temporary user found with this email" });
    }

    // Link the temporary user to the mock Clerk user
    tempUser.clerkUserId = clerkUserId;
    await tempUser.save();

    console.log(`✅ Test: Linked temporary user ${tempUser._id} to mock Clerk user ${clerkUserId}`);

    res.json({
      success: true,
      message: "Temporary user linked successfully (test)",
      user: {
        id: tempUser._id,
        email: tempUser.email,
        clerkUserId: tempUser.clerkUserId,
        subscriptionStatus: tempUser.subscriptionStatus,
        selectedPlan: tempUser.selectedPlan,
        billingCycle: tempUser.billingCycle,
        hasActiveSubscription: tempUser.canCreatePosts()
      }
    });

  } catch (error) {
    console.error("❌ Error linking temporary user (test):", error);
    res.status(500).json({ error: "Failed to link temporary user" });
  }
});

module.exports = router;