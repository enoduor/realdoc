const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { requireAuth } = require('@clerk/express');


const { Clerk } = require('@clerk/clerk-sdk-node');

// ---- helpers ----
function normEmail(v) {
  return typeof v === "string" ? v.trim().toLowerCase() : null;
}

async function getClerkPrimaryEmail(clerk, clerkUserId) {
  const cUser = await clerk.users.getUser(clerkUserId);
  if (cUser?.primaryEmailAddressId) {
    const addr = await clerk.emailAddresses.getEmailAddress(cUser.primaryEmailAddressId);
    return normEmail(addr?.emailAddress || null);
  }
  const first = cUser?.emailAddresses?.[0]?.emailAddress || null;
  return normEmail(first);
}

// Normalize the shape returned to the dashboard
function toClient(userDoc) {
  if (!userDoc) return null;
  const json = userDoc.toJSON ? userDoc.toJSON() : userDoc;
  const status = json.subscriptionStatus || "none";
  const hasActive = ["active", "trialing", "past_due"].includes(status);
  return {
    id: json._id?.toString?.() || json.id,
    email: json.email || null,
    clerkUserId: json.clerkUserId || null,
    subscriptionStatus: status,
    hasActiveSubscription: hasActive,
    selectedPlan: json.selectedPlan || "none",
    billingCycle: json.billingCycle || "none",
    stripeCustomerId: json.stripeCustomerId || null,
    stripeSubscriptionId: json.stripeSubscriptionId || null,
    dailyPostsUsed: json.dailyPostsUsed ?? 0,
    accountsConnected: json.accountsConnected ?? 0,
    dailyLimitResetAt: json.dailyLimitResetAt || null,
    trialStartDate: json.trialStartDate || null,
    trialEndDate: json.trialEndDate || null,
    updatedAt: json.updatedAt || null,
    createdAt: json.createdAt || null,
  };
}

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

// ✅ Get current user profile
router.get("/me", requireAuth(), async (req, res) => {
  try {
    const clerkUserId = req.auth().userId;
    if (!clerkUserId) {
      return res.status(401).json({ error: "Unauthenticated" });
    }

    // Just find the user in the database by clerkUserId
    const user = await User.findOne({ clerkUserId });
    if (!user) {
      return res.json(null);
    }

    return res.json(toClient(user));

    // CASE A: both exist and are different docs → merge
    if (uById && uByEmail && !uById._id.equals(uByEmail._id)) {
      const session = await User.startSession();
      await session.withTransaction(async () => {
        // choose keeper = email row (stable key)
        const keeper = uByEmail;
        const discard = uById;

        // transfer fields we care about (only if missing on keeper)
        if (!keeper.clerkUserId) keeper.clerkUserId = clerkUserId;
        if (firstName && !keeper.firstName) keeper.firstName = firstName;
        if (lastName  && !keeper.lastName)  keeper.lastName  = lastName;
        keeper.lastActiveDate = new Date();

        await keeper.save({ session });

        // OPTIONAL: if you have foreign refs that point to discard._id,
        // migrate them here (Posts.updateMany({ userId: discard._id }, { userId: keeper._id }, { session }))
        // ...

        // remove discard or neutralize (removing avoids future collisions)
        await User.deleteOne({ _id: discard._id }, { session });
      });
      await session.endSession();

      user = await User.findOne({ email: email.toLowerCase() }); // now the keeper
      console.log("🔀 Merged duplicate users in /auth/me:", {
        keeperId: user._id.toString(),
        clerkUserId,
        email: user.email
      });
    }

    // CASE B: only email row exists → link clerkUserId to it
    else if (!uById && uByEmail) {
      uByEmail.clerkUserId = uByEmail.clerkUserId || clerkUserId;
      if (firstName && !uByEmail.firstName) uByEmail.firstName = firstName;
      if (lastName  && !uByEmail.lastName)  uByEmail.lastName  = lastName;
      uByEmail.lastActiveDate = new Date();
      await uByEmail.save();
      user = uByEmail;
      console.log("🔗 Linked existing user by email:", { userId: user._id.toString(), email: user.email });
    }

    // CASE C: only id row exists → set email if not taken
    else if (uById && !uByEmail) {
      // Only set email if it's not used by anyone else
      if (email) {
        const dup = await User.exists({ email: email.toLowerCase(), _id: { $ne: uById._id } });
        if (!dup) uById.email = email.toLowerCase();
      }
      if (firstName && !uById.firstName) uById.firstName = firstName;
      if (lastName  && !uById.lastName)  uById.lastName  = lastName;
      uById.lastActiveDate = new Date();
      await uById.save();
      user = uById;
      console.log("✅ Updated existing clerkUserId row:", { userId: user._id.toString(), email: user.email || "(none)" });
    }

    // CASE D: neither exists → create fresh (email optional)
    else if (!uById && !uByEmail) {
      user = new User({
        clerkUserId,
        ...(email ? { email: email.toLowerCase() } : {}),
        firstName,
        lastName,
        subscriptionStatus: "none",
        selectedPlan: "none",
        billingCycle: "none",
        lastActiveDate: new Date(),
      });
      try {
      await user.save();
        console.log("👤 Created user in /auth/me:", { id: user._id.toString(), email: user.email || "(none)" });
      } catch (saveErr) {
        // Handle parallel creations or unique index collisions
        if (saveErr && saveErr.code === 11000) {
          const isClerkIdDup =
            (saveErr.keyPattern && saveErr.keyPattern.clerkUserId) ||
            /clerkUserId/i.test(String(saveErr.errmsg || ""));
          const isEmailDup =
            (saveErr.keyPattern && saveErr.keyPattern.email) ||
            /email/i.test(String(saveErr.errmsg || ""));

          // If another request created the clerkUserId doc in parallel
          if (isClerkIdDup) {
            const existing = await User.findOne({ clerkUserId });
            if (existing) {
              // Soft-merge fields onto the existing doc
              let changed = false;
              if (email) {
                const lower = email.toLowerCase();
                if (!existing.email) {
                  // only set if not used elsewhere
                  const taken = await User.exists({ email: lower, _id: { $ne: existing._id } });
                  if (!taken) { existing.email = lower; changed = true; }
                }
              }
              if (firstName && !existing.firstName) { existing.firstName = firstName; changed = true; }
              if (lastName  && !existing.lastName)  { existing.lastName  = lastName;  changed = true; }
              existing.lastActiveDate = new Date();
              await existing.save();
              user = existing;
              console.log("🧷 Resolved race on clerkUserId by using existing doc:", {
                id: user._id.toString(), clerkUserId, email: user.email || "(none)"
              });
            } else if (email) {
              // Fallback: try linking to email row if it popped up
              const byEmail = await User.findOne({ email: email.toLowerCase() });
              if (byEmail) {
                byEmail.clerkUserId = clerkUserId;
                byEmail.lastActiveDate = new Date();
                await byEmail.save();
                user = byEmail;
                console.log("🧩 Linked to email user after clerk dup:", { id: user._id.toString() });
              } else {
                throw saveErr;
              }
            } else {
              throw saveErr;
            }
          }
          // Email duplicate (someone created the email row first)
          else if (isEmailDup && email) {
            const fallback = await User.findOne({ email: email.toLowerCase() });
            if (fallback) {
              fallback.clerkUserId = clerkUserId;
              fallback.lastActiveDate = new Date();
              await fallback.save();
              user = fallback;
              console.log("🧩 Resolved race by linking to existing email user:", { id: user._id.toString() });
            } else {
              throw saveErr;
            }
          } else {
            throw saveErr;
          }
    } else {
          throw saveErr;
        }
      }
    }

    return res.json(toClient(user));
  } catch (err) {
    console.error("GET /auth/me error:", err);
    return res.status(500).json({ error: "Failed to load profile" });
  }
});

