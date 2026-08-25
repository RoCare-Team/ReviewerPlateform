import dbConnect from "../../../../lib/db";
import User from "../../../../models/User";
import WalletTransaction from "../../../../models/WalletTransaction";
import { apiRequirePermission } from "../../../../lib/auth/guards";

/**
 * The reviewer's wallet ledger — the mirror of /api/business/wallet, guarded
 * by the reviewer's own permission and scoped to their id.
 *
 * Only the reviewer's own rows are ever returned: the filter is
 * `user: user.id` from the session, never from the request.
 */
export async function GET() {
  const { user, response } = await apiRequirePermission("reward:withdraw");
  if (response) return response;

  await dbConnect();

  const [doc, txns] = await Promise.all([
    User.findById(user.id).select("walletBalance").lean(),
    WalletTransaction.find({ user: user.id }).sort({ createdAt: -1 }).limit(50).lean(),
  ]);

  return Response.json({
    balance: doc?.walletBalance ?? 0,
    transactions: txns.map((t) => ({
      id: String(t._id),
      amount: t.amount,
      type: t.type,
      note: t.note ?? "",
      balanceAfter: t.balanceAfter,
      createdAt: t.createdAt,
    })),
  });
}
