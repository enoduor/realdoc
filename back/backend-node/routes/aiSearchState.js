// /back/backend-node/routes/aiSearchState.js
// Route to consume AI Search state after user signup and subscription
const express = require("express");
const axios = require("axios");
const crypto = require("crypto");
const cookie = require("cookie");
const User = require("../models/User");
const AiSearchSession = require("../models/AiSearchSession");
const router = express.Router();

const SESSION_COOKIE_NAME = "ai_search_session";
const SESSION_TTL_DAYS = Number(process.env.AI_SEARCH_SESSION_TTL_DAYS || "7");

function getCookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: true,
    sameSite: "None",
    domain: isProduction ? ".reelpostly.com" : undefined,
    path: "/",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60 * 1000
  };
}

function parseCookies(req) {
  const header = req.headers?.cookie || "";
  return cookie.parse(header || "");
}

/**
 * POST /api/ai-search/consume-state
 * 
 * Consumes the state token from AI Search redirect by forwarding it to Lambda.
 * This is called after the user has successfully signed up and subscribed.
 * 
 * Body: { state, clerkUserId, subscriptionId }
 * 
 * Returns: { returnUrl } from Lambda or error
 * 
 * Note: The returnUrl should include clerkUserId as a query parameter so AI Search
 * can verify subscription without needing Clerk installed.
 * Example: https://courses.reelpostly.com/ux/advisor.html?clerkUserId=user_abc123
 */
router.post("/ai-search/consume-state", async (req, res) => {
  try {
    const { state, clerkUserId, subscriptionId } = req.body;

    // Validate required fields
    if (!state || !clerkUserId) {
      return res.status(400).json({ 
        error: "Missing required fields: state and clerkUserId are required" 
      });
    }

    // Get Lambda API Gateway URL from environment
    const lambdaApiUrl = process.env.AI_SEARCH_LAMBDA_API_URL;
    
    if (!lambdaApiUrl) {
      console.error("❌ AI_SEARCH_LAMBDA_API_URL not configured");
      return res.status(500).json({ 
        error: "AI Search integration not configured" 
      });
    }

    // Forward to Lambda /state/consume endpoint
    const lambdaEndpoint = `${lambdaApiUrl}/state/consume`;
    
    console.log("🔄 Forwarding state consumption to Lambda:", {
      endpoint: lambdaEndpoint,
      hasState: !!state,
      clerkUserId,
      hasSubscriptionId: !!subscriptionId
    });

    try {
      const response = await axios.post(
        lambdaEndpoint,
        { 
          state, 
          clerkUserId, 
          subscriptionId: subscriptionId || null 
        },
        {
          headers: { 
            "Content-Type": "application/json",
            // Add any required API Gateway headers here if needed
            // "x-api-key": process.env.AI_SEARCH_API_KEY // if using API key auth
          },
          timeout: 10000 // 10 seconds
        }
      );

      const data = response.data;
      
      console.log("✅ State consumed successfully:", {
        hasReturnUrl: !!data.returnUrl
      });

      // If Lambda doesn't include clerkUserId in returnUrl, append it
      // This ensures AI Search can verify subscription without Clerk
      let returnUrl = data.returnUrl;
      if (returnUrl && clerkUserId) {
        try {
          const url = new URL(returnUrl);
          // Only add clerkUserId if not already present
          if (!url.searchParams.has('clerkUserId')) {
            url.searchParams.set('clerkUserId', clerkUserId);
            returnUrl = url.toString();
          }
        } catch (urlError) {
          // If returnUrl is not a valid URL, append as query string
          const separator = returnUrl.includes('?') ? '&' : '?';
          returnUrl = `${returnUrl}${separator}clerkUserId=${encodeURIComponent(clerkUserId)}`;
        }
      }

      // Create persistent session for returning users (cookie-based)
      const sessionId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

      await AiSearchSession.create({
        sessionId,
        clerkUserId,
        subscriptionId: subscriptionId || null,
        expiresAt
      });

      res.cookie(SESSION_COOKIE_NAME, sessionId, getCookieOptions());

      // Return response with potentially modified returnUrl
      return res.status(200).json({
        ...data,
        returnUrl: returnUrl || data.returnUrl
      });
    } catch (axiosError) {
      // Handle axios errors
      if (axiosError.response) {
        // Lambda returned an error response
        console.error("❌ Lambda returned error:", {
          status: axiosError.response.status,
          statusText: axiosError.response.statusText,
          data: axiosError.response.data
        });
        
        return res.status(axiosError.response.status).json({ 
          error: axiosError.response.data?.error || axiosError.response.data || "Failed to consume state",
          status: axiosError.response.status
        });
      } else if (axiosError.code === 'ECONNABORTED' || axiosError.message.includes('timeout')) {
        // Timeout error
        return res.status(504).json({ 
          error: "Request to AI Search service timed out" 
        });
      } else {
        // Network or other error
        throw axiosError;
      }
    }
    
  } catch (err) {
    console.error("❌ Error consuming AI Search state:", err);
    
    // Network errors are already handled in the try block
    return res.status(500).json({ 
      error: err.message || "Failed to consume state" 
    });
  }
});

