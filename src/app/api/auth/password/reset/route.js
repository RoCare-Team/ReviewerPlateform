import { z } from "zod";
import dbConnect from "../../../../../lib/db";
import User from "../../../../../models/User";
import { consumeToken } from "../../../../../lib/auth/tokens";
import { hashPassword } from "../../../../../lib/auth/password";
import { rateLimit, clientIp } from "../../../../../lib/rate-limit";
import { ROLES } from "../../../../../lib/auth/roles";

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
}).strict();

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const { token, password } = parsed.data;

  const ip = clientIp(request);
  const byIp = rateLimit(`pwd:reset:ip:${ip}`, { limit: 20, windowMs: 60 * 60 * 1000 });
  if (!byIp.ok) {
    return Response.json({ error: "Too many attempts." }, { status: 429 });
  }

  // Atomic verify-and-consume: a reset link works exactly once, even if two
  // requests arrive together.
  const claim = await consumeToken(token, "password_reset");
  if (!claim) {
    return Response.json({ error: "This link is invalid or has expired." }, { status: 400 });
  }

  await dbConnect();
  const user = await User.findOne({ email: claim.identifier }).select("role status");
  if (!user || user.status === "suspended") {
    return Response.json({ error: "This link is invalid or has expired." }, { status: 400 });
  }

  // Belt and braces — /forgot never issues admin tokens, so reaching here with
  // one means something upstream changed. Refuse rather than trust the token.
  if (user.role === ROLES.ADMIN) {
    return Response.json({ error: "This link is invalid or has expired." }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);

  // Completing a reset proves control of the mailbox, so the address is verified
  // now even if it wasn't before.
  await User.updateOne(
    { _id: user._id },
    { $set: { passwordHash, emailVerified: new Date(), status: "active" } }
  );

  return Response.json({ ok: true, next: "/login" });
}
