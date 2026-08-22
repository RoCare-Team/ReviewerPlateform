import { z } from "zod";
import { verifyPhoneOtp, isValidPhone } from "../../../../../../lib/auth/phoneAuth";
import { ROLES } from "../../../../../../lib/auth/roles";

/**
 * Unified phone+OTP verify step — used by BOTH /login (intent: "login",
 * role-agnostic) and /signup/{business,reviewer} (intent: "signup", role
 * fixed by the calling page, sent here as a hint only — see below).
 *
 * Body: { phone, otp, intent, role? }. `role` is NOT how account creation
 * decides its role (that only ever happens in completePhoneSignup(), fed by
 * the URL of a specific signup route) — here it's only used to catch
 * "this number already has an account under the OTHER role" before treating
 * an existing account as a normal login.
 *
 * Responses:
 *  - { ok:true, status:"existing", otpToken } — redeem via
 *    signIn("phone-otp", { phone, otpToken }) to log straight in. No name
 *    was asked, none was needed.
 *  - { ok:true, status:"new", verifiedToken } — phone has no account yet,
 *    either intent (a /login attempt with no matching account gets this too,
 *    not an error — see phoneAuth.js). Client asks for a role (if it doesn't
 *    already know one — /login doesn't) then a name, then POSTs
 *    /api/auth/signup/{business,reviewer}/complete with this token.
 *  - { ok:false, error, code? } — invalid code, cross-role, or suspended.
 */
const schema = z
  .object({
    phone: z.string().trim(),
    otp: z.string().trim().regex(/^\d{4}$/, "Enter the 4-digit code"),
    intent: z.enum(["login", "signup"]).default("login"),
    role: z.enum([ROLES.BUSINESS_OWNER, ROLES.REVIEWER]).optional(),
  })
  .strict()
  .refine((v) => v.intent !== "signup" || Boolean(v.role), { message: "role is required for signup" });

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success || !isValidPhone(parsed.data.phone)) {
    return Response.json({ error: "Invalid input" }, { status: 400 });
  }

  const result = await verifyPhoneOtp(parsed.data, request);
  if (!result.ok) {
    return Response.json({ error: result.message, code: result.code, role: result.role }, { status: 400 });
  }

  if (result.status === "existing") {
    return Response.json({ ok: true, status: "existing", otpToken: result.otpToken });
  }
  return Response.json({ ok: true, status: "new", verifiedToken: result.verifiedToken });
}
