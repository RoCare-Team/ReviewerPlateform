import { z } from "zod";
import dbConnect from "../../../../lib/db";
import User from "../../../../models/User";
import WalletTransaction from "../../../../models/WalletTransaction";
import WithdrawalRequest from "../../../../models/WithdrawalRequest";
import { apiRequirePermission } from "../../../../lib/auth/guards";
import { getSettings } from "../../../../lib/settings";

/**
 * Reviewer withdrawal requests. Guarded by reward:withdraw, scoped to the
 * session user.
 *
 * POST also saves/updates the reviewer's bank details — the form always
 * shows the last-saved details pre-filled, so a reviewer can either reuse
 * them as-is or edit them, and either way this call is what persists them
 * for next time. The withdrawal amount is deducted from the wallet
 * IMMEDIATELY (a hold), not on admin approval — see the model comment for why.
 *
 * GET  → this reviewer's own request history.
 * POST → create a request { amount, accountHolderName, accountNumber, ifsc }.
 */
const createSchema = z
  .object({
    amount: z.number().int().min(1).max(1_000_000),
    accountHolderName: z.string().trim().min(1, "Account holder name is required").max(120),
    accountNumber: z.string().trim().min(1, "Account number is required").max(30),
    ifsc: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Enter a valid IFSC code"),
  })
  .strict();

export async function GET() {
  const { user, response } = await apiRequirePermission("reward:withdraw");
  if (response) return response;

  await dbConnect();
  const requests = await WithdrawalRequest.find({ reviewer: user.id }).sort({ createdAt: -1 }).lean();

  return Response.json({
    requests: requests.map((r) => ({
      id: String(r._id),
      amount: r.amount,
      status: r.status,
      accountNumber: r.accountNumber,
      ifsc: r.ifsc,
      rejectionReason: r.rejectionReason,
      createdAt: r.createdAt,
      reviewedAt: r.reviewedAt,
    })),
  });
}

export async function POST(request) {
  const { user, response } = await apiRequirePermission("reward:withdraw");
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const { amount, accountHolderName, accountNumber, ifsc } = parsed.data;

  await dbConnect();

  // Admin-controlled floor (Pricing control), not a hardcoded constant — a
  // reviewer requesting below it gets a clear, specific error instead of the
  // request just silently failing the schema's static min.
  const { minWithdrawal } = await getSettings();
  if (amount < minWithdrawal) {
    return Response.json(
      { error: `Minimum withdrawal is ₹${minWithdrawal}.` },
      { status: 400 }
    );
  }

  // A reviewer with an unresolved request can't stack another one on top of
  // it — keeps "how much do I have pending" answerable with a single glance,
  // and avoids needing to reconcile N simultaneous holds against one balance.
  const existingPending = await WithdrawalRequest.exists({ reviewer: user.id, status: "pending" });
  if (existingPending) {
    return Response.json(
      { error: "You already have a withdrawal request awaiting review." },
      { status: 409 }
    );
  }

  // Atomic hold: only succeeds if the balance actually covers it. Also
  // persists the bank details for next time in the same update.
  const debited = await User.findOneAndUpdate(
    { _id: user.id, walletBalance: { $gte: amount } },
    {
      $inc: { walletBalance: -amount },
      $set: { bankAccountHolder: accountHolderName, bankAccountNumber: accountNumber, bankIfsc: ifsc },
    },
    { returnDocument: "after" }
  ).select("walletBalance");

  if (!debited) {
    return Response.json(
      { error: "Insufficient wallet balance for this amount." },
      { status: 400 }
    );
  }

  const reqDoc = await WithdrawalRequest.create({
    reviewer: user.id,
    amount,
    accountHolderName,
    accountNumber,
    ifsc,
  });

  await WalletTransaction.create({
    user: user.id,
    amount: -amount,
    type: "withdrawal",
    note: "Withdrawal requested",
    balanceAfter: debited.walletBalance,
  });

  return Response.json({ ok: true, id: String(reqDoc._id), balance: debited.walletBalance });
}
