import crypto from "node:crypto";
import dbConnect from "../db";
import Otp from "../../models/Otp";

const OTP_TTL_MS = 10 * 60 * 1000; // 10 min
const RESEND_COOLDOWN_MS = 60 * 1000; // 60s
const DAILY_CAP_PER_EMAIL = 10;

function hashCode(code, email) {
  // Salt with the email so an attacker who dumps the collection can't build one
  // rainbow table for all 10^6 codes and match it against every row at once.
  return crypto
    .createHash("sha256")
    .update(`${email.toLowerCase()}:${code}`)
    .digest("hex");
}

function generateCode() {
  // randomInt is uniform — (randomBytes % 900000) is not, and biases the low digits.
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

/**
 * Returns { ok: true, code } — the RAW code, to be emailed and never stored.
 * Or { ok: false, reason } when rate-limited.
 *
 * CALLER MUST NOT leak `reason` to the client verbatim: the cooldown/cap state
 * is itself an existence oracle. Respond "if an account exists, we've sent a
 * code" either way.
 */
export async function issueOtp(email, purpose) {
  await dbConnect();
  const normalized = email.toLowerCase();

  const last = await Otp.findOne({ email: normalized, purpose }).sort({
    createdAt: -1,
  });

  if (last && Date.now() - last.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    const retryAfter = Math.ceil(
      (RESEND_COOLDOWN_MS - (Date.now() - last.createdAt.getTime())) / 1000
    );
    return { ok: false, reason: "cooldown", retryAfter };
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const todayCount = await Otp.countDocuments({
    email: normalized,
    createdAt: { $gte: since },
  });
  if (todayCount >= DAILY_CAP_PER_EMAIL) {
    return { ok: false, reason: "daily_cap" };
  }

  const code = generateCode();

  // Invalidate any outstanding code — only the newest may be redeemed.
  await Otp.updateMany(
    { email: normalized, purpose, consumedAt: null },
    { $set: { consumedAt: new Date() } }
  );

  await Otp.create({
    email: normalized,
    codeHash: hashCode(code, normalized),
    purpose,
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });

  return { ok: true, code };
}

/**
 * { ok: true } | { ok: false, reason: "invalid" | "too_many_attempts" }
 *
 * Attempts are counted on the OTP doc, so 6 digits can't be walked. On the 5th
 * failure the doc is consumed — a fresh code must be requested.
 */
export async function verifyOtp(email, code, purpose) {
  await dbConnect();
  const normalized = email.toLowerCase();

  const otp = await Otp.findOne({
    email: normalized,
    purpose,
    consumedAt: null,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!otp) return { ok: false, reason: "invalid" };

  if (otp.attempts >= otp.maxAttempts) {
    await Otp.updateOne({ _id: otp._id }, { $set: { consumedAt: new Date() } });
    return { ok: false, reason: "too_many_attempts" };
  }

  const expected = Buffer.from(otp.codeHash);
  const actual = Buffer.from(hashCode(String(code), normalized));
  const match =
    expected.length === actual.length && crypto.timingSafeEqual(expected, actual);

  if (!match) {
    const updated = await Otp.findOneAndUpdate(
      { _id: otp._id },
      { $inc: { attempts: 1 } },
      { new: true }
    );
    if (updated && updated.attempts >= updated.maxAttempts) {
      await Otp.updateOne({ _id: otp._id }, { $set: { consumedAt: new Date() } });
      return { ok: false, reason: "too_many_attempts" };
    }
    return { ok: false, reason: "invalid" };
  }

  // Atomic consume — a matched code can only be redeemed once even if two
  // requests arrive together.
  const consumed = await Otp.findOneAndUpdate(
    { _id: otp._id, consumedAt: null },
    { $set: { consumedAt: new Date() } },
    { new: true }
  );
  if (!consumed) return { ok: false, reason: "invalid" };

  return { ok: true };
}

export { RESEND_COOLDOWN_MS, OTP_TTL_MS };
