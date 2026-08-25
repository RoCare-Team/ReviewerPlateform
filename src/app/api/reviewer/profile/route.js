import { z } from "zod";
import dbConnect from "../../../../lib/db";
import User from "../../../../models/User";
import { apiRequirePermission } from "../../../../lib/auth/guards";
import { getReferralSummary } from "../../../../lib/referral";

/**
 * Self-service profile update. Guarded by the profile:update permission (see
 * data/roles.json) — a reviewer can only edit their OWN record; the id comes
 * from the session, never the body. Role/status are NOT editable here.
 *
 * `phone` is accepted in the body (so the existing client form doesn't 400)
 * but never applied — it's this role's LOGIN identity now (phone+OTP, see
 * lib/auth/phoneAuth.js), so changing it here would swap someone's login
 * number with no re-verification. That needs its own re-verify-by-OTP flow,
 * which doesn't exist yet.
 */
const schema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(80),
    phone: z.string().trim().max(20).optional(),
    bio: z.string().trim().max(280).optional().default(""),
  })
  .strict();

export async function PATCH(request) {
  const { user, response } = await apiRequirePermission("profile:update");
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  await dbConnect();
  const updated = await User.findByIdAndUpdate(
    user.id,
    { $set: { name: parsed.data.name, bio: parsed.data.bio } },
    { returnDocument: "after", runValidators: true }
  ).select("name phone bio");

  if (!updated) return Response.json({ error: "Account not found" }, { status: 404 });

  return Response.json({
    ok: true,
    profile: {
      name: updated.name ?? "",
      phone: updated.phone ?? "",
      bio: updated.bio ?? "",
    },
  });
}

/**
 * The signed-in reviewer's own profile — what the app loads right after
 * signing in, for the wallet balance, declared city and saved bank details
 * that /api/auth/session doesn't carry.
 *
 * The id comes from the session, never the request, so this can only ever
 * return the caller's own record. `passwordHash` and `totpSecret` are
 * `select: false` on the model and are not requested here either.
 */
export async function GET() {
  const { user, response } = await apiRequirePermission("profile:update");
  if (response) return response;

  await dbConnect();

  const doc = await User.findById(user.id)
    .select(
      "name phone bio image role status walletBalance location referralCode " +
        "bankAccountHolder bankAccountNumber bankIfsc ageConfirmed createdAt"
    )
    .lean();

  if (!doc) return Response.json({ error: "Account not found" }, { status: 404 });

  // Same "Invite & earn" payload the website's profile page renders, including
  // the lazy code backfill for accounts older than the referral program.
  const referral = await getReferralSummary(user.id, doc.referralCode);

  return Response.json({
    profile: {
      id: String(doc._id),
      name: doc.name ?? "",
      phone: doc.phone ?? "",
      bio: doc.bio ?? "",
      image: doc.image ?? "",
      role: doc.role,
      status: doc.status,
      walletBalance: doc.walletBalance ?? 0,
      location: { city: doc.location?.city ?? "" },
      referralCode: referral.referralCode,
      referredCount: referral.referredCount,
      referralReward: referral.referralReward,
      referralLink: referral.referralLink,
      bankAccountHolder: doc.bankAccountHolder ?? "",
      bankAccountNumber: doc.bankAccountNumber ?? "",
      bankIfsc: doc.bankIfsc ?? "",
      ageConfirmed: doc.ageConfirmed ?? false,
      createdAt: doc.createdAt,
    },
  });
}