// ✅ Subscription status for dashboard banners & limits
router.get("/subscription-status", requireAuth(), async (req, res) => {
  try {
    const clerkUserId = typeof req.auth === "function" ? req.auth()?.userId : req.auth?.userId;
    if (!clerkUserId) return res.status(401).json({ error: "Unauthenticated" });

    const user = await User.findOne({ clerkUserId });

    // If the user row is missing (should be rare), return safe defaults
    if (!user) {
      return res.json({
        clerkUserId,
        subscriptionStatus: "none",
        hasActiveSubscription: false,
        isTrialing: false,
        selectedPlan: "none",
        billingCycle: "none",
        trialStartDate: null,
        trialEndDate: null,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        dailyPostsUsed: 0,
        accountsConnected: 0,
      });
    }

    // Normalize to your client shape and add helpful flags
    const payload = toClient(user);
    payload.isTrialing = payload.subscriptionStatus === "trialing";
    payload.isActive = ["active", "trialing", "past_due"].includes(payload.subscriptionStatus);
    payload.plan = payload.selectedPlan;
    payload.trialStartDate = user.trialStartDate || null;
    payload.trialEndDate = user.trialEndDate || null;

    return res.json(payload);
  } catch (e) {
    console.error("GET /auth/subscription-status error:", e);
    return res.status(500).json({ error: "Failed to load subscription status" });
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

    // Update the user's email if it's currently missing or a known placeholder
    const isPlaceholder = !user.email || /@clerk\.local$/i.test(user.email);
    if (isPlaceholder && email !== user.email) {
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

// ✅ Idempotent create-or-link (safe under concurrency, avoids dupes)
// Prefers merging an existing email-only row, else upserts by clerkUserId.
// Never overwrites subscription fields; Stripe webhooks own those.
router.post('/create-or-link', requireAuth(), async (req, res) => {
  try {
    const authObj = typeof req.auth === 'function' ? req.auth() : req.auth;
    const clerkUserId = authObj?.userId;
    if (!clerkUserId) return res.status(401).json({ error: 'No Clerk user' });

    // Normalize inputs from client (if provided)
    const email = normEmail(req.body?.email);
    const firstName = req.body?.firstName;
    const lastName  = req.body?.lastName;
    const now = new Date();

    // 1) If a temp user exists by email (no clerkUserId yet), link that doc
    if (email) {
      const temp = await User.findOne({
        email,
        $or: [
          { clerkUserId: { $exists: false } },
          { clerkUserId: null },
          { clerkUserId: '' },
        ],
      });

      if (temp) {
        // Ensure we don't end up with two docs for same clerk user.
        const clash = await User.findOne({ clerkUserId });
        if (clash && String(clash._id) !== String(temp._id)) {
          // Keep the email row (stable key) and remove the clerk-only row.
          await User.deleteOne({ _id: clash._id });
        }

        if (!temp.clerkUserId) temp.clerkUserId = clerkUserId;
        if (firstName && !temp.firstName) temp.firstName = firstName;
        if (lastName  && !temp.lastName)  temp.lastName  = lastName;
        temp.lastActiveDate = now;
        await temp.save();
        return res.json({ ok: true, user: temp.toJSON ? temp.toJSON() : temp });
      }
    }

    // 2) Otherwise upsert by clerkUserId; set fields only if provided.
    const $setOnInsert = { clerkUserId };
    if (email)     $setOnInsert.email = email;
    if (firstName) $setOnInsert.firstName = firstName;
    if (lastName)  $setOnInsert.lastName = lastName;

    const $set = { lastActiveDate: now, updatedAt: now };

    try {
      await User.updateOne(
        { clerkUserId },
        { $setOnInsert, $set },
        { upsert: true }
      );
    } catch (err) {
      // If another request inserted the same clerkUserId concurrently, ignore and read back.
      if (err?.code !== 11000) throw err;
    }

    // 3) Read back definitive row
    let doc = await User.findOne({ clerkUserId }).lean();
    if (!doc) return res.status(500).json({ error: 'User linkage failed' });

    // 4) Optional: if doc has no email but request has one, set it if not taken
    if (!doc.email && email) {
      const taken = await User.exists({ email, _id: { $ne: doc._id } });
      if (!taken) {
        await User.updateOne({ _id: doc._id }, { $set: { email, updatedAt: now } });
        doc.email = email;
      }
    }

    return res.json({ ok: true, user: doc });
  } catch (e) {
    console.error('create-or-link error:', e);
    return res.status(500).json({ error: e.message || 'create-or-link failed' });
  }
});

// ✅ Sync user with database (no Clerk API calls)
router.post("/sync-user", requireAuth(), async (req, res) => {
  try {
    // Clerk session is already valid here:
    const clerkUserId = req.auth().userId;
    // Optional: if you fetch profile from Clerk frontend, pass it in body:
    const { email, firstName, lastName } = req.body || {};

    // Upsert Mongo user strictly by clerkUserId (NOT by email)
    const user = await User.findOneAndUpdate(
      { clerkUserId },
      {
        $setOnInsert: {
          clerkUserId,
          subscriptionStatus: "none",
          selectedPlan: "none",
          billingCycle: "none",
        },
        ...(email ? { email: String(email).trim().toLowerCase() } : {}),
        ...(firstName ? { firstName } : {}),
        ...(lastName ? { lastName } : {})
      },
      { new: true, upsert: true }
    );

    return res.json({ ok: true, userId: user._id, clerkUserId: user.clerkUserId });
  } catch (e) {
    console.error("sync-user error:", e);
    return res.status(500).json({ ok: false, error: "sync-failed" });
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

// Delete account route
router.delete('/delete-account', requireAuth(), async (req, res) => {
  try {
    const clerkUserId = req.auth().userId;
    console.log(`🗑️ [Delete Account] Starting account deletion for clerkUserId: ${clerkUserId}`);
    
    if (!clerkUserId) {
      return res.status(400).json({ error: 'User ID not found' });
    }

    // Find the user first
    const user = await User.findOne({ clerkUserId });
    if (!user) {
      console.log(`❌ [Delete Account] User not found for clerkUserId: ${clerkUserId}`);
      return res.status(404).json({ error: 'User not found' });
    }

    console.log(`👤 [Delete Account] Found user: ${user.email || 'No email'}`);

    // Delete all associated tokens using the user's deleteAllTokens method
    await user.deleteAllTokens();
    console.log(`✅ [Delete Account] Token cleanup completed for user: ${clerkUserId}`);

    // Delete the user
    const userDeletion = await User.deleteOne({ clerkUserId });
    console.log(`✅ [Delete Account] User deletion result: ${userDeletion.deletedCount} user(s) deleted`);

    if (userDeletion.deletedCount === 0) {
      console.error(`❌ [Delete Account] No user was deleted for clerkUserId: ${clerkUserId}`);
      return res.status(500).json({ error: 'Failed to delete user account' });
    }

    console.log(`🎉 [Delete Account] Account deletion completed successfully for clerkUserId: ${clerkUserId}`);
    res.json({ success: true, message: 'Account deleted successfully' });

  } catch (error) {
    console.error('❌ [Delete Account] Error deleting account:', {
      error: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

module.exports = router;