/* app.js */
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");
const { createProxyMiddleware } = require('http-proxy-middleware');
const stripeWebhook = require("./webhooks/stripeWebhook");
const { requireAuth, clerkMiddleware } = require('@clerk/express');
const path = require('path');

// Only load .env in development
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ override: true });
}

// Enable logs for CloudWatch debugging
// Note: Logs are enabled for production debugging - disable when stable
if (process.env.NODE_ENV === 'production' && process.env.ENABLE_LOGS !== 'true') {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalInfo = console.info;
  const originalDebug = console.debug;
  
  // Suppress logs immediately in production
  console.log = () => {};
  console.debug = () => {};
  console.info = () => {};
  console.warn = () => {};
  // Keep console.error for critical issues
}

console.log("📡 Attempting MongoDB connection...");
console.log("🔍 Environment check:");
console.log("- NODE_ENV:", process.env.NODE_ENV);
console.log("- CLERK_SECRET_KEY:", process.env.CLERK_SECRET_KEY ? "Set" : "Not set");
console.log("- CLERK_PUBLISHABLE_KEY:", process.env.CLERK_PUBLISHABLE_KEY ? "Set" : "Not set");
console.log("- CLERK_ISSUER_URL:", process.env.CLERK_ISSUER_URL || "Not set");

// Make MongoDB connection optional for local development
const isDevelopment = process.env.NODE_ENV !== 'production';
const MONGODB_URI = process.env.MONGODB_URI;

if (MONGODB_URI) {
  mongoose.connect(MONGODB_URI)
    .then(() => {
      console.log("✅ MongoDB Connected");
      console.log("📊 Database:", mongoose.connection.db.databaseName);
    })
    .catch(err => {
      if (isDevelopment) {
        console.warn("⚠️  MongoDB connection failed (continuing without DB):", err.message);
        console.warn("⚠️  Some features requiring MongoDB will not work, but the app will continue running.");
      } else {
        console.error("❌ MongoDB Error:", err);
        process.exit(1);
      }
    });
} else {
  if (isDevelopment) {
    console.warn("⚠️  MONGODB_URI not set - running without MongoDB");
    console.warn("⚠️  Some features requiring MongoDB will not work, but the app will continue running.");
  } else {
    console.error("❌ MONGODB_URI is required in production");
    process.exit(1);
  }
}

const app = express();

// --- NEW: trust proxy for ALB ---
app.set('trust proxy', 1);

// --- Path-prefix stripping removed (running on root domain) ---

// --- Proxy AI requests to Python backend ---
app.use('/ai', createProxyMiddleware({
  target: 'http://localhost:5001',
  changeOrigin: true,
  pathRewrite: {
    '^/ai': '', // remove /ai prefix when forwarding to Python backend
  },
  onError: (err, req, res) => {
    console.error('AI Proxy Error:', err.message);
    res.status(500).json({ error: 'AI service unavailable' });
  }
}));

// --- Minimal API root + health (single definition) ---
app.get('/api', (_req, res) => res.status(200).send('ok'));
app.get('/api/health', (_req, res) =>
  res.status(200).json({ status: 'ok', service: 'api' })
);

// --- Stripe webhook MUST be before express.json and should not be rate-limited ---
app.use("/webhook", stripeWebhook);

// --- CORS / JSON ---
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    // ALB + domains
    /\.us-west-2\.elb\.amazonaws\.com$/,
    'https://realdoc.com',
    'https://www.realdoc.com',
    'https://bigvideograb.com',
    'https://www.bigvideograb.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json());

// --- Static file serving for frontend ---
const BUILD_DIR = process.env.NODE_ENV === 'production' ? '/app/frontend/build' : path.join(__dirname, '../../frontend/build');

// Serve static files (CSS, JS, assets) - only for files with extensions
app.use('/static', express.static(path.join(BUILD_DIR, 'static')));
app.use('/asset-manifest.json', express.static(path.join(BUILD_DIR, 'asset-manifest.json')));
app.use('/manifest.json', express.static(path.join(BUILD_DIR, 'manifest.json')));
app.use('/favicon.ico', express.static(path.join(BUILD_DIR, 'favicon.ico')));

// --- Rate limiter (skip webhook to avoid Stripe signature/body issues) ---
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path.startsWith('/webhook'),
});
app.use(limiter);

// --- Add ping route before Clerk middleware ---
app.get('/ping', (_req, res) => {
  res.status(200).json({ status: 'ok', message: 'Backend is running' });
});

// --- Clerk middleware globally (required for requireAuth) ---
app.use(clerkMiddleware());

// --- Public-route skip (your routes can enforce their own auth) ---
app.use((req, res, next) => {
  if (
    req.path === '/' ||
    req.path === '/ping' ||
    req.path.startsWith('/webhook') ||
    req.path.startsWith('/oauth') ||
    req.path.startsWith('/api/health') ||
    req.path.startsWith('/api/stripe/webhook') ||
    req.path.startsWith('/api/auth/oauth') // OAuth callbacks are public
  ) {
    return next();
  }
  // Allow all other routes to pass through (they can enforce their own auth)
  next();
});

// --- Auth and billing routes ---
app.use("/api/auth", require("./routes/auth"));
app.use("/api/stripe", require("./routes/stripe"));
app.use("/api/billing", require("./routes/billing"));

// --- Simple root ---
app.get("/", (_req, res) => {
  res.send("✅ Node backend is running");
});

// Temporary health route to test /api/* routing
app.get("/api/test-health", (req, res) => {
  res.json({ ok: true, message: "Node app is handling /api/* requests", timestamp: new Date().toISOString() });
});

// --- Protected examples ---
app.get('/auth-test', requireAuth(), (req, res) => {
  res.json({ ok: true, userId: req.auth().userId });
});

app.get("/api/auth/profile", requireAuth(), async (req, res) => {
  try {
    const users = mongoose.connection.collection('users');
    const user = await users.findOne(
      { clerkUserId: req.auth().userId },
      { projection: { password: 0 } }
    );
    res.json({ success: true, profile: user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/_debug/auth', requireAuth(), (req, res) => {
  res.json({
    status: req.headers['x-clerk-auth-status'] || null,
    reason: req.headers['x-clerk-auth-reason'] || null,
    auth: (typeof req.auth === 'function') ? req.auth() : req.auth ?? null,
  });
});

// --- Simple user verification (public) ---
app.get('/api/user/verify/:userId', async (req, res) => {
  try {
    const users = mongoose.connection.collection('users');
    const user = await users.findOne({ clerkUserId: req.params.userId });
    if (!user) return res.json({ verified: false, message: 'User not found in database' });
    res.json({
      verified: true,
      userId: req.params.userId,
      email: user.email,
      subscriptionStatus: user.subscriptionStatus || 'none'
    });
  } catch (error) {
    console.error('Error verifying user:', error);
    res.status(500).json({ verified: false, error: error.message });
  }
});

// Legacy route for /realdoc (redirect to root)
app.get('/realdoc', (_req, res) => {
  res.redirect('/');
});

const PORT = process.env.PORT || 4001;
const HOST = process.env.HOST || "0.0.0.0";
app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on http://${HOST}:${PORT}`);
});