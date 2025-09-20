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

    // Find user by Clerk ID (they should already exist from create-clerk-user)
    const user = await User.findOne({ clerkUserId: clerkUserId });

    if (!user) {
      return res.status(404).json({ error: "No user found with this Clerk ID" });
    }

    // Update the user's email if it's currently a fallback email
    if (user.email.includes('@clerk.local') && email !== user.email) {
      console.log(`🔄 Updating user email from ${user.email} to ${email}`);
      
      // Check if another user already has this email
      const existingUserWithEmail = await User.findOne({ email: email });
      if (existingUserWithEmail && existingUserWithEmail._id.toString() !== user._id.toString()) {
        console.log(`⚠️ Email ${email} already exists for another user. Merging users...`);
        
        // Transfer subscription data from existing user to current user
        if (existingUserWithEmail.subscriptionStatus && existingUserWithEmail.subscriptionStatus !== 'none') {
          user.subscriptionStatus = existingUserWithEmail.subscriptionStatus;
          user.selectedPlan = existingUserWithEmail.selectedPlan;
          user.billingCycle = existingUserWithEmail.billingCycle;
          user.stripeCustomerId = existingUserWithEmail.stripeCustomerId;
          user.stripeSubscriptionId = existingUserWithEmail.stripeSubscriptionId;
          console.log(`✅ Transferred subscription data from existing user`);
        }
        
        // Transfer other important data
        if (existingUserWithEmail.firstName && !user.firstName) {
          user.firstName = existingUserWithEmail.firstName;
        }
        if (existingUserWithEmail.lastName && !user.lastName) {
          user.lastName = existingUserWithEmail.lastName;
        }
        if (existingUserWithEmail.imageUrl && !user.imageUrl) {
          user.imageUrl = existingUserWithEmail.imageUrl;
        }
        
        // Delete the existing user with the email FIRST
        await User.findByIdAndDelete(existingUserWithEmail._id);
        console.log(`🗑️ Deleted duplicate user with email ${email}`);
      }
      
      // Now safely update the email
      user.email = email;
      await user.save();
      console.log(`✅ Successfully updated user email to ${email}`);
    }

    console.log(`✅ Updated user ${user._id} email to ${user.email} for Clerk user ${clerkUserId}`);

    res.json({
      success: true,
      message: "User email updated successfully",
      user: {
        subscriptionStatus: user.subscriptionStatus,
        selectedPlan: user.selectedPlan,
        billingCycle: user.billingCycle,
        hasActiveSubscription: user.canCreatePosts()
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
    console.log('🔍 create-clerk-user route hit');
    console.log('🔍 req.auth():', req.auth());
    console.log('🔍 req.headers.authorization:', req.headers.authorization ? 'Present' : 'Missing');
    
    const clerkUserId = req.auth().userId;
    
    // Fetch complete user profile from Clerk API
    console.log('📞 Fetching user profile from Clerk API...');
    const { Clerk } = require('@clerk/clerk-sdk-node');
    const clerk = Clerk({ secretKey: process.env.CLERK_SECRET_KEY });
    
        let userEmail, firstName, lastName;
        try {
          const clerkUser = await clerk.users.getUser(clerkUserId);
          console.log('🔍 Full Clerk user object:', JSON.stringify(clerkUser, null, 2));
          
          // Get primary email address using the correct Clerk API method
          if (clerkUser.primaryEmailAddressId) {
            const emailAddress = await clerk.emailAddresses.getEmailAddress(clerkUser.primaryEmailAddressId);
            userEmail = emailAddress.emailAddress;
            console.log('📧 Primary email fetched:', userEmail);
          } else {
            // Fallback to first email address if no primary
            userEmail = clerkUser.emailAddresses?.[0]?.emailAddress;
            console.log('📧 Fallback email from emailAddresses:', userEmail);
          }
          
          firstName = clerkUser.firstName;
          lastName = clerkUser.lastName;
          console.log('✅ Clerk user profile fetched:', { userEmail, firstName, lastName });
        } catch (clerkError) {
          console.error('❌ Error fetching Clerk user profile:', clerkError);
          userEmail = firstName = lastName = undefined;
        }

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
      // Check if this user is already linked to a different Clerk user
      if (user.clerkUserId && user.clerkUserId !== clerkUserId) {
        console.log(`⚠️ User ${user.email} is already linked to different Clerk user: ${user.clerkUserId}`);
        return res.status(409).json({ 
          error: "User already linked to different account",
          message: "This email is already associated with another account"
        });
      }
      
      // Link existing user to Clerk
      console.log(`🔗 Linking existing user ${user.email} to Clerk user ${clerkUserId}`);
      console.log(`📝 Before linking - clerkUserId: ${user.clerkUserId}`);
      console.log(`📋 Current plan: ${user.selectedPlan}, status: ${user.subscriptionStatus}`);
      
      user.clerkUserId = clerkUserId;
      user.firstName = firstName;
      user.lastName = lastName;
      
      // Update subscription status based on selected plan
      // If user has selected a plan, they have paid through Stripe, so status should be 'active'
      if (['starter', 'creator', 'pro'].includes(user.selectedPlan) && user.subscriptionStatus === 'none') {
        console.log(`🔄 Updating subscription status to 'active' for paid plan: ${user.selectedPlan}`);
        user.subscriptionStatus = 'active';
      }
      
      await user.save();
      console.log(`✅ After linking - clerkUserId: ${user.clerkUserId}, status: ${user.subscriptionStatus}`);
      
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

    // 3) Create new user (with or without email)
    const emailToUse = userEmail || `${clerkUserId}@clerk.local`;
    console.log(`📝 Creating new user for Clerk: ${emailToUse}`);
    
    try {
      user = new User({
        email: emailToUse,
        clerkUserId: clerkUserId,
        firstName: firstName,
        lastName: lastName,
        subscriptionStatus: 'none',
        selectedPlan: 'none',
        billingCycle: 'none'
      });

      await user.save();
      console.log(`✅ Created new user for Clerk: ${user.email}`);
    } catch (saveError) {
      if (saveError.code === 11000) {
        // Duplicate key error - email already exists
        console.log(`⚠️ Duplicate email error when creating user. Attempting to find and link existing user...`);
        const existingUser = await User.findOne({ email: emailToUse });
        if (existingUser) {
          // Link the existing user to this Clerk user
          existingUser.clerkUserId = clerkUserId;
          existingUser.firstName = firstName;
          existingUser.lastName = lastName;
          await existingUser.save();
          user = existingUser;
          console.log(`✅ Linked existing user ${user.email} to Clerk user ${clerkUserId}`);
        } else {
          throw saveError; // Re-throw if we can't find the existing user
        }
      } else {
        throw saveError; // Re-throw other errors
      }
    }

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