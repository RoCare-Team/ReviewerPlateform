import crypto from "node:crypto";
import User from "../models/User";
import WalletTransaction from "../models/WalletTransaction";
import { getSettings } from "./settings";
import { isAppPlatform, APP_PLATFORMS } from "./clientPlatform";
import { getAppVersionConfig } from "./appVersion";

/**
 * Referral program — every reviewer/business_owner gets a shareable code the
 * moment their account is created. Anyone who signs up through that code
 * (link with `?ref=CODE`, or typed in manually on the name step — see
 * PhoneOtpForm.jsx) gets tagged with `referredBy`, and the referrer is
 * credited AppSettings.referralReward (₹25 by default) straight into their
 * wallet, once, right there at signup.
 *
 * ★ The bonus is only paid once the referred person is actually ON THE APP.
 * A signup from the website tags `referredBy` and shows up in the referrer's
 * history as PENDING, but pays nothing. The moment that same account is used
 * from the native app — signing up there, or installing later and logging in
 * — markAppInstall() releases the pending bonus. So the reward tracks app
 * installs (which is the point of the program) without punishing a referrer
 * whose friend happened to open the website first.
 *
 * Beyond the install, nothing further is required of the new user: no first
 * review, no campaign. Phone-OTP on a real number plus an install is the bar.
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
 * Has this referred user done enough to earn their referrer the bonus?
 * Exactly one condition: the account exists on the app — either it was
 * created there, or it has since been used from there.
 */
/**
 * Mongo filter for "this account has reached the app" — the query-side twin
 * of referralBonusEarned() below. Kept next to it so the two can't drift.
 */
export const ON_APP = {
  $or: [{ appInstalledAt: { $ne: null } }, { signupSource: { $in: APP_PLATFORMS } }],
};

export function referralBonusEarned(user) {
  return Boolean(user?.appInstalledAt) || isAppPlatform(user?.signupSource);
}

/**
 * Credits the referrer's wallet for a referred user who has reached the app.
 * Idempotent via `referralBonusPaid` on the NEW user's own document — even
 * if this were called twice for the same signup, the second call is a no-op.
 *
 * Called from two places, both of which may legitimately be a no-op:
 * completePhoneSignup() (paid immediately when the signup came from the app)
 * and markAppInstall() (pays a pending bonus when a web signup installs the
 * app later).
 */
export async function payReferralBonus(newUser) {
  if (!newUser.referredBy || newUser.referralBonusPaid) return;
  // The whole point of the program — no install, no payout. Stays pending
  // rather than being refused outright, so it can still be earned later.
  if (!referralBonusEarned(newUser)) return;

  const claimed = await User.findOneAndUpdate(
    { _id: newUser._id, referralBonusPaid: false },
    { $set: { referralBonusPaid: true, referralBonusPaidAt: new Date() } }
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
    note: `Referral bonus — ${newUser.name || "a new user"} installed the app using your code`,
    balanceAfter: referrer.walletBalance,
  });
}

/**
 * Records that this account has been seen on the native app, and releases any
 * referral bonus that was waiting on exactly that.
 *
 * Called on every app-originated login/signup. The `appInstalledAt` write is
 * a one-time stamp (`$exists`-guarded, so it keeps the FIRST install date and
 * doesn't creep forward on every login), but the payout attempt runs each
 * time — payReferralBonus() is idempotent, and re-trying it means a bonus is
 * never permanently lost to a write that failed halfway the first time.
 *
 * Safe to call for any user, referred or not; it simply does nothing extra.
 */
