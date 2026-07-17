import { z } from "zod";
import dbConnect from "../db";
import User from "../../models/User";
import { hashPassword } from "./password";
import { issueOtp } from "./otp";
import { sendOtpEmail } from "../mail";
import { canSelfSignup } from "./roles";

/**
 * ★ ROLE IS NEVER READ FROM THE REQUEST BODY.
 *
 * The schema has no `role` field and is .strict(), so `{ "role": "admin" }` in
 * the payload is a 400 — not silently stripped, actively rejected. Role is passed
 * in by the route file that called us:
 *
 *   POST /api/auth/signup/reviewer  → ROLES.REVIEWER
 *   POST /api/auth/signup/business  → ROLES.BUSINESS_OWNER
 *
 * and is still re-checked against canSelfSignup() below, which reads roles.json.
 * `admin` is signup:"closed" there, so this function cannot produce one under any
 * input. Admin is seeded — see scripts/seed-admin.js.
 */

const schema = z
  .object({
    name: z.string().trim().min(1).max(100),
    email: z.string().trim().toLowerCase().email(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(200, "Password is too long"),
  })
  .strict();

export async function createUserForRole(request, role) {
  // Defence in depth: even if a caller passed "admin", roles.json says closed.
  if (!canSelfSignup(role)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const { name, email, password } = parsed.data;

  await dbConnect();

  const existing = await User.findOne({ email });

  // ★ NO ENUMERATION. An existing email returns exactly the same body and status
  // as a fresh signup — otherwise /signup becomes a "does this person have a
  // ReviewHub account" oracle for anyone with a list of emails.
  if (existing) {
    if (!existing.emailVerified) {
      // Unverified row: re-send a code so a user who abandoned signup isn't locked
      // out of their own address. Deliberately does NOT touch the stored password —
      // an attacker replaying this cannot overwrite a real credential.
      const otp = await issueOtp(email, "signup");
      if (otp.ok) await sendOtpEmail(email, otp.code);
    }
    return Response.json({ ok: true, next: "/verify-otp" }, { status: 201 });
  }

  const passwordHash = await hashPassword(password);

  try {
    await User.create({
      name,
      email,
      passwordHash,
      role, // ← from the route file, not the body
      status: "pending", // → active once OTP is verified
      emailVerified: null,
    });
  } catch (err) {
    // Unique index on email — someone raced us between findOne and create.
    // Same opaque response as above.
    if (err?.code === 11000) {
      return Response.json({ ok: true, next: "/verify-otp" }, { status: 201 });
    }
    throw err;
  }

  const otp = await issueOtp(email, "signup");
  if (otp.ok) await sendOtpEmail(email, otp.code);

  return Response.json({ ok: true, next: "/verify-otp" }, { status: 201 });
}
