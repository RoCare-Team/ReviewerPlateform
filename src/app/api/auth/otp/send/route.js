import { z } from "zod";
import dbConnect from "../../../../../lib/db";
import User from "../../../../../models/User";
import { issueOtp } from "../../../../../lib/auth/otp";
import { sendOtpEmail } from "../../../../../lib/mail";
import { rateLimit, clientIp } from "../../../../../lib/rate-limit";

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
  purpose: z.enum(["signup", "login"]).default("signup"),
}).strict();

// Same opaque answer in every branch — see below.
const OPAQUE = { ok: true, message: "If an account exists, we've sent a code." };

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid input" }, { status: 400 });
  }
  const { email, purpose } = parsed.data;

  // Limit by IP *and* by email. IP alone lets one attacker spray many addresses
  // from a botnet; email alone lets one IP walk a list one address at a time.
  const ip = clientIp(request);
  const byIp = rateLimit(`otp:send:ip:${ip}`, { limit: 10, windowMs: 60 * 60 * 1000 });
  if (!byIp.ok) {
    return Response.json(OPAQUE, { status: 200, headers: { "Retry-After": String(byIp.retryAfter) } });
  }
  const byEmail = rateLimit(`otp:send:email:${email}`, { limit: 5, windowMs: 60 * 60 * 1000 });
  if (!byEmail.ok) return Response.json(OPAQUE);

  await dbConnect();
  const user = await User.findOne({ email }).select("status");

  /**
   * ★ NO ENUMERATION.
   *
   * Every path below returns OPAQUE with status 200: no such user, rate-limited,
   * cooldown, daily cap, already verified. If any of them differed in body,
   * status, or timing, this endpoint would tell an attacker which emails are
   * registered — and it's unauthenticated, so anyone could ask.
   *
   * The cooldown/cap state is itself an oracle, which is why issueOtp's `reason`
   * is never forwarded to the client.
   */
  if (!user) return Response.json(OPAQUE);
  if (user.status === "suspended") return Response.json(OPAQUE);
  if (purpose === "signup" && user.status === "active") return Response.json(OPAQUE);

  const result = await issueOtp(email, purpose);
  if (!result.ok) return Response.json(OPAQUE); // cooldown / daily cap — swallowed

  try {
    await sendOtpEmail(email, result.code);
  } catch (err) {
    // Log server-side; still answer opaquely. A 500 here would reveal that the
    // address exists (we only try to send for real users).
    console.error("[otp:send] mail failed", err);
  }

  return Response.json(OPAQUE);
}
