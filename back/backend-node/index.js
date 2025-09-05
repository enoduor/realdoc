const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");
const stripeWebhook = require("./webhooks/stripeWebhook");
const authRoutes = require("./routes/auth");
const publisherRoutes = require("./routes/publisher");
const { requireAuth, clerkMiddleware } = require('@clerk/express');

dotenv.config({ override: true });

console.log("📡 Attempting MongoDB connection...");

// Add MongoDB connection with more logging
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("✅ MongoDB Connected");
    console.log("📊 Database:", mongoose.connection.db.databaseName);
  })
  .catch(err => {
    console.error("❌ MongoDB Error:", err);
    process.exit(1);
  });

const app = express();

// Allow running behind ALB path prefix like /repostly by stripping the prefix
app.use((req, res, next) => {
  if (req.url.startsWith('/repostly')) {
    req.url = req.url.slice('/repostly'.length) || '/';
  }
  next();
});

app.get('/api', (_req, res) => {
  res.status(200).send('ok');
});

app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'api' });
});

// Rate limiting for production security
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // limit each IP to 500 requests per windowMs (increased for development)
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all routes
app.use(limiter);

// Important: Stripe webhook route must come BEFORE express.json middleware
app.use("/webhook", stripeWebhook);

// Regular middleware
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json());

// Apply Clerk middleware globally (required for requireAuth to work)
app.use(clerkMiddleware());

// Custom middleware to skip auth for public routes
app.use((req, res, next) => {
  console.log(`🔍 Clerk middleware checking path: ${req.path}`);
  
  // Skip auth for public routes only
  if (req.path === '/' || 
      req.path === '/ping' || 
      req.path.startsWith('/webhook') ||
      req.path.startsWith('/oauth2/')) {
    console.log(`✅ Skipping Clerk auth for path: ${req.path}`);
    return next();
  }
  
  // Let individual routes handle their own auth
  next();
});

// Mount OAuth routes with consistent naming pattern: /api/auth/[platform]
const youtubeAuthRoutes = require('./routes/googleAuth'); // rename file if you want
const twitterAuthRoutes = require('./routes/twitterAuth');
const linkedinAuthRoutes = require('./routes/linkedinAuth');
const facebookAuthRoutes = require('./routes/facebookAuth');
const instagramAuthRoutes = require('./routes/instagramAuth');
const tiktokAuthRoutes = require('./routes/tiktokAuth');

// Standardized OAuth route mountings
app.use('/api/auth/youtube', youtubeAuthRoutes);    // YouTube OAuth (uses Google)
app.use('/api/auth/twitter', twitterAuthRoutes);    // Twitter OAuth
app.use('/api/auth/linkedin', linkedinAuthRoutes);  // LinkedIn OAuth
app.use('/api/auth/facebook', facebookAuthRoutes);  // Facebook OAuth
app.use('/api/auth/instagram', instagramAuthRoutes); // Instagram OAuth
app.use('/api/auth/tiktok', tiktokAuthRoutes); // TikTok OAuth

// Mount auth routes
app.use("/api/auth", authRoutes);

// Mount Stripe routes
const stripeRoutes = require("./routes/stripe");
app.use("/api/stripe", stripeRoutes);

// Mount publisher routes (Clerk auth is applied in the routes file)
app.use('/api/publisher', require('./routes/publisher'));

// Simple test route
app.get("/", (req, res) => {
    res.send("✅ Node backend is running");
});
/** Minimal API root + health so ALB tests pass */
app.get('/api', (_req, res) => res.status(200).send('ok'));
app.get('/api/health', (_req, res) =>
  res.status(200).json({ status: 'ok', service: 'api' })
);

// Protected route to test Clerk auth
app.get('/auth-test', requireAuth(), (req, res) => {
  res.json({ ok: true, userId: req.auth().userId });
});

// Protected route example using Clerk
app.get("/api/auth/profile", requireAuth(), async (req, res) => {
    try {
        const users = mongoose.connection.collection('users');
        const user = await users.findOne(
            { clerkUserId: req.auth().userId },
            { projection: { password: 0 } }
        );
        
        res.json({ 
            success: true,
            profile: user
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Debug route to check Clerk auth status
app.get('/api/_debug/auth', requireAuth(), (req, res) => {
  res.json({
    status: req.headers['x-clerk-auth-status'] || null,
    reason: req.headers['x-clerk-auth-reason'] || null,
    auth: (typeof req.auth === 'function') ? req.auth() : req.auth ?? null,          // shows userId if validated
  });
});

// Simple user verification check (no auth required)
app.get('/api/user/verify/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Check if user exists in database
    const users = mongoose.connection.collection('users');
    const user = await users.findOne({ clerkUserId: userId });
    
    if (!user) {
      return res.json({
        verified: false,
        message: 'User not found in database'
      });
    }
    
    res.json({
      verified: true,
      userId: userId,
      email: user.email,
      subscriptionStatus: user.subscriptionStatus || 'none'
    });
  } catch (error) {
    console.error('Error verifying user:', error);
    res.status(500).json({
      verified: false,
      error: error.message
    });
  }
});


const PORT = process.env.PORT || 4001;
const HOST = process.env.HOST || "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on http://${HOST}:${PORT}`);
});