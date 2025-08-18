const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");
const stripeWebhook = require("./webhooks/stripeWebhook");
const authRoutes = require("./routes/auth");
const publisherRoutes = require("./routes/publisher");
const { ClerkExpressRequireAuth, ClerkExpressWithAuth } = require('@clerk/clerk-sdk-node');

dotenv.config();

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

// Rate limiting for production security
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
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

// Clerk authentication middleware (optional - only for protected routes)
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

// Mount Google Auth routes
const googleAuthRoutes = require('./routes/googleAuth');
app.use(googleAuthRoutes);

// Mount Twitter Auth routes
const twitterAuthRoutes = require('./routes/twitterAuth');
app.use(twitterAuthRoutes);

// Mount LinkedIn Auth routes
const linkedinAuthRoutes = require('./routes/linkedinAuth');
app.use(linkedinAuthRoutes);

// Mount auth routes
app.use("/api/auth", authRoutes);

// Mount Stripe routes
const stripeRoutes = require("./routes/stripe");
app.use("/api/stripe", stripeRoutes);

// Mount publisher routes (Clerk auth is applied in the routes file)
app.use("/api/publisher", publisherRoutes);

// Simple test route
app.get("/", (req, res) => {
    res.send("✅ Node backend is running");
});

// Protected route to test Clerk auth
app.get('/auth-test', ClerkExpressRequireAuth(), (req, res) => {
  res.json({ ok: true, userId: req.auth.userId });
});

// Protected route example using Clerk
app.get("/api/auth/profile", ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const users = mongoose.connection.collection('users');
        const user = await users.findOne(
            { _id: new mongoose.Types.ObjectId(req.auth.userId) },
            { projection: { password: 0 } } // Exclude password
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
app.get('/api/_debug/auth', ClerkExpressRequireAuth(), (req, res) => {
  res.json({
    status: req.headers['x-clerk-auth-status'] || null,
    reason: req.headers['x-clerk-auth-reason'] || null,
    auth: req.auth ?? null,          // shows userId if validated
  });
});

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});