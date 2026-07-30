import { z } from "zod";
import dbConnect from "../../../../lib/db";
import User from "../../../../models/User";
import WalletTransaction from "../../../../models/WalletTransaction";
import { apiRequirePermission } from "../../../../lib/auth/guards";

/**
 * Wallet top-up. Guarded by wallet:* (business owners), scoped to the session
 * user. This is a MOCK top-up — it credits the balance immediately without a
 * payment gateway. A real Razorpay flow would credit only after the payment
 * webhook confirms capture; the ledger shape here is ready for that.
 *
 * GET  → current balance + recent transactions.
 * POST → add funds { amount }.
 */
const topupSchema = z
  .object({ amount: z.number().int().positive().max(1_000_000) })
  .strict();

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

export async function POST(request) {
  const { user, response } = await apiRequirePermission("wallet:topup");
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = topupSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Enter a valid amount." }, { status: 400 });
  }

  await dbConnect();

  // Atomic increment so concurrent top-ups can't clobber each other.
  const updated = await User.findByIdAndUpdate(
    user.id,
    { $inc: { walletBalance: parsed.data.amount } },
    { new: true }
  ).select("walletBalance");

  if (!updated) return Response.json({ error: "Account not found" }, { status: 404 });

  await WalletTransaction.create({
    user: user.id,
    amount: parsed.data.amount,
    type: "topup",
    note: "Wallet top-up",
    balanceAfter: updated.walletBalance,
  });

  return Response.json({ ok: true, balance: updated.walletBalance });
}
