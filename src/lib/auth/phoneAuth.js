import dbConnect from "../db";
import User from "../../models/User";
import { sendSmsOtp, verifySmsOtp } from "../smsOtp";
import { issueToken } from "./tokens";
import { rateLimit, clientIp } from "../rate-limit";
import { canSelfSignup } from "./roles";

/**
 * Phone+OTP login/signup for reviewer & business_owner — these two roles no
 * longer use email/password or Google at all (see data/roles.json), phone is
 * their entire identity. Admin is untouched (still email/password + TOTP,
 * src/lib/auth/providers/credentials.js).
 *
 * Unlike the email-OTP flow (lib/auth/otp.js), the OTP itself is generated
 * and checked by the external SMS gateway (lib/smsOtp.js) — we never see or
 * store the code. What we DO own: rate limiting, finding/creating the User
 * record once the gateway confirms the code, and minting the one-shot
 * `phone_login` token that src/lib/auth/providers/phoneOtp.js redeems to
 * actually establish a session (same bridge pattern as the existing
 * `post_verify_login` email token).
 */

const PHONE_RE = /^\d{10}$/;

export function isValidPhone(phone) {
  return typeof phone === "string" && PHONE_RE.test(phone);
}

/** Step 1: send the OTP. No user lookup here — sending doesn't reveal whether
 *  a phone is registered, since both login and signup send unconditionally. */
export async function requestPhoneOtp(phone, request) {
  const ip = clientIp(request);
  const byIp = rateLimit(`phone-otp:send:ip:${ip}`, { limit: 10, windowMs: 60 * 60 * 1000 });
  if (!byIp.ok) return { ok: false, message: "Too many requests. Try again later." };

  const byPhone = rateLimit(`phone-otp:send:phone:${phone}`, { limit: 5, windowMs: 60 * 60 * 1000 });
  if (!byPhone.ok) return { ok: false, message: "Too many requests for this number. Try again later." };

  return sendSmsOtp(phone);
}

/** Step 2, login: phone must already belong to a non-admin account. */
export async function verifyPhoneOtpForLogin(phone, otp, request) {
  const ip = clientIp(request);
  const byIp = rateLimit(`phone-otp:verify:ip:${ip}`, { limit: 20, windowMs: 15 * 60 * 1000 });
  if (!byIp.ok) return { ok: false, message: "Too many attempts. Try again later." };

  const gw = await verifySmsOtp(phone, otp);
  if (!gw.ok) return { ok: false, message: gw.message || "That code isn't valid." };

  await dbConnect();
  const user = await User.findOne({ phone, role: { $ne: "admin" } });
  if (!user) {
    return { ok: false, message: "No account found with this number. Sign up first.", code: "NOT_FOUND" };
  }
  if (user.status === "suspended") {
    return { ok: false, message: "This account has been suspended." };
  }

  await User.updateOne(
    { _id: user._id },
    { $set: { phoneVerified: new Date(), status: "active", lastLoginAt: new Date() } }
  );

  const otpToken = await issueToken(phone, "phone_login");
  return { ok: true, otpToken };
}

/**
 * Step 2, signup: `role` is passed in by the calling route
 * (POST /api/auth/signup/business/phone or /reviewer/phone), never trusted
 * from the request body — same discipline as lib/auth/signup.js.
 *
 * If the phone is already registered under a DIFFERENT role, this is a
 * cross-role signal like the email signup flow's own cross_role response —
 * rejected, not silently logged in as the wrong role. If it's already
 * registered under the SAME role, this just logs them in (re-running signup
 * with a phone you already used is a reasonable way to get back in).
 */
export async function verifyPhoneOtpForSignup({ phone, otp, name, role }, request) {
  if (!canSelfSignup(role)) return { ok: false, message: "Signup isn't available for this account type." };

  const ip = clientIp(request);
  const byIp = rateLimit(`phone-otp:verify:ip:${ip}`, { limit: 20, windowMs: 15 * 60 * 1000 });
  if (!byIp.ok) return { ok: false, message: "Too many attempts. Try again later." };

  const gw = await verifySmsOtp(phone, otp);
  if (!gw.ok) return { ok: false, message: gw.message || "That code isn't valid." };

  await dbConnect();
  let user = await User.findOne({ phone });

  if (user && user.role !== role) {
    return {
      ok: false,
      code: "CROSS_ROLE",
      role: user.role,
      message: `This number is already registered as a ${user.role === "business_owner" ? "business" : "reviewer"} account.`,
    };
  }

  if (user) {
    if (user.status === "suspended") return { ok: false, message: "This account has been suspended." };
    await User.updateOne(
      { _id: user._id },
      { $set: { phoneVerified: new Date(), status: "active", lastLoginAt: new Date() } }
    );
  } else {
    user = await User.create({
      name,
      phone,
      role,
      phoneVerified: new Date(),
      status: "active",
      passwordHash: null,
    });
  }

  const otpToken = await issueToken(phone, "phone_login");
  return { ok: true, otpToken, isNewAccount: !user.lastLoginAt };
}
