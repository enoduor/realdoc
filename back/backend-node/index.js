const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require('jsonwebtoken');
const stripeWebhook = require("./webhooks/stripeWebhook");

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

// Simple test route
app.get("/", (req, res) => {
    res.send("✅ Node backend is running");
});

// Registration route with database save and more logging
app.post("/api/auth/register", async (req, res) => {
    try {
        console.log("📝 Attempting to save user:", req.body.email);
        
        // Hash password before saving
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(req.body.password, salt);
        
        const users = mongoose.connection.collection('users');
        const result = await users.insertOne({
            email: req.body.email,
            password: hashedPassword,  // Save hashed password
            createdAt: new Date()
        });
        
        console.log("✅ User saved to database with ID:", result.insertedId);
        res.json({ 
            success: true, 
            id: result.insertedId,
            message: "User created successfully"
        });
    } catch (error) {
        console.error("❌ Error saving user:", error);
        res.status(500).json({ error: error.message });
    }
});

// Add login route
app.post("/api/auth/login", async (req, res) => {
    try {
        console.log("🔑 Login attempt for:", req.body.email);
        
        const users = mongoose.connection.collection('users');
        const user = await users.findOne({ email: req.body.email });

        if (!user) {
            console.log("❌ User not found:", req.body.email);
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const validPassword = await bcrypt.compare(req.body.password, user.password);
        if (!validPassword) {
            console.log("❌ Invalid password for:", req.body.email);
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const token = jwt.sign(
            { userId: user._id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        console.log("✅ Login successful for:", req.body.email);
        res.json({ 
            success: true, 
            message: "Login successful",
            token: token,
            userId: user._id
        });

    } catch (error) {
        console.error("❌ Login error:", error);
        res.status(500).json({ error: error.message });
    }
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