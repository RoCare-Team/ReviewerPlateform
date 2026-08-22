import dbConnect from "../../../../lib/db";
import User from "../../../../models/User";
import WalletTransaction from "../../../../models/WalletTransaction";
import WithdrawalRequest from "../../../../models/WithdrawalRequest";
import { verifyWebhookSignature } from "../../../../lib/razorpay";

/**
 * Server-to-server backstop, independent of whether the business's browser
 * stayed open long enough to call /api/business/wallet/verify, and of
 * whether an admin action is what moves a payout forward.
 *
 * Configure this URL (…/api/webhooks/razorpay) in the Razorpay dashboard
 * with events: payment.captured, payout.processed, payout.reversed,
 * payout.failed. Set RAZORPAY_WEBHOOK_SECRET to the same secret used there.
 *
 * Idempotent by construction: payment credits rely on the sparse-unique
 * razorpayPaymentId index on WalletTransaction; payout status updates are
 * guarded by matching the current status so a duplicate delivery is a no-op.
 */
export async function POST(request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature") || "";

  let valid;
  try {
    valid = verifyWebhookSignature({ rawBody, signature });
  } catch {
    // Webhook secret not configured — nothing we can safely verify.
    return Response.json({ ok: true, skipped: "not configured" });
  }
  if (!valid) return Response.json({ error: "Invalid signature" }, { status: 400 });

  const event = JSON.parse(rawBody);
  await dbConnect();

  if (event.event === "payment.captured") {
    const payment = event.payload?.payment?.entity;
    if (!payment) return Response.json({ ok: true });

    const userId = payment.notes?.userId;
    const amount = Math.round(payment.amount / 100);
    if (!userId || !amount) return Response.json({ ok: true });

    const credited = await User.findByIdAndUpdate(
      userId,
      { $inc: { walletBalance: amount } },
      { returnDocument: "after" }
    ).select("walletBalance");
    if (!credited) return Response.json({ ok: true });

    try {
      await WalletTransaction.create({
        user: userId,
        amount,
        type: "topup",
        note: "Wallet top-up via Razorpay",
        balanceAfter: credited.walletBalance,
        razorpayPaymentId: payment.id,
        razorpayOrderId: payment.order_id,
      });
    } catch (err) {
      if (err?.code === 11000) {
        // Already credited via the client verify path — undo this duplicate credit.
        await User.findByIdAndUpdate(userId, { $inc: { walletBalance: -amount } });
      } else {
        throw err;
      }
    }
    return Response.json({ ok: true });
  }

  if (event.event === "payout.processed" || event.event === "payout.failed" || event.event === "payout.reversed") {
    const payout = event.payload?.payout?.entity;
    if (!payout) return Response.json({ ok: true });

    if (event.event === "payout.processed") {
      await WithdrawalRequest.findOneAndUpdate(
        { razorpayPayoutId: payout.id, status: "processing" },
        { $set: { status: "approved", razorpayPayoutStatus: payout.status } }
      );
      return Response.json({ ok: true });
    }

    // failed / reversed → refund the held amount back to the reviewer, once.
    const reqDoc = await WithdrawalRequest.findOneAndUpdate(
      { razorpayPayoutId: payout.id, status: "processing" },
      {
        $set: {
          status: "rejected",
          rejectionReason: `Payout ${event.event === "payout.failed" ? "failed" : "reversed"} at the bank.`,
          razorpayPayoutStatus: payout.status,
        },
      },
      { returnDocument: "after" }
    );
    if (!reqDoc) return Response.json({ ok: true });

    const refunded = await User.findByIdAndUpdate(
      reqDoc.reviewer,
      { $inc: { walletBalance: reqDoc.amount } },
      { returnDocument: "after" }
    ).select("walletBalance");

    await WalletTransaction.create({
      user: reqDoc.reviewer,
      amount: reqDoc.amount,
      type: "refund",
      note: "Withdrawal payout failed — refunded",
      balanceAfter: refunded?.walletBalance ?? reqDoc.amount,
    });
    return Response.json({ ok: true });
  }

  return Response.json({ ok: true });
}
