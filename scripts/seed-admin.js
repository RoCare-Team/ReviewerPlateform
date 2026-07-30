/**
 * Seed or rotate an admin account. Run on a trusted machine:
 *
 *   node --env-file=.env.local scripts/seed-admin.js admin@yourdomain.in
 *   node --env-file=.env.local scripts/seed-admin.js admin@yourdomain.in "YourPassword123"
 *
 * If you pass a password it is used as-is; otherwise a strong random one is
 * generated and printed once. Admin logs in with EMAIL + PASSWORD only — TOTP
 * two-factor was removed by request (see data/roles.json admin.totp:false).
 *
 * ★ THIS IS THE ONLY WAY AN ADMIN IS CREATED. /api/auth/signup cannot produce one
 *   under any input — roles.json marks admin signup:"closed" and the signup
 *   endpoints don't read a role from the body at all.
 */
import crypto from "node:crypto";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const email = process.argv[2]?.toLowerCase();
const providedPassword = process.argv[3];

if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error("Usage: node --env-file=.env.local scripts/seed-admin.js <email> [password]");
  process.exit(1);
}

if (providedPassword && providedPassword.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

const { MONGODB_URI } = process.env;
if (!MONGODB_URI) {
  console.error("MONGODB_URI is not set. Is .env.local present?");
  process.exit(1);
}

// Import the real model so the schema (and its enums) stay the single source.
const { default: User } = await import("../src/models/User.js");

await mongoose.connect(MONGODB_URI);

// Use the given password, or a 24-byte random one (base64url) shown once.
const password = providedPassword ?? crypto.randomBytes(24).toString("base64url");
const passwordHash = await bcrypt.hash(password, 12);

const existing = await User.findOne({ email });

if (existing && existing.role !== "admin") {
  console.error(
    `Refusing: ${email} already exists with role "${existing.role}".\n` +
      `Promoting a live user account to admin via this script is not supported — ` +
      `it would silently hand admin to whoever already controls that mailbox.`
  );
  await mongoose.disconnect();
  process.exit(1);
}

await User.findOneAndUpdate(
  { email },
  {
    $set: {
      email,
      name: existing?.name ?? "Administrator",
      passwordHash,
      // TOTP disabled — email + password only.
      totpEnabled: false,
      role: "admin",
      status: "active",
      emailVerified: new Date(),
    },
    $unset: { totpSecret: "" },
  },
  { upsert: true, new: true }
);

console.log(`
${existing ? "Rotated" : "Created"} admin: ${email}

  Password:  ${password}

Sign in at /admin/login with the email and password above. No 2FA code required.
`);

await mongoose.disconnect();
