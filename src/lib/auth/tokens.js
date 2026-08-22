import crypto from "node:crypto";
import dbConnect from "../db";
import VerificationToken from "../../models/VerificationToken";

const TOKEN_BYTES = 32;

export const TOKEN_TTL_MS = {
  password_reset: 60 * 60 * 1000, // 1h
  email_verify: 24 * 60 * 60 * 1000, // 24h
  // Bridges "OTP just verified" to "log the user in" without carrying their
  // password across a redirect. Short-lived and single-use — see
  // credentials.js's otpToken branch.
  post_verify_login: 5 * 60 * 1000, // 5m
  // Same bridge, for the phone-OTP login/signup flow — see
  // lib/auth/phoneAuth.js and providers/phoneOtp.js. Identifier is the phone
  // number instead of an email.
  phone_login: 5 * 60 * 1000, // 5m
  // Proves "this phone just passed OTP verification" for a NUMBER THAT HAS
  // NO ACCOUNT YET — bridges to the name step (name is only ever asked after
  // verification, never before) and then to account creation. See
  // verifyPhoneOtp()/completePhoneSignup() in lib/auth/phoneAuth.js. Not a
  // session token by itself — phone_login is still minted separately once
  // the account actually exists.
  phone_verified: 10 * 60 * 1000, // 10m — enough time to type a name
};

/** SHA-256, not bcrypt: these are 256-bit random tokens, not guessable secrets.
 *  We only need the DB not to hold a usable token; we don't need slow hashing. */
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Returns the RAW token — put it in the email link and never store it.
 * Only the hash goes to the DB.
 */
export async function issueToken(identifier, purpose) {
  await dbConnect();

  const token = crypto.randomBytes(TOKEN_BYTES).toString("base64url");
  const tokenHash = hashToken(token);

  // One live token per identifier+purpose. Issuing a new reset link kills the old.
  await VerificationToken.deleteMany({
    identifier: identifier.toLowerCase(),
    purpose,
    consumedAt: null,
  });

  await VerificationToken.create({
    identifier: identifier.toLowerCase(),
    tokenHash,
    purpose,
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS[purpose]),
  });

  return token;
}

/**
 * Verify AND consume in one atomic step. findOneAndUpdate with consumedAt:null
 * in the filter means two concurrent requests can't both redeem the same token —
 * the second matches nothing.
 */
export async function consumeToken(token, purpose) {
  await dbConnect();

  const doc = await VerificationToken.findOneAndUpdate(
    {
      tokenHash: hashToken(token),
      purpose,
      consumedAt: null,
      expiresAt: { $gt: new Date() },
    },
    { $set: { consumedAt: new Date() } },
    { returnDocument: "after" }
  );

  if (!doc) return null;
  return { identifier: doc.identifier };
}
