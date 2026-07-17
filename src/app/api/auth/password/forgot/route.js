import { z } from "zod";
import dbConnect from "../../../../../lib/db";
import User from "../../../../../models/User";
import { issueToken } from "../../../../../lib/auth/tokens";
import { sendPasswordResetEmail } from "../../../../../lib/mail";
import { rateLimit, clientIp } from "../../../../../lib/rate-limit";
import { ROLES } from "../../../../../lib/auth/roles";

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
}).strict();

const OPAQUE = { ok: true, message: "If an account exists, we've sent a reset link." };

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });
  const { email } = parsed.data;

  const ip = clientIp(request);
  const byIp = rateLimit(`pwd:forgot:ip:${ip}`, { limit: 10, windowMs: 60 * 60 * 1000 });
  if (!byIp.ok) return Response.json(OPAQUE);
  const byEmail = rateLimit(`pwd:forgot:email:${email}`, { limit: 3, windowMs: 60 * 60 * 1000 });
  if (!byEmail.ok) return Response.json(OPAQUE);

  await dbConnect();
  const user = await User.findOne({ email }).select("status role emailVerified");

  // ★ Opaque in every branch — see /api/auth/otp/send for why.
  if (!user) return Response.json(OPAQUE);
  if (user.status === "suspended") return Response.json(OPAQUE);

  // Never email a reset link to an unverified address: we have no evidence the
  // requester controls it, and sending one would let an attacker who registered
  // someone else's email complete a takeover by mail.
  if (!user.emailVerified) return Response.json(OPAQUE);

  // Admin reset does not go through self-service email. If the admin mailbox is
  // compromised, an emailed reset link hands over the whole panel — the same
  // reason admin uses TOTP rather than email OTP. Rotate an admin password with
  // scripts/seed-admin.js, on a trusted machine.
  if (user.role === ROLES.ADMIN) return Response.json(OPAQUE);

  const token = await issueToken(email, "password_reset");

  try {
    await sendPasswordResetEmail(email, token);
  } catch (err) {
    console.error("[password:forgot] mail failed", err);
  }

  return Response.json(OPAQUE);
}
