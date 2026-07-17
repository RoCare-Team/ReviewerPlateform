import bcrypt from "bcryptjs";

const ROUNDS = 12;

export async function hashPassword(plain) {
  return bcrypt.hash(plain, ROUNDS);
}

/**
 * Constant-time-ish compare. `hash` may be null for OAuth-only users — bcrypt
 * would throw on null, so we burn a comparison against a dummy hash instead of
 * returning early. Returning early leaks, via response time, whether an email
 * has a password set at all.
 */
const DUMMY_HASH = "$2a$12$C6UzMDM.H6dfI/f/IKcEe.OWKzTJ0Rw7Rr1sVJgKnkFQ0mHnj/8Iq";

export async function verifyPassword(plain, hash) {
  if (!hash) {
    await bcrypt.compare(plain, DUMMY_HASH);
    return false;
  }
  return bcrypt.compare(plain, hash);
}
