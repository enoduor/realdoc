// /back/backend-node/models/AiSearchSession.js
const mongoose = require("mongoose");

const AiSearchSessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    clerkUserId: { type: String, required: true, index: true },
    subscriptionId: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true }
  },
  {
    versionKey: false
  }
);

// TTL index for automatic expiry
AiSearchSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("AiSearchSession", AiSearchSessionSchema);