/**
 * POST /api/ai-search/acknowledge
 *
 * Persistently marks that this Clerk user has acknowledged / unlocked AI Search.
 * This is the backend "source of truth" for gating that should be tied to identity.
 *
 * Body: { clerkUserId }
 */
router.post("/ai-search/acknowledge", async (req, res) => {
  try {
    const { clerkUserId } = req.body;

    if (!clerkUserId) {
      return res.status(400).json({
        success: false,
        error: "clerkUserId is required",
      });
    }

    // Find or create user by Clerk ID
    let user = await User.findOne({ clerkUserId });
    if (!user) {
      user = new User({
        clerkUserId,
        subscriptionStatus: "none",
        selectedPlan: "none",
        billingCycle: "none",
      });
    }

    const now = new Date();
    user.aiSearchAcknowledged = true;
    user.aiSearchAcknowledgedAt = now;

    await user.save();

    return res.status(200).json({
      success: true,
      aiSearchAcknowledged: true,
      aiSearchAcknowledgedAt: user.aiSearchAcknowledgedAt,
      // Convenience: return subscription state so caller can gate UI correctly
      hasActiveSubscription: user.hasActiveSubscription(),
      subscriptionStatus: user.subscriptionStatus || "none",
      subscriptionId: user.stripeSubscriptionId || null,
      clerkUserId: user.clerkUserId,
      email: user.email || null,
    });
  } catch (err) {
    console.error("❌ Error acknowledging AI Search:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to acknowledge AI Search",
    });
  }
});

/**
 * POST /api/ai-search/create-session
 *
 * Creates an AI Search session cookie for a known Clerk user.
 * This is used when a subscribed user comes from the dashboard.
 *
 * Body: { clerkUserId }
 */
router.post("/ai-search/create-session", async (req, res) => {
  try {
    const { clerkUserId } = req.body;
    console.log("AI_SEARCH_SESSION_CREATE_START", { clerkUserId: clerkUserId || null });
    if (!clerkUserId) {
      return res.status(400).json({ error: "Missing required field: clerkUserId" });
    }

    const user = await User.findOne({ clerkUserId });
    console.log("AI_SEARCH_SESSION_CREATE_USER", {
      found: !!user,
      subscriptionStatus: user?.subscriptionStatus || null
    });
    if (!user || !user.hasActiveSubscription()) {
      return res.status(403).json({
        success: false,
        hasActiveSubscription: false
      });
    }

    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

    await AiSearchSession.create({
      sessionId,
      clerkUserId,
      subscriptionId: user.stripeSubscriptionId || null,
      expiresAt
    });

    res.cookie(SESSION_COOKIE_NAME, sessionId, getCookieOptions());
    console.log("AI_SEARCH_SESSION_CREATE_SUCCESS", {
      clerkUserId,
      sessionId
    });

    return res.status(200).json({
      success: true,
      hasActiveSubscription: true,
      clerkUserId: user.clerkUserId,
      subscriptionId: user.stripeSubscriptionId || null
    });
  } catch (err) {
    console.error("❌ Error creating AI Search session:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to create AI Search session"
    });
  }
});

