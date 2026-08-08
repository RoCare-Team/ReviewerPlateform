import dbConnect from "../db";
import User from "../../models/User";
import { sendSmsOtp, verifySmsOtp } from "../smsOtp";
import { issueToken, consumeToken } from "./tokens";
import { rateLimit, clientIp } from "../rate-limit";
import { canSelfSignup } from "./roles";

/**
 * Phone+OTP login/signup for reviewer & business_owner — these two roles no
 * longer use email/password or Google at all (see data/roles.json), phone is
 * their entire identity. Admin is untouched (still email/password + TOTP,
 * src/lib/auth/providers/credentials.js).
 *
 * ★ Name is asked for AFTER OTP verification, never before — and only when
 * the phone genuinely has no account yet. The flow is:
 *   1. requestPhoneOtp(phone)               — send the code, no name involved.
 *   2. verifyPhoneOtp({phone, otp, ...})     — check the code with the gateway,
 *      then look the phone up:
 *        - already has an account (right role) → session-ready immediately,
 *          straight to the dashboard, no name prompt.
 *        - registered under the OTHER role (signup intent only) → rejected,
 *          same cross-role signal the email flow uses.
 *        - no account at all (signup intent only) → `status: "new"`, with a
 *          short-lived `phone_verified` token proving the code was already
 *          checked, so the follow-up name step doesn't need the OTP again.
 *   3. completePhoneSignup({phone, name, role, verifiedToken}) — only for the
 *      "new" case: redeems that token and actually creates the account.
 *
 * Unlike the email-OTP flow (lib/auth/otp.js), the OTP itself is generated
 * and checked by the external SMS gateway (lib/smsOtp.js) — we never see or
 * store the code ourselves.
 */

const PHONE_RE = /^\d{10}$/;

export function isValidPhone(phone) {
  return typeof phone === "string" && PHONE_RE.test(phone);
}

/**
 * Step 1: send the OTP.
 *
 * `intent: "signup"` (with `role`) checks for a cross-role account BEFORE
 * sending anything — a number already registered as a business shouldn't
 * burn an OTP (and the reviewer's patience) on a reviewer signup that's
 * going to be rejected anyway once verified. Plain login sends unconditionally
 * (no role to check against, and login doesn't reveal whether a phone is
 * registered — the cross-role check IS a real business-vs-reviewer signal,
 * only surfaced here on signup where the caller already declared an intent).
 */
export async function requestPhoneOtp(phone, { intent, role } = {}, request) {
  const ip = clientIp(request);
  const byIp = rateLimit(`phone-otp:send:ip:${ip}`, { limit: 10, windowMs: 60 * 60 * 1000 });
  if (!byIp.ok) return { ok: false, message: "Too many requests. Try again later." };

  const byPhone = rateLimit(`phone-otp:send:phone:${phone}`, { limit: 5, windowMs: 60 * 60 * 1000 });
  if (!byPhone.ok) return { ok: false, message: "Too many requests for this number. Try again later." };

  if (intent === "signup" && role) {
    await dbConnect();
    const existing = await User.findOne({ phone, role: { $ne: "admin" } }).select("role");
    if (existing && existing.role !== role) {
      return {
        ok: false,
        code: "CROSS_ROLE",
        role: existing.role,
        message: `This number is already registered as a ${existing.role === "business_owner" ? "business" : "reviewer"} account.`,
      };
    }
  }

  return sendSmsOtp(phone);
}

/**
 * Step 2: check the code, then decide what's next.
 *
 * `intent: "login"` (role-agnostic, used by /login):
 *   - found  → { ok: true, status: "existing", otpToken }
 *   - not found → { ok: false, code: "NOT_FOUND" }
 *
 * `intent: "signup"` (requires `role`, fixed by the calling route — never the
 * body, same discipline as lib/auth/signup.js):
 *   - found, same role  → { ok: true, status: "existing", otpToken } (treated
 *     as a login — re-running signup on a number you already used is a
 *     reasonable way back in)
 *   - found, other role → { ok: false, code: "CROSS_ROLE", role }
 *   - not found         → { ok: true, status: "new", verifiedToken } — no
 *     account created yet; see completePhoneSignup().
 */
export async function verifyPhoneOtp({ phone, otp, intent, role }, request) {
  if (intent === "signup" && !canSelfSignup(role)) {
    return { ok: false, message: "Signup isn't available for this account type." };
  }

  const ip = clientIp(request);
  const byIp = rateLimit(`phone-otp:verify:ip:${ip}`, { limit: 20, windowMs: 15 * 60 * 1000 });
  if (!byIp.ok) return { ok: false, message: "Too many attempts. Try again later." };

  const gw = await verifySmsOtp(phone, otp);
  if (!gw.ok) return { ok: false, message: gw.message || "That code isn't valid." };

  await dbConnect();
  const user = await User.findOne({ phone, role: { $ne: "admin" } });

  if (user) {
    if (intent === "signup" && user.role !== role) {
      return {
        ok: false,
        code: "CROSS_ROLE",
        role: user.role,
        message: `This number is already registered as a ${user.role === "business_owner" ? "business" : "reviewer"} account.`,
      };
    }
    if (user.status === "suspended") {
      return { ok: false, message: "This account has been suspended." };
    }

    await User.updateOne(
      { _id: user._id },
      { $set: { phoneVerified: new Date(), status: "active", lastLoginAt: new Date() } }
    );

    const otpToken = await issueToken(phone, "phone_login");
    return { ok: true, status: "existing", otpToken };
  }

  if (intent !== "signup") {
    return { ok: false, message: "No account found with this number. Sign up first.", code: "NOT_FOUND" };
  }

  // Genuinely new phone — the code has been checked, but there's no account
  // to attach it to yet. Hand back a short-lived token proving verification
  // already happened, so the name step below doesn't re-ask for the OTP.
  const verifiedToken = await issueToken(phone, "phone_verified");
  return { ok: true, status: "new", verifiedToken };
}

/**
 * Step 3 (new accounts only): redeem the `phone_verified` token and actually
 * create the account. `role` comes from the calling route
 * (POST /api/auth/signup/{business,reviewer}/complete), never the body.
 */
export async function completePhoneSignup({ phone, name, role, verifiedToken }) {
  if (!canSelfSignup(role)) return { ok: false, message: "Signup isn't available for this account type." };

  const redeemed = await consumeToken(verifiedToken, "phone_verified");
  if (!redeemed || redeemed.identifier !== phone) {
    return { ok: false, message: "Verification expired. Please start over." };
  }

  await dbConnect();

  // Re-check: someone could have raced this same phone through signup between
  // verify and here. Treat it the same as the "existing" branch above rather
  // than erroring on the unique index.
  const existing = await User.findOne({ phone });
  if (existing) {
    if (existing.role !== role) {
      return {
        ok: false,
        code: "CROSS_ROLE",
        role: existing.role,
        message: `This number is already registered as a ${existing.role === "business_owner" ? "business" : "reviewer"} account.`,
      };
    }
    await User.updateOne(
      { _id: existing._id },
      { $set: { phoneVerified: new Date(), status: "active", lastLoginAt: new Date() } }
    );
    const otpToken = await issueToken(phone, "phone_login");
    return { ok: true, otpToken };
  }

  await User.create({
    name,
    phone,
    role,
    phoneVerified: new Date(),
    status: "active",
    passwordHash: null,
  });

  const otpToken = await issueToken(phone, "phone_login");
  return { ok: true, otpToken };
}
