import { z } from "zod";
import dbConnect from "../../../../../lib/db";
import User from "../../../../../models/User";
import { verifyOtp } from "../../../../../lib/auth/otp";
import { rateLimit, clientIp } from "../../../../../lib/rate-limit";

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
  purpose: z.enum(["signup", "login"]).default("signup"),
}).strict();

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid code" }, { status: 400 });
  }
  const { email, code, purpose } = parsed.data;

  const ip = clientIp(request);
  const byIp = rateLimit(`otp:verify:ip:${ip}`, { limit: 20, windowMs: 15 * 60 * 1000 });
  if (!byIp.ok) {
    return Response.json(
      { error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(byIp.retryAfter) } }
    );
  }

  const result = await verifyOtp(email, code, purpose);

  if (!result.ok) {
    if (result.reason === "too_many_attempts") {
      return Response.json(
        { error: "Too many attempts. Request a new code.", code: "TOO_MANY_ATTEMPTS" },
        { status: 429 }
      );
    }
    // "invalid" covers wrong code, expired, already used, and no-such-email
    // alike — one message, so this can't be used to test whether an address is
    // registered or whether a code is merely stale.
    return Response.json({ error: "That code isn't valid.", code: "INVALID" }, { status: 400 });
  }

  await dbConnect();

  // A redeemed signup OTP is what makes emailVerified true — and emailVerified is
  // the gate that lib/auth/config.js requires before it will link a Google
  // identity onto this account. Only set it from a genuinely verified code.
  await User.updateOne(
    { email },
    { $set: { emailVerified: new Date(), status: "active" } }
  );

  return Response.json({ ok: true, next: "/login" });
}
