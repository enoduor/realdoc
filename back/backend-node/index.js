const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const stripeWebhook = require("./webhooks/stripeWebhook");
const authRoutes = require("./routes/auth");
const schedulerRoutes = require("./routes/scheduler");
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
app.use(cors());
app.use(express.json());

// Mount auth routes
app.use("/api/auth", authRoutes);

// Mount scheduler routes (Clerk auth is applied in the routes file)
app.use("/api/scheduler", schedulerRoutes);

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