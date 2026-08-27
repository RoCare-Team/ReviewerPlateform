import { z } from "zod";
import dbConnect from "../../../../lib/db";
import User from "../../../../models/User";
import { apiRequirePermission } from "../../../../lib/auth/guards";
import { getReferralSummary, markAppInstall } from "../../../../lib/referral";
import { readClientPlatform } from "../../../../lib/clientPlatform";

/**
 * Business-owner self-service profile update. Guarded by profile:update (see
 * data/roles.json). The id comes from the session, never the body — a user can
 * only edit their own record. Role/status are not editable here.
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
 * The signed-in business owner's own profile — the mirror of
 * GET /api/reviewer/profile, minus the reviewer-only city/bank/age fields.
 *
 * The id comes from the session, never the request.
 */
export async function GET(request) {
  const { user, response } = await apiRequirePermission("profile:update");
  if (response) return response;

  await dbConnect();

  // Catches an account that was already signed in on the app before the
  // install rule existed — its referrer's pending bonus is released the next
  // time the app loads this screen. No-op from a browser, and no-op once the
  // install is already recorded. See lib/referral.js#markAppInstall.
  await markAppInstall(user.id, readClientPlatform(request));

  const doc = await User.findById(user.id)
    .select("name phone bio image role status walletBalance referralCode createdAt")
    .lean();
  if (!doc) return Response.json({ error: "Account not found" }, { status: 404 });

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
      referralCode: referral.referralCode,
      referredCount: referral.referredCount,
      // Only the installs earned anything — the app should headline this,
      // not referredCount, or it advertises rewards that were never paid.
      referralInstalledCount: referral.installedCount,
      referralPaidCount: referral.paidCount,
      referralPendingCount: referral.pendingCount,
      referralReward: referral.referralReward,
      // Play Store link carrying the code; see lib/referral.js. The web
      // signup link is kept as a fallback that pays nothing on its own.
      referralLink: referral.referralLink,
      referralWebLink: referral.webSignupLink,
      createdAt: doc.createdAt,
    },
  });
}
