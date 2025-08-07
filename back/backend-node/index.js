const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require('jsonwebtoken');
const stripeWebhook = require("./webhooks/stripeWebhook");
const authRoutes = require("./routes/auth");
const schedulerRoutes = require("./routes/scheduler");

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

// Mount scheduler routes
app.use("/api/scheduler", schedulerRoutes);

// Simple test route
app.get("/", (req, res) => {
    res.send("✅ Node backend is running");
});

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: "No token provided" });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: "Invalid token" });
        }
        req.user = user;
        next();
    });
};

// Protected route example
app.get("/api/auth/profile", authenticateToken, async (req, res) => {
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