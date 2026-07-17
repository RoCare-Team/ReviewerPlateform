import crypto from "node:crypto";
import dbConnect from "../db";
import VerificationToken from "../../models/VerificationToken";

const TOKEN_BYTES = 32;

export const TOKEN_TTL_MS = {
  password_reset: 60 * 60 * 1000, // 1h
  email_verify: 24 * 60 * 60 * 1000, // 24h
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
    { new: true }
  );

  if (!doc) return null;
  return { identifier: doc.identifier };
}
