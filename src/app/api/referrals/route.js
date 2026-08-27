import dbConnect from "../../../lib/db";
import User from "../../../models/User";
import { apiRequireAuth } from "../../../lib/auth/guards";
import { ROLES } from "../../../lib/auth/roles";
import { getReferralSummary, getReferralHistory } from "../../../lib/referral";

/**
 * "Invite & earn" — this user's own code, share link, and the list of people
 * who joined with it. Read by the mobile app's referral screen and by the
 * website's invite card.
 *
 * Every row says whether that person actually got onto the APP, because that
 * is what the bonus is paid for (src/lib/referral.js). A web signup shows as
 * pending, not as earnings — the referrer can see exactly who still needs to
 * install, which is the whole point of showing a history at all.
 *
 * Scoped to the session user; there is no way to read anyone else's referrals.
 * Admin has no referral code, so it's excluded rather than returning an empty
 * card it can never fill.
 */
export async function GET() {
  const { user, response } = await apiRequireAuth();
  if (response) return response;
  if (user.role === ROLES.ADMIN) {
    return Response.json({ error: "Referrals are for reviewer and business accounts." }, { status: 403 });
  }

  await dbConnect();
  const me = await User.findById(user.id).select("referralCode").lean();
  if (!me) return Response.json({ error: "Account not found" }, { status: 404 });

  // Both roles share the /login door — phone+OTP figures out the rest.
  const signupPath = "/login";
  const [summary, history] = await Promise.all([
    getReferralSummary(user.id, me.referralCode, { signupPath }),
    getReferralHistory(user.id),
  ]);

  return Response.json({ ...summary, history });
}
