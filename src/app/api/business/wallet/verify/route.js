import { z } from "zod";
import dbConnect from "../../../../../lib/db";
import User from "../../../../../models/User";
import WalletTransaction from "../../../../../models/WalletTransaction";
import { apiRequirePermission } from "../../../../../lib/auth/guards";
import { verifyPaymentSignature } from "../../../../../lib/razorpay";

/**
 * Step 2 of a wallet top-up: the client hands back what Razorpay Checkout
 * gave it after a successful payment. We verify the HMAC signature
 * server-side (never trust the client's word that a payment succeeded) and
 * only then credit the wallet.
 *
 * razorpayPaymentId has a sparse-unique index on WalletTransaction, so a
 * retried/duplicate verify call for the same payment can't double-credit —
 * the WalletTransaction.create below throws on the duplicate key and we
 * treat that as "already credited", not an error.
 */
const schema = z
  .object({
    razorpay_order_id: z.string().min(1),
    razorpay_payment_id: z.string().min(1),
    razorpay_signature: z.string().min(1),
    amount: z.number().int().min(1),
  })
  .strict();

export async function POST(request) {
  const { user, response } = await apiRequirePermission("wallet:topup");
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = parsed.data;

  const valid = verifyPaymentSignature({
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    signature: razorpay_signature,
  });
  if (!valid) {
    return Response.json({ error: "Payment verification failed." }, { status: 400 });
  }

  await dbConnect();

  const credited = await User.findByIdAndUpdate(
    user.id,
    { $inc: { walletBalance: amount } },
    { returnDocument: "after" }
  ).select("walletBalance");

  try {
    await WalletTransaction.create({
      user: user.id,
      amount,
      type: "topup",
      note: "Wallet top-up via Razorpay",
      balanceAfter: credited.walletBalance,
      razorpayPaymentId: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id,
    });
  } catch (err) {
    if (err?.code === 11000) {
      // Already credited by a prior call (webhook or a retried verify) —
      // undo the increment we just made and report the real balance.
      const reverted = await User.findByIdAndUpdate(
        user.id,
        { $inc: { walletBalance: -amount } },
        { returnDocument: "after" }
      ).select("walletBalance");
      return Response.json({ ok: true, balance: reverted.walletBalance, alreadyCredited: true });
    }
    throw err;
  }

  return Response.json({ ok: true, balance: credited.walletBalance });
}
