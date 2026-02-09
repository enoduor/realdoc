// /back/backend-node/models/User.js
const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    // Identity
    clerkUserId: {
      type: String,
      index: true,
      sparse: true,
      unique: true, // each Clerk user maps to exactly one record
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      index: true, // NOT unique (users can change email or pay with different email)
    },
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },

    // Stripe linkage
    stripeCustomerId: {
      type: String,
      index: true,
      sparse: true,
      unique: true, // one Stripe customer per user
      trim: true,
    },
    stripeSubscriptionId: {
      type: String,
      index: true,
      sparse: true,
      trim: true,
    },

    // Subscription / plan state
    subscriptionStatus: {
      type: String,
      enum: [
        "none",
        "trialing",
        "active",
        "past_due",
        "unpaid",
        "canceled",
        "incomplete",
        "incomplete_expired",
        "paused",
        "unknown",
      ],
      default: "none",
      index: true,
    },
    selectedPlan: {
      type: String,
      enum: ["starter", "creator", "enterprise", "none", "unknown"],
      default: "none",
      index: true,
    },
    billingCycle: {
      type: String,
      enum: ["monthly", "yearly", "none", "unknown"],
      default: "none",
      index: true,
    },

    // Trial dates (from Stripe) — store as Date for easy comparisons
    trialStartDate: { type: Date },
    trialEndDate: { type: Date },

    // Derived field for convenience in dashboards
    trialDaysRemaining: { type: Number, default: 0, min: 0 },

    // Activity tracking
    lastActiveDate: { type: Date, default: null },

    // AI Search acknowledgement (persisted server-side, tied to identity)
    aiSearchAcknowledged: {
      type: Boolean,
      default: false,
      index: true,
    },
    aiSearchAcknowledgedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // adds createdAt, updatedAt
    versionKey: false,
  }
);

/**
 * Indexes
 * - Unique+sparse on clerkUserId and stripeCustomerId prevent duplicate identities.
 * - Additional indexes speed up dashboards/admin queries.
 */
UserSchema.index({ subscriptionStatus: 1, selectedPlan: 1 });
UserSchema.index({ lastActiveDate: -1 });
UserSchema.index({ createdAt: -1 });

/**
 * Helper: full name (safe)
 */
UserSchema.virtual("fullName").get(function () {
  const f = this.firstName || "";
  const l = this.lastName || "";
  return `${f} ${l}`.trim();
});

/**
 * Helper: isTrialActive
 */
UserSchema.methods.isTrialActive = function () {
  if (!this.trialEndDate) return false;
  return new Date() <= this.trialEndDate;
};

/**
 * Helper: hasActiveSubscription
 * Check if user has an active subscription (including trial)
 */
UserSchema.methods.hasActiveSubscription = function () {
  return this.subscriptionStatus === 'active' || 
         this.subscriptionStatus === 'trialing' || 
         this.isTrialActive();
};

/**
/**
 * Helper: calculateTrialDaysRemaining
 * Calculate remaining trial days
 */
UserSchema.methods.calculateTrialDaysRemaining = function() {
  if (!this.trialEndDate) return 0;
  const now = new Date();
  const diffTime = this.trialEndDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
};

/**
 * Helper: syncTrialDaysRemaining
 * Updates the stored numeric field from current dates.
 */
UserSchema.methods.syncTrialDaysRemaining = function () {
  this.trialDaysRemaining = this.calculateTrialDaysRemaining();
};

/**
 * Keep trialDaysRemaining in sync on save
 */
UserSchema.pre('save', function (next) {
  try {
    this.syncTrialDaysRemaining();
  } catch (e) {
    // non-fatal
  }
  next();
});

module.exports = mongoose.model("User", UserSchema);