/**
 * GET /api/ai-search/verify-session
 *
 * Verifies an AI Search session via HttpOnly cookie.
 * Returns subscription status if session is valid.
 */
router.get("/ai-search/verify-session", async (req, res) => {
  try {
    const cookies = parseCookies(req);
    const sessionId = cookies[SESSION_COOKIE_NAME];

    if (!sessionId) {
      console.log("AI_SEARCH_SESSION_VERIFY_NO_COOKIE");
      return res.status(200).json({
        success: true,
        hasActiveSubscription: false,
        subscriptionStatus: "none",
        subscriptionId: null
      });
    }

    const session = await AiSearchSession.findOne({ sessionId });
    if (!session) {
      console.log("AI_SEARCH_SESSION_VERIFY_NOT_FOUND", { sessionId });
      res.clearCookie(SESSION_COOKIE_NAME, getCookieOptions());
      return res.status(200).json({
        success: true,
        hasActiveSubscription: false,
        subscriptionStatus: "none",
        subscriptionId: null
      });
    }

    if (session.expiresAt && session.expiresAt.getTime() < Date.now()) {
      console.log("AI_SEARCH_SESSION_VERIFY_EXPIRED", { sessionId });
      await AiSearchSession.deleteOne({ sessionId });
      res.clearCookie(SESSION_COOKIE_NAME, getCookieOptions());
      return res.status(200).json({
        success: true,
        hasActiveSubscription: false,
        subscriptionStatus: "expired",
        subscriptionId: null
      });
    }

    const user = await User.findOne({ clerkUserId: session.clerkUserId });
    if (!user) {
      console.log("AI_SEARCH_SESSION_VERIFY_USER_MISSING", { clerkUserId: session.clerkUserId });
      return res.status(200).json({
        success: true,
        hasActiveSubscription: false,
        subscriptionStatus: "none",
        subscriptionId: null
      });
    }

    console.log("AI_SEARCH_SESSION_VERIFY_SUCCESS", {
      clerkUserId: user.clerkUserId,
      subscriptionStatus: user.subscriptionStatus
    });
    return res.status(200).json({
      success: true,
      hasActiveSubscription: user.hasActiveSubscription(),
      subscriptionStatus: user.subscriptionStatus || "none",
      subscriptionId: user.stripeSubscriptionId || session.subscriptionId || null,
      clerkUserId: user.clerkUserId,
      email: user.email || null
    });
  } catch (err) {
    console.error("❌ Error verifying AI Search session:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to verify session"
    });
  }
});

/**
 * GET /api/ai-search/verify-subscription
 * 
 * Verifies if a Clerk user has an active subscription.
 * This endpoint is called by AI Search to check subscription status.
 * 
 * Query params: { clerkUserId }
 * 
 * Returns: { hasActiveSubscription, subscriptionStatus, subscriptionId }
 */
router.get("/ai-search/verify-subscription", async (req, res) => {
  try {
    const { clerkUserId } = req.query;

    if (!clerkUserId) {
      return res.status(400).json({
        success: false,
        error: "clerkUserId is required"
      });
    }

    // Find user by Clerk ID
    const user = await User.findOne({ clerkUserId });

    if (!user) {
      return res.status(200).json({
        success: true,
        hasActiveSubscription: false,
        subscriptionStatus: "none",
        subscriptionId: null,
        message: "User not found"
      });
    }

    // Check subscription status
    const hasActiveSubscription = user.hasActiveSubscription();
    const subscriptionStatus = user.subscriptionStatus || "none";
    const subscriptionId = user.stripeSubscriptionId || null;

    return res.status(200).json({
      success: true,
      hasActiveSubscription,
      subscriptionStatus,
      subscriptionId,
      billingCycle: user.billingCycle || "none",
      aiSearchAcknowledged: !!user.aiSearchAcknowledged,
      aiSearchAcknowledgedAt: user.aiSearchAcknowledgedAt || null,
      // Include additional context for AI Search
      clerkUserId: user.clerkUserId,
      email: user.email || null
    });

  } catch (err) {
    console.error("❌ Error verifying subscription for AI Search:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to verify subscription"
    });
  }
});

module.exports = router;
