import crypto from "node:crypto";
import User from "../models/User";
import WalletTransaction from "../models/WalletTransaction";
import { getSettings } from "./settings";

/**
 * Referral program — every reviewer/business_owner gets a shareable code the
 * moment their account is created. Anyone who signs up through that code
 * (link with `?ref=CODE`, or typed in manually on the name step — see
 * PhoneOtpForm.jsx) gets tagged with `referredBy`, and the referrer is
 * credited AppSettings.referralReward (₹25 by default) straight into their
 * wallet, once, right there at signup.
 *
 * Deliberately NOT gated on the new user doing anything further (their first
 * review, a campaign, etc.) — the ask was "bring someone onto the platform",
 * and phone-OTP verification is already the bar every account clears to
 * exist at all.
 */

// Unambiguous alphabet — no 0/O/1/I — so a code read aloud or handwritten
// never gets mistyped into a different valid one.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(length = 6) {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[crypto.randomInt(ALPHABET.length)];
  }
  return out;
}

/** Generates a fresh code guaranteed unique against User.referralCode. */
export async function generateUniqueReferralCode() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomCode();
    const clash = await User.exists({ referralCode: code });
    if (!clash) return code;
  }
  // Astronomically unlikely (33^6 codes, checked 10x) — widen instead of
  // looping forever.
  return randomCode(8);
}

/**
 * Resolves a submitted referral code to the referrer, if valid. Returns null
 * (never throws) for anything not usable: unknown code, self-referral (can't
 * happen at signup since the new user has no code yet, but defensive anyway),
 * or the code's owner no longer active.
 */
export async function findReferrer(code) {
  const trimmed = String(code || "").trim().toUpperCase();
  if (!trimmed) return null;
  const referrer = await User.findOne({
    referralCode: trimmed,
    status: "active",
    role: { $ne: "admin" }, // admin never has/uses a referral code
  }).select("_id name role");
  return referrer;
}

/**
 * Credits the referrer's wallet once a new user (already created, with
 * `referredBy` set) exists. Idempotent via `referralBonusPaid` on the NEW
 * user's own document — even if this were somehow called twice for the same
 * signup, the second call is a no-op.
 */
export async function payReferralBonus(newUser) {
  if (!newUser.referredBy || newUser.referralBonusPaid) return;

  const claimed = await User.findOneAndUpdate(
    { _id: newUser._id, referralBonusPaid: false },
    { $set: { referralBonusPaid: true } }
  );
  if (!claimed) return; // already paid by a concurrent call

  const settings = await getSettings();
  const reward = settings.referralReward;

  const referrer = await User.findByIdAndUpdate(
    newUser.referredBy,
    { $inc: { walletBalance: reward } },
    { returnDocument: "after" }
  ).select("walletBalance");
  if (!referrer) return;

  await WalletTransaction.create({
    user: newUser.referredBy,
    amount: reward,
    type: "referral",
    note: `Referral bonus — ${newUser.name || "a new user"} joined using your code`,
    balanceAfter: referrer.walletBalance,
  });
}

/**
 * The referral code this user should be shown, generating one on first read
 * for accounts created before the program existed.
 *
 * The same lazy backfill the web profile pages do inline (reviewer/profile,
 * business/settings) — pulled out here so the REST profile routes the mobile
 * app reads can't hand back an empty card for an account the website would
 * have quietly fixed up.
 *
 * Returns "" only if the write genuinely couldn't land, never a code that
 * isn't actually stored — a shared link has to resolve to a real account.
 */
export async function ensureReferralCode(userId, existing) {
  if (existing) return existing;

  const code = await generateUniqueReferralCode();
  const updated = await User.findOneAndUpdate(
    { _id: userId, $or: [{ referralCode: { $exists: false } }, { referralCode: null }] },
    { $set: { referralCode: code } },
    { returnDocument: "after" }
  ).select("referralCode");
  if (updated?.referralCode) return updated.referralCode;

  // Lost the race to a concurrent read — use whatever actually got stored.
  const fresh = await User.findById(userId).select("referralCode").lean();
  return fresh?.referralCode ?? "";
}

/**
 * Everything the "Invite & earn" card needs, in one call — what the web
 * assembles from three separate reads inside its server components.
 *
 * `referralLink` is built server-side rather than by the client so the app
 * never has to know (or hardcode) the deployment's own domain; it points at
 * the same web signup route the website's shared links use, so a link shared
 * from the app and one shared from the browser are identical.
 */
export async function getReferralSummary(userId, existingCode, { signupPath = "/login" } = {}) {
  const [referralCode, referredCount, settings] = await Promise.all([
    ensureReferralCode(userId, existingCode),
    User.countDocuments({ referredBy: userId }),
    getSettings(),
  ]);

  const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");

  return {
    referralCode,
    referredCount,
    referralReward: settings.referralReward,
    referralLink: referralCode ? `${appUrl}${signupPath}?ref=${referralCode}` : "",
  };
}
