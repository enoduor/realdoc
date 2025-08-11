const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const stripeWebhook = require("./webhooks/stripeWebhook");
const authRoutes = require("./routes/auth");
const publisherRoutes = require("./routes/publisher");
const { clerkAuthMiddleware } = require("./middleware/clerkAuth");

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

// Mount Google Auth routes
const googleAuthRoutes = require('./routes/googleAuth');
app.use(googleAuthRoutes);

// Mount Twitter Auth routes
const twitterAuthRoutes = require('./routes/twitterAuth');
app.use(twitterAuthRoutes);

// Mount auth routes
app.use("/api/auth", authRoutes);

// Mount publisher routes (Clerk auth is applied in the routes file)
app.use("/api/publisher", publisherRoutes);

// Simple test route
app.get("/", (req, res) => {
    res.send("✅ Node backend is running");
});

// Protected route example using Clerk
app.get("/api/auth/profile", clerkAuthMiddleware, async (req, res) => {
    try {
        const users = mongoose.connection.collection('users');
        const user = await users.findOne(
            { _id: new mongoose.Types.ObjectId(req.user.userId) },
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

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});