export async function markAppInstall(userId, platform) {
  if (!isAppPlatform(platform)) return;

  const SELECT = "referredBy referralBonusPaid appInstalledAt signupSource name";

  // First sighting: stamp the install date and pay in one go. The filter is
  // what keeps `appInstalledAt` the FIRST install rather than creeping
  // forward on every login.
  const justMarked = await User.findOneAndUpdate(
    { _id: userId, appInstalledAt: null },
    { $set: { appInstalledAt: new Date(), appPlatform: platform } },
    { returnDocument: "after" }
  ).select(SELECT);
  if (justMarked) {
    await payReferralBonus(justMarked);
    return;
  }

  // Already marked. Only worth another look if a bonus is still outstanding —
  // a payout that failed halfway last time heals itself on the next app
  // request instead of being lost. A point-read by _id that returns null for
  // everyone who has already been paid.
  const stillOwed = await User.findOne({
    _id: userId,
    referredBy: { $ne: null },
    referralBonusPaid: false,
  }).select(SELECT);
  if (stillOwed) await payReferralBonus(stillOwed);
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
 * `referralLink` is built server-side rather than by the client so nothing
 * has to hardcode the store URL or the deployment's own domain — a link
 * shared from the app and one shared from the browser are identical, and
 * changing the store listing is an admin edit, not a release.
 */
export async function getReferralSummary(userId, existingCode, { signupPath = "/login" } = {}) {
  const [referralCode, referredCount, installedCount, paidCount, settings, appVersion] = await Promise.all([
    ensureReferralCode(userId, existingCode),
    User.countDocuments({ referredBy: userId }),
    // On the app — signed up there, or installed later. This is what
    // "pending" is measured against.
    User.countDocuments({ referredBy: userId, ...ON_APP }),
    // Actually credited. Not the same number as installedCount: accounts
    // referred BEFORE the install rule existed were paid without ever
    // reaching the app, and a just-installed one is paid a beat later.
    User.countDocuments({ referredBy: userId, referralBonusPaid: true }),
    getSettings(),
    getAppVersionConfig(),
  ]);

  const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");

  return {
    referralCode,
    referredCount,
    installedCount,
    paidCount,
    pendingCount: Math.max(0, referredCount - installedCount),
    referralReward: settings.referralReward,
    // What actually gets shared. The reward is earned on an app INSTALL, so
    // the link has to land on the store, not the web signup form — sharing
    // the old web link was inviting people down the one path that pays
    // nothing. The store URL is the admin-managed one from /admin/app-version.
    referralLink: buildReferralLink(appVersion.android.storeUrl, referralCode, appUrl, signupPath),
    // Kept separate so the invite card can still offer the website as a
    // fallback ("no Android? sign up here") without it being the main button.
    webSignupLink: referralCode ? `${appUrl}${signupPath}?ref=${referralCode}` : "",
    playStoreUrl: appVersion.android.storeUrl,
  };
}

/**
 * Play Store link carrying the referral code in `referrer` — the parameter
 * Google hands back to the app through the Play Install Referrer API, so a
 * fresh install can pre-fill the code with nothing typed. The code is still
 * shown separately for manual entry, which is what makes this work on iOS and
 * for anyone who installs some other way.
 *
 * Falls back to the web signup link when no store URL is configured yet — a
 * broken share link would be worse than one that pays nothing.
 */
function buildReferralLink(storeUrl, referralCode, appUrl, signupPath) {
  if (!referralCode) return "";
  if (!storeUrl) return `${appUrl}${signupPath}?ref=${referralCode}`;
  const joiner = storeUrl.includes("?") ? "&" : "?";
  return `${storeUrl}${joiner}referrer=${encodeURIComponent(`ref=${referralCode}`)}`;
}

/**
 * "Who did I bring in, and did it pay?" — the referrer's own history list.
 *
 * Names are shown (the referrer invited these people), phone numbers are NOT:
 * a referral code is shareable by anyone, so this list must never become a way
 * to harvest the numbers of people who used it. Only the last 4 digits go out,
 * enough to recognise who it is.
 */
export async function getReferralHistory(userId, { limit = 50 } = {}) {
  const [rows, settings] = await Promise.all([
    User.find({ referredBy: userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select("name phone createdAt signupSource appInstalledAt referralBonusPaid referralBonusPaidAt")
      .lean(),
    getSettings(),
  ]);

  return rows.map((u) => ({
    name: u.name || "New user",
    phoneLast4: String(u.phone || "").slice(-4),
    joinedAt: u.createdAt,
    // "android" / "ios" / "web" — where they created the account.
    signupSource: u.signupSource || "web",
    installedApp: Boolean(u.appInstalledAt) || isAppPlatform(u.signupSource),
    installedAt: u.appInstalledAt ?? null,
    bonusPaid: Boolean(u.referralBonusPaid),
    bonusPaidAt: u.referralBonusPaidAt ?? null,
    // The amount that WAS paid isn't stored per-user (WalletTransaction has
    // it), so a pending row quotes today's rate — which is what it would pay
    // if the install happened now.
    reward: settings.referralReward,
  }));
}
