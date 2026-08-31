import dbConnect from "./db";
import AppSettings from "../models/AppSettings";

/**
 * The ONE place platform pricing is read. Every price (business review rate,
 * reviewer reward) comes from here so admin can change it in a single place and
 * the whole app follows. Falls back to schema defaults if the singleton doesn't
 * exist yet (first run).
 */
export const PRICING_DEFAULTS = {
  reviewRate: 100,
  reviewerReward: 50,
  minWithdrawal: 50,
  minTopup: 50,
  referralReward: 25,
  currency: "INR",
  reviewerCooldownHours: 4,
  // See models/AppSettings.js — manual until RazorpayX is activated.
  payoutMode: "manual",
};

export async function getSettings() {
  await dbConnect();
  const doc = await AppSettings.findOneAndUpdate(
    { key: "global" },
    { $setOnInsert: { key: "global" } },
    { returnDocument: "after", upsert: true, setDefaultsOnInsert: true }
  ).lean();
  return {
    reviewRate: doc?.reviewRate ?? PRICING_DEFAULTS.reviewRate,
    reviewerReward: doc?.reviewerReward ?? PRICING_DEFAULTS.reviewerReward,
    minWithdrawal: doc?.minWithdrawal ?? PRICING_DEFAULTS.minWithdrawal,
    minTopup: doc?.minTopup ?? PRICING_DEFAULTS.minTopup,
    referralReward: doc?.referralReward ?? PRICING_DEFAULTS.referralReward,
    currency: doc?.currency ?? PRICING_DEFAULTS.currency,
    // Not a price — the platform-wide gap a reviewer must leave between
    // submissions. Lives here because this is the one settings singleton the
    // whole app (and the mobile client, via /api/settings) already reads.
    // `?? ` on purpose, not `||`: 0 is a valid value meaning "no cooldown".
    reviewerCooldownHours: doc?.reviewerCooldownHours ?? PRICING_DEFAULTS.reviewerCooldownHours,
    // "manual" | "razorpayx" — how an approved withdrawal is actually paid.
    payoutMode: doc?.payoutMode ?? PRICING_DEFAULTS.payoutMode,
  };
}

export async function updateSettings(patch) {
  await dbConnect();
  const doc = await AppSettings.findOneAndUpdate(
    { key: "global" },
    { $set: patch },
    { returnDocument: "after", upsert: true, setDefaultsOnInsert: true }
  ).lean();
  return {
    reviewRate: doc.reviewRate,
    reviewerReward: doc.reviewerReward,
    minWithdrawal: doc.minWithdrawal,
    minTopup: doc.minTopup,
    referralReward: doc.referralReward,
    currency: doc.currency,
    reviewerCooldownHours: doc.reviewerCooldownHours ?? PRICING_DEFAULTS.reviewerCooldownHours,
    payoutMode: doc.payoutMode ?? PRICING_DEFAULTS.payoutMode,
  };
}

/**
 * "4 hours" / "45 minutes" / "1 hour 30 minutes" — how long is left before a
 * blocked reviewer may submit again, in words they can act on. Rounds up to
 * the next whole minute so a countdown never reads "0 minutes" while still
 * being blocked.
 */
export function formatWait(ms) {
  const totalMinutes = Math.max(1, Math.ceil(Number(ms || 0) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const parts = [];
  if (hours) parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
  if (minutes) parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`);
  return parts.join(" ");
}

export function inr(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}
