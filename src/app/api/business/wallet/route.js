import dbConnect from "../../../../lib/db";
import User from "../../../../models/User";
import WalletTransaction from "../../../../models/WalletTransaction";
import { apiRequirePermission } from "../../../../lib/auth/guards";

/**
 * Wallet read. Top-up (POST) is disabled for now — no payment gateway is
 * wired up, so businesses can't self-credit their wallet. Re-enable POST only
 * once a real Razorpay flow credits after webhook-confirmed capture, not on
 * request.
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
