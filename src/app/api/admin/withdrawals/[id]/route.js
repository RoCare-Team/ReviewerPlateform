import { z } from "zod";
import dbConnect from "../../../../../lib/db";
import User from "../../../../../models/User";
import WalletTransaction from "../../../../../models/WalletTransaction";
import WithdrawalRequest from "../../../../../models/WithdrawalRequest";
import { getCurrentUser } from "../../../../../lib/auth/session";
import { ROLES } from "../../../../../lib/auth/roles";

/**
 * Admin verifies a reviewer's withdrawal request.
 *   approve → no wallet change (the amount was already held/deducted when
 *             the request was created) — this just records that the payout
 *             was sent (manually, outside the app; no gateway is wired yet).
 *   reject  → refunds the held amount back to the reviewer's wallet.
 *
 * The status guard ({ status: "pending" }) makes both actions idempotent — a
 * second click matches nothing, so a reviewer can never be refunded twice or
 * have a paid request silently reprocessed.
 */
const schema = z
  .object({
    action: z.enum(["approve", "reject"]),
    reason: z.string().trim().max(300).optional().default(""),
  })
  .strict();

async function requireAdminApi() {
  const user = await getCurrentUser();
  if (!user || user.role !== ROLES.ADMIN || user.status !== "active") {
    return { user: null, response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { user, response: null };
}

export async function PATCH(request, { params }) {
  const { user: admin, response } = await requireAdminApi();
  if (response) return response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });

  await dbConnect();

  if (parsed.data.action === "approve") {
    const approved = await WithdrawalRequest.findOneAndUpdate(
      { _id: id, status: "pending" },
      { $set: { status: "approved", reviewedBy: admin.id, reviewedAt: new Date() } },
      { returnDocument: "after" }
    );
    if (!approved) return Response.json({ error: "Request not found or already reviewed." }, { status: 404 });
    return Response.json({ ok: true });
  }

  // Reject — claim the request first (atomic) so it can't be refunded twice.
  const rejected = await WithdrawalRequest.findOneAndUpdate(
    { _id: id, status: "pending" },
    {
      $set: {
        status: "rejected",
        rejectionReason: parsed.data.reason,
        reviewedBy: admin.id,
        reviewedAt: new Date(),
      },
    },
    { returnDocument: "after" }
  );
  if (!rejected) return Response.json({ error: "Request not found or already reviewed." }, { status: 404 });

  const refunded = await User.findByIdAndUpdate(
    rejected.reviewer,
    { $inc: { walletBalance: rejected.amount } },
    { returnDocument: "after" }
  ).select("walletBalance");

  await WalletTransaction.create({
    user: rejected.reviewer,
    amount: rejected.amount,
    type: "refund",
    note: parsed.data.reason ? `Withdrawal rejected: ${parsed.data.reason}` : "Withdrawal rejected — refunded",
    by: admin.id,
    balanceAfter: refunded?.walletBalance ?? rejected.amount,
  });

  return Response.json({ ok: true });
}
