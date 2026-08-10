import dbConnect from "../../../../lib/db";
import User from "../../../../models/User";
import WalletTransaction from "../../../../models/WalletTransaction";
import { apiRequirePermission } from "../../../../lib/auth/guards";

/**
 * Wallet read. Top-ups go through a separate two-step flow — see
 * api/business/wallet/order (create Razorpay order) and
 * api/business/wallet/verify (verify signature, then credit) — never a
 * plain POST here, so a client can't just assert an amount into its balance.
 *
 * GET → current balance + recent transactions.
 */
export async function GET() {
  const { user, response } = await apiRequirePermission("wallet:read");
  if (response) return response;

  await dbConnect();
  const doc = await User.findById(user.id).select("walletBalance").lean();
  const txns = await WalletTransaction.find({ user: user.id }).sort({ createdAt: -1 }).limit(10).lean();

  return Response.json({
    balance: doc?.walletBalance ?? 0,
    transactions: txns.map((t) => ({
      id: String(t._id),
      amount: t.amount,
      type: t.type,
      note: t.note,
      balanceAfter: t.balanceAfter,
      at: t.createdAt,
    })),
  });
}

export async function POST() {
  return Response.json(
    { error: "Adding funds is temporarily unavailable." },
    { status: 503 }
  );
}
