// Exercises the DB-dependent auth logic against a real MongoDB.
import assert from "node:assert/strict";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

const mongod = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongod.getUri("reviewhub_test");
console.log("mongo up:", process.env.MONGODB_URI);

const B = "file:///c:/Users/AMIT/OneDrive/Desktop/reviewhub-website/src/";
const { default: dbConnect } = await import(B + "lib/db.js");
const { issueOtp, verifyOtp } = await import(B + "lib/auth/otp.js");
const { issueToken, consumeToken } = await import(B + "lib/auth/tokens.js");
const { default: Otp } = await import(B + "models/Otp.js");
const { default: User } = await import(B + "models/User.js");
const { default: VerificationToken } = await import(B + "models/VerificationToken.js");

await dbConnect();

let pass = 0;
const ta = async (name, fn) => {
  try { await fn(); console.log("  ok  " + name); pass++; }
  catch (e) { console.log("  FAIL " + name + "\n       " + (e.stack?.split("\n").slice(0,3).join("\n       ") ?? e.message)); process.exitCode = 1; }
};

console.log("\n[1] OTP is stored HASHED, never in plaintext");
await ta("raw 6-digit code is not in the document", async () => {
  const r = await issueOtp("hash@test.in", "signup");
  assert.ok(r.ok);
  const doc = await Otp.findOne({ email: "hash@test.in" }).lean();
  const blob = JSON.stringify(doc);
  assert.ok(!blob.includes(r.code), `raw code ${r.code} leaked into the DB document!`);
  assert.equal(doc.codeHash.length, 64, "expected sha256 hex");
});

console.log("\n[2] OTP happy path");
await ta("correct code verifies once", async () => {
  const r = await issueOtp("ok@test.in", "signup");
  assert.equal((await verifyOtp("ok@test.in", r.code, "signup")).ok, true);
});
await ta("★ same code CANNOT be replayed", async () => {
  const r = await issueOtp("replay@test.in", "signup");
  assert.equal((await verifyOtp("replay@test.in", r.code, "signup")).ok, true);
  const second = await verifyOtp("replay@test.in", r.code, "signup");
  assert.equal(second.ok, false, "a consumed OTP was accepted a second time!");
});

console.log("\n[3] ★ Brute force: 6 digits must not be walkable");
await ta("locks out after 5 wrong attempts", async () => {
  const email = "brute@test.in";
  const r = await issueOtp(email, "signup");
  const wrong = r.code === "000000" ? "111111" : "000000";
  const results = [];
  for (let i = 0; i < 6; i++) results.push(await verifyOtp(email, wrong, "signup"));
  assert.deepEqual(results.map((x) => x.reason), ["invalid","invalid","invalid","invalid","too_many_attempts","invalid"],
    "attempt ladder wrong: " + JSON.stringify(results.map(x=>x.reason)));
});
await ta("★ CORRECT code rejected after lockout", async () => {
  const email = "brute2@test.in";
  const r = await issueOtp(email, "signup");
  const wrong = r.code === "000000" ? "111111" : "000000";
  for (let i = 0; i < 5; i++) await verifyOtp(email, wrong, "signup");
  const now = await verifyOtp(email, r.code, "signup");
  assert.equal(now.ok, false, "correct code still worked after 5 failures — lockout is not enforced!");
});

console.log("\n[4] Resend cooldown");
await ta("second issue within 60s is refused", async () => {
  await issueOtp("cool@test.in", "signup");
  const second = await issueOtp("cool@test.in", "signup");
  assert.equal(second.ok, false);
  assert.equal(second.reason, "cooldown");
  assert.ok(second.retryAfter > 0 && second.retryAfter <= 60);
});

console.log("\n[5] Reissuing invalidates the previous code");
await ta("old code dead after a new one is issued", async () => {
  const email = "reissue@test.in";
  const first = await issueOtp(email, "signup");
  // Bypass the cooldown by ageing the doc, the way 60s of real time would.
  await Otp.updateMany({ email }, { $set: { createdAt: new Date(Date.now() - 120000) } });
  const second = await issueOtp(email, "signup");
  assert.ok(second.ok, "reissue blocked: " + JSON.stringify(second));
  assert.equal((await verifyOtp(email, first.code, "signup")).ok, false, "superseded code still works!");
  assert.equal((await verifyOtp(email, second.code, "signup")).ok, true, "newest code should work");
});

console.log("\n[6] Expiry");
await ta("expired code is rejected", async () => {
  const email = "exp@test.in";
  const r = await issueOtp(email, "signup");
  await Otp.updateMany({ email }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  assert.equal((await verifyOtp(email, r.code, "signup")).ok, false);
});

console.log("\n[7] OTP purpose is scoped");
await ta("signup code cannot be used for login", async () => {
  const r = await issueOtp("scope@test.in", "signup");
  assert.equal((await verifyOtp("scope@test.in", r.code, "login")).ok, false);
});

console.log("\n[8] Reset tokens hashed + single-use");
await ta("raw token not stored", async () => {
  const tok = await issueToken("tok@test.in", "password_reset");
  const doc = await VerificationToken.findOne({ identifier: "tok@test.in" }).lean();
  assert.ok(!JSON.stringify(doc).includes(tok), "raw reset token leaked into the DB!");
});
await ta("★ token consumable exactly once", async () => {
  const tok = await issueToken("once@test.in", "password_reset");
  assert.deepEqual(await consumeToken(tok, "password_reset"), { identifier: "once@test.in" });
  assert.equal(await consumeToken(tok, "password_reset"), null, "reset token was reusable!");
});
await ta("token purpose scoped", async () => {
  const tok = await issueToken("purpose@test.in", "password_reset");
  assert.equal(await consumeToken(tok, "email_verify"), null);
});
await ta("expired token rejected", async () => {
  const tok = await issueToken("expired@test.in", "password_reset");
  await VerificationToken.updateMany({ identifier: "expired@test.in" }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  assert.equal(await consumeToken(tok, "password_reset"), null);
});
await ta("issuing a new token kills the old one", async () => {
  const first = await issueToken("rot@test.in", "password_reset");
  await issueToken("rot@test.in", "password_reset");
  assert.equal(await consumeToken(first, "password_reset"), null, "superseded reset link still worked!");
});

console.log("\n[9] User model protects secrets");
await ta("passwordHash/totpSecret are select:false", async () => {
  await User.create({ email: "sel@test.in", role: "reviewer", passwordHash: "SECRET_HASH", totpSecret: "SECRET_TOTP", status: "active" });
  const u = await User.findOne({ email: "sel@test.in" }).lean();
  const blob = JSON.stringify(u);
  assert.ok(!blob.includes("SECRET_HASH"), "passwordHash leaked on a plain find()!");
  assert.ok(!blob.includes("SECRET_TOTP"), "totpSecret leaked on a plain find()!");
});
await ta("role enum rejects an invented role", async () => {
  await assert.rejects(() => User.create({ email: "bad@test.in", role: "superadmin" }));
});
await ta("email is unique", async () => {
  await User.create({ email: "dupe@test.in", role: "reviewer" });
  await assert.rejects(() => User.create({ email: "dupe@test.in", role: "admin" }), (e) => e.code === 11000);
});

console.log(`\n${pass} checks passed.`);
await mongoose.disconnect();
await mongod.stop();
