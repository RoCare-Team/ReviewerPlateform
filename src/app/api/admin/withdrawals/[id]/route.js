import { z } from "zod";
import dbConnect from "../../../../../lib/db";
import User from "../../../../../models/User";
import WalletTransaction from "../../../../../models/WalletTransaction";
import WithdrawalRequest from "../../../../../models/WithdrawalRequest";
import { getCurrentUser } from "../../../../../lib/auth/session";
import { ROLES } from "../../../../../lib/auth/roles";
import { createContact, createFundAccount, createPayout } from "../../../../../lib/razorpay";

/**
 * Admin verifies a reviewer's withdrawal request.
 *   approve → the amount was already held/deducted when the request was
 *             created. This creates (or reuses) a RazorpayX contact + fund
 *             account for the reviewer's saved bank details and fires a real
 *             payout. The request moves to "processing" here; the webhook
 *             (api/webhooks/razorpay) flips it to "approved" once RazorpayX
 *             confirms the money actually landed, or refunds it if the
 *             payout fails/reverses at the bank.
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
    // Claim it first (atomic) so a double-click can't fire two payouts.
    const claimed = await WithdrawalRequest.findOneAndUpdate(
      { _id: id, status: "pending" },
      { $set: { status: "processing", reviewedBy: admin.id, reviewedAt: new Date() } },
      { returnDocument: "after" }
    );
    if (!claimed) return Response.json({ error: "Request not found or already reviewed." }, { status: 404 });

    try {
      const contact = await createContact({
        name: claimed.accountHolderName,
        reference_id: String(claimed.reviewer),
      });
      const fundAccount = await createFundAccount({
        contactId: contact.id,
        accountHolderName: claimed.accountHolderName,
        accountNumber: claimed.accountNumber,
        ifsc: claimed.ifsc,
      });
      const payout = await createPayout({
        fundAccountId: fundAccount.id,
        amount: claimed.amount,
        referenceId: String(claimed._id),
        narration: "RapportLook payout",
      });

      await WithdrawalRequest.findByIdAndUpdate(claimed._id, {
        $set: {
          razorpayContactId: contact.id,
          razorpayFundAccountId: fundAccount.id,
          razorpayPayoutId: payout.id,
          razorpayPayoutStatus: payout.status,
          // Some payout modes settle same-request — reflect that immediately
          // rather than waiting on the webhook if Razorpay already says so.
          ...(payout.status === "processed" ? { status: "approved" } : {}),
        },
      });
      return Response.json({ ok: true, payoutStatus: payout.status });
    } catch (err) {
      console.error("razorpayx payout failed:", err, err?.razorpay);
      // Payout couldn't even be created — refund the hold and reject instead
      // of leaving the reviewer's money stuck in limbo. The reviewer only
      // ever sees the generic half; the real Razorpay error (e.g. RazorpayX
      // not activated on this account, invalid IFSC, insufficient balance in
      // the RazorpayX current account) goes in `note` on this line, visible
      // to admins in the withdrawal's audit trail without needing server logs.
      const detail = err?.razorpay?.error?.description || err?.message || "Unknown error";
      await WithdrawalRequest.findByIdAndUpdate(claimed._id, {
        $set: {
          status: "rejected",
          rejectionReason: "Automatic payout failed — please contact support.",
          adminNote: `Payout error: ${detail}`,
        },
      });
      const refunded = await User.findByIdAndUpdate(
        claimed.reviewer,
        { $inc: { walletBalance: claimed.amount } },
        { returnDocument: "after" }
      ).select("walletBalance");
      await WalletTransaction.create({
        user: claimed.reviewer,
        amount: claimed.amount,
        type: "refund",
        note: "Withdrawal payout failed — refunded",
        balanceAfter: refunded?.walletBalance ?? claimed.amount,
      });
      return Response.json(
        { error: err?.message || "Payout failed. The amount has been refunded to the reviewer." },
        { status: 502 }
      );
    }
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
