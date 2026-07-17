/**
 * Seed or rotate an admin account. Run on a trusted machine:
 *
 *   node --env-file=.env.local scripts/seed-admin.js admin@yourdomain.in
 *
 * ★ THIS IS THE ONLY WAY AN ADMIN IS CREATED. /api/auth/signup cannot produce one
 *   under any input — roles.json marks admin signup:"closed" and the signup
 *   endpoints don't read a role from the body at all.
 *
 * Prints a one-time password and a TOTP enrolment URI. Both are shown once and
 * never stored in plaintext. Scan the URI with an authenticator app immediately.
 */
import crypto from "node:crypto";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { generateSecret, generateURI } from "otplib";

const email = process.argv[2]?.toLowerCase();

if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error("Usage: node --env-file=.env.local scripts/seed-admin.js <email>");
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

// 24 random bytes → base64url. Long enough that it doesn't need to be memorable;
// it should be changed after first sign-in anyway.
const password = crypto.randomBytes(24).toString("base64url");
const passwordHash = await bcrypt.hash(password, 12);
const totpSecret = generateSecret();
const uri = generateURI({ strategy: "totp", issuer: "ReviewHub", label: email, secret: totpSecret });

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
      totpSecret,
      totpEnabled: true,
      role: "admin",
      status: "active",
      emailVerified: new Date(),
    },
  },
  { upsert: true, new: true }
);

console.log(`
${existing ? "Rotated" : "Created"} admin: ${email}

  Password (shown once):  ${password}
  TOTP enrolment URI:     ${uri}

Next:
  1. Add the TOTP URI to your authenticator app now — it is not stored in plaintext
     and cannot be shown again. Re-run this script to rotate if you lose it.
  2. Sign in at /admin/login with the password AND the 6-digit code.
  3. Admin sessions last 8 hours. There is no self-service password reset for admin
     by design — rotate with this script.
`);

await mongoose.disconnect();
