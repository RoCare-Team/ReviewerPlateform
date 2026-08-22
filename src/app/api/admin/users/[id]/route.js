import dbConnect from "../../../../../lib/db";
import User from "../../../../../models/User";
import Campaign from "../../../../../models/Campaign";
import { apiRequireAdmin } from "../../../../../lib/auth/guards";
import { ROLES } from "../../../../../lib/auth/roles";

/**
 * Admin-only user delete. Irreversible — same "no undo" contract as
 * api/admin/campaigns/[id]'s DELETE.
 *
 * Two guards before it's allowed to proceed:
 *  1. Never an admin account, and never the admin's own account — this
 *     route has no business deleting the people who can use it (self-lockout
 *     is the obvious failure mode otherwise).
 *  2. A business owner with any not-yet-finished campaign (active/paused/
 *     draft) is blocked — deleting them out from under a live campaign
 *     would orphan it with no owner to manage or fund it. Delete (or let
 *     finish) those campaigns first via api/admin/campaigns/[id], same as
 *     the button on /admin/campaigns.
 *
 * Deliberately NOT cascaded further than that: Submissions, Claims,
 * WalletTransactions and (completed) Campaigns referencing this user are
 * left as-is — historical records, same reasoning as the campaign delete
 * route leaving Submissions alone. Any wallet balance this user still had
 * is simply forfeited; the confirm step on the client surfaces that amount
 * so the admin isn't deleting it blind.
 */
export async function DELETE(request, { params }) {
  const { user: admin, response } = await apiRequireAdmin();
  if (response) return response;

  const { id } = await params;
  if (id === admin.id) {
    return Response.json({ error: "You can't delete your own account." }, { status: 400 });
  }

  await dbConnect();

  const target = await User.findById(id).select("role");
  if (!target) {
    return Response.json({ error: "User not found." }, { status: 404 });
  }
  if (target.role === ROLES.ADMIN) {
    return Response.json({ error: "Admin accounts can't be deleted here." }, { status: 400 });
  }

  if (target.role === ROLES.BUSINESS_OWNER) {
    const unfinished = await Campaign.exists({ user: target._id, status: { $in: ["active", "paused", "draft"] } });
    if (unfinished) {
      return Response.json(
        { error: "This business still has active, paused, or draft campaigns — delete those first." },
        { status: 409 }
      );
    }
  }

  await User.deleteOne({ _id: target._id });

  return Response.json({ ok: true });
}
