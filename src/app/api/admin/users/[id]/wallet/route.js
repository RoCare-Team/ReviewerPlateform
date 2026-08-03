import mongoose from "mongoose";
import { z } from "zod";
import dbConnect from "../../../../../../lib/db";
import User from "../../../../../../models/User";
import WalletTransaction from "../../../../../../models/WalletTransaction";
import { apiRequireAdmin } from "../../../../../../lib/auth/guards";
import { ROLES } from "../../../../../../lib/auth/roles";

/**
 * Admin wallet credit: an admin adds funds to a BUSINESS owner's wallet.
 *
 * This is the one place in the app where one account moves another account's
 * money, so it is deliberately narrow:
 *   - admin session required (re-checked here, never trusted from middleware)
 *   - target must be an active business_owner — reviewers earn from verified
 *     work only, and hand-crediting a reviewer would be paying for reviews
 *   - credits only; no debit path, so a mistake can't silently drain someone
 *   - every credit writes a ledger row stamped with the acting admin (`by`)
 *
 * POST /api/admin/users/[id]/wallet  { amount, note? }
 */
const schema = z
  .object({
    // Whole rupees. The cap is a blast-radius limit on a typo, not a policy —
    // a real ₹50,00,000 top-up should be several deliberate entries.
    amount: z.number().int().positive().max(1_000_000),
    note: z.string().trim().max(200).optional(),
  })
  .strict();

export async function POST(request, { params }) {
  const { user: admin, response } = await apiRequireAdmin();
  if (response) return response;

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return Response.json({ error: "Invalid account." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Enter a valid amount (₹1 or more)." }, { status: 400 });
  }

  await dbConnect();

  // Atomic $inc AND the role/status check in one filter — a separate read-then-
  // write could credit an account that changed role in between.
  const updated = await User.findOneAndUpdate(
    { _id: id, role: ROLES.BUSINESS_OWNER, status: "active" },
    { $inc: { walletBalance: parsed.data.amount } },
    { returnDocument: "after" }
  ).select("name email walletBalance");

  if (!updated) {
    return Response.json(
      { error: "No active business account with that id." },
      { status: 404 }
    );
  }

  await WalletTransaction.create({
    user: updated._id,
    amount: parsed.data.amount,
    type: "topup",
    note: parsed.data.note || `Added by admin (${admin.email})`,
    balanceAfter: updated.walletBalance,
    by: admin.id,
  });

  return Response.json({ ok: true, balance: updated.walletBalance });
}
