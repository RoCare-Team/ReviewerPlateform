import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    // Admin-only now — reviewer/business_owner sign in by phone (below).
    // Not `default: ""`: `sparse` only skips docs where the field is
    // missing/null, so an empty-string default would still collide on the
    // unique index the moment a second phone-only user was created.
    email: {
      type: String,
      required: function () {
        return this.role === "admin";
      },
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    emailVerified: { type: Date, default: null },

    // null for OAuth-only and phone-only users. select:false so it never
    // leaks through a careless User.find() that gets serialised to JSON.
    passwordHash: { type: String, default: null, select: false },

    name: { type: String, trim: true },
    image: { type: String },

    // Login identity for reviewer/business_owner (phone+OTP — see
    // src/lib/auth/phoneAuth.js). Admin has no phone. Same sparse-unique
    // reasoning as email above — no default, so admins don't collide on "".
    // Deliberately NOT user-editable once set (see api/{reviewer,business}
    // /profile — changing your login number needs re-verification, not a
    // plain profile PATCH).
    phone: { type: String, trim: true, unique: true, sparse: true, index: true },
    phoneVerified: { type: Date, default: null },

    // Optional self-service profile field (editable by the user).
    bio: { type: String, trim: true, default: "" },

    // Reviewer-only: the city they declared, mandatory at signup (see
    // PhoneOtpForm.jsx + api/auth/signup/reviewer/complete), editable later
    // from the profile page (components/reviewer/LocationCard.jsx) via
    // api/reviewer/location. A manual pick from lib/data/indiaStatesCities.js
    // — never browser geolocation. Never set for business_owner/admin.
    // Campaigns are matched to reviewers by this field (Campaign.city, see
    // reviewer/campaigns/page.jsx).
    location: {
      city: { type: String, trim: true, default: "", index: true },
      updatedAt: { type: Date, default: null },
    },

    // Wallet balance in whole rupees. Mutated only server-side via the wallet
    // API — never from a client payload directly.
    walletBalance: { type: Number, default: 0, min: 0 },

    // Reviewer payout bank details — saved once, reusable or editable on every
    // withdrawal request. Snapshotted onto each WithdrawalRequest too, so
    // editing these later never rewrites where a past payout was already sent.
    bankAccountHolder: { type: String, trim: true, default: "" },
    bankAccountNumber: { type: String, trim: true, default: "" },
    bankIfsc: { type: String, trim: true, uppercase: true, default: "" },

    // Denormalised from Role.key — no join on every request.
    // NEVER set from a client payload. Derive server-side from the route.
    role: {
      type: String,
      enum: ["reviewer", "business_owner", "admin"],
      required: true,
      index: true,
    },

    // pending → active once OTP verified (or immediately for Google/admin seed)
    status: {
      type: String,
      enum: ["pending", "active", "suspended"],
      default: "pending",
      index: true,
    },

    // admin only — see note at the bottom
    totpSecret: { type: String, default: null, select: false },
    totpEnabled: { type: Boolean, default: false },

    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model("User", UserSchema);