import { z } from "zod";
import { apiRequirePermission } from "../../../../../lib/auth/guards";
import { createTopupOrder } from "../../../../../lib/razorpay";
import { getSettings } from "../../../../../lib/settings";

/**
 * Step 1 of a wallet top-up: create a Razorpay order for the amount the
 * business wants to add. Nothing is credited here — the wallet only moves
 * once the payment is captured and verified (see ./verify/route.js).
 *
 * Minimum amount is the admin-controlled Pricing setting (minTopup), not a
 * hardcoded constant — same pattern as reviewer withdrawals' minWithdrawal.
 */
const schema = z
  .object({ amount: z.number().int().min(1).max(500_000) })
  .strict();

export async function POST(request) {
  const { user, response } = await apiRequirePermission("wallet:topup");
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Enter a valid amount, up to ₹5,00,000." }, { status: 400 });
  }

  const { minTopup } = await getSettings();
  if (parsed.data.amount < minTopup) {
    return Response.json({ error: `Minimum top-up is ₹${minTopup}.` }, { status: 400 });
  }

  try {
    const order = await createTopupOrder({
      amount: parsed.data.amount,
      // Razorpay caps `receipt` at 40 chars — userId(24) + timestamp in
      // base36 keeps this well under that even with the separators.
      receipt: `tu_${user.id}_${Date.now().toString(36)}`,
      notes: { userId: user.id },
    });
    return Response.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error("razorpay order create failed:", err);
    return Response.json({ error: "Couldn't start the payment. Try again in a moment." }, { status: 502 });
  }
}
