import { generateSecret, generateURI, verify } from "otplib";

/**
 * otplib v13 API. The v12 `authenticator` singleton is gone — this is the
 * functional API, and `verify` is async.
 */

const ISSUER = "ReviewHub";

// Default period is 30s. 30s of tolerance = one step either side, which absorbs
// ordinary clock skew without meaningfully widening the guess window.
const EPOCH_TOLERANCE_SECONDS = 30;

export function generateTotpSecret() {
  return generateSecret();
}

/** otpauth:// URI for the QR code on the admin TOTP setup screen. */
export function totpUri(email, secret) {
  return generateURI({
    strategy: "totp",
    issuer: ISSUER,
    label: email,
    secret,
  });
}

export async function verifyTotp(token, secret) {
  if (!token || !secret) return false;

  try {
    const result = await verify({
      strategy: "totp",
      secret,
      token: String(token).replace(/\s/g, ""),
      epochTolerance: EPOCH_TOLERANCE_SECONDS,
    });
    return result.valid === true;
  } catch {
    // Malformed token/secret throws rather than returning invalid. Treat as a
    // failed attempt, never as a pass.
    return false;
  }
}

/**
 * TODO — replay protection. v13 returns `timeStep` on a valid result and accepts
 * `afterTimeStep` to reject codes at or before a previously used step. Storing
 * the last-used step on the admin user would stop a shoulder-surfed code being
 * replayed inside its 30s window. Needs a `lastTotpTimeStep` field on User.
 */
