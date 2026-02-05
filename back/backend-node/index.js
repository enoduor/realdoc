/* app.js */
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");
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

// --- AI requests are handled by ALB routing /ai/* to Python backend ---
// No proxy needed - ALB handles routing in production

// --- Minimal API root + health (single definition) ---
app.get('/api', (_req, res) => res.status(200).send('ok'));
app.get('/health', (_req, res) => res.json({ status: 'ok', message: 'Node.js backend running' }));
app.get('/api/health', (_req, res) =>
  res.status(200).json({ status: 'ok', service: 'api' })
);

// Stripe webhook removed

// --- CORS / JSON ---
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    // ALB + domains
    /\.us-west-2\.elb\.amazonaws\.com$/,
    'https://realdoc.com',
    'https://www.realdoc.com',
    'https://app.reelpostly.com',
    'https://reelpostly.com',
    'https://www.reelpostly.com',
    'https://bigvideograb.com',
    'https://www.bigvideograb.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json());

// --- Rate limiter ---
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// --- Add ping route before Clerk middleware ---
app.get('/ping', (_req, res) => {
  res.status(200).json({ status: 'ok', message: 'Backend is running' });
});


// --- API routes ---
app.use("/api/seo-payment", require("./routes/seo-payment"));
app.use("/api", (_req, res) => res.send("ok"));

// --- Simple root ---
app.get("/", (_req, res) => {
  res.send("✅ Node backend is running");
});

// Temporary health route to test /api/* routing
app.get("/api/test-health", (req, res) => {
  res.json({ ok: true, message: "Node app is handling /api/* requests", timestamp: new Date().toISOString() });
});

// Auth routes removed

// Legacy route for /realdoc (redirect to root)
app.get('/realdoc', (_req, res) => {
  res.redirect('/');
});

// --- Frontend static (ONLY AFTER ALL API ROUTES) ---
const BUILD_DIR = process.env.NODE_ENV === 'production' ? '/app/frontend/build' : path.join(__dirname, '../../frontend/build');

// Frontend static
app.use('/static', express.static(path.join(BUILD_DIR, 'static')));

// React catch-all MUST be last (use app.use with * to avoid path-to-regexp error)
app.use((req, res, next) => {
  // Skip if it's an API route (should have been handled above)
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found', path: req.path });
  }
  // Serve React app for all other routes
  res.sendFile(path.join(BUILD_DIR, 'index.html'));
});

const PORT = process.env.PORT || 4001;
const HOST = process.env.HOST || "0.0.0.0";
app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on http://${HOST}:${PORT}`);
});