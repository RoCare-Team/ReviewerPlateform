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
  };
}

export function inr(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}
