import { z } from "zod";
import dbConnect from "../../../../../lib/db";
import { apiRequireAdmin } from "../../../../../lib/auth/guards";
import { approveReferral, rejectReferral } from "../../../../../lib/referral";

/**
 * Admin settles ONE referral by hand. `id` is the REFERRED user — the account
 * that signed up with someone's code — because that document is where the
 * whole referral lives (see models/User.js).
 *
 *   approve → credits the referrer's wallet at today's rate and writes the
 *             ledger entry, tagged with this admin. Used when the automatic
 *             install signal missed a genuine install: a build that doesn't
 *             announce itself (lib/clientPlatform.js) leaves a real app user
 *             recorded as "web only", and the referrer unpaid.
 *   reject  → marks it ineligible. Sticky: markAppInstall() skips rejected
 *             referrals, so it can't quietly pay itself later.
 *
 * Both are idempotent through the guards in lib/referral.js — a second click
 * on an already-credited referral is refused, never a double payout.
 */
const schema = z
  .object({
    action: z.enum(["approve", "reject"]),
    reason: z.string().trim().max(300).optional().default(""),
  })
  .strict();

export async function PATCH(request, { params }) {
  const { user: admin, response } = await apiRequireAdmin();
  if (response) return response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });

  await dbConnect();

  const result =
    parsed.data.action === "approve"
      ? await approveReferral(id, admin.id, parsed.data.reason)
      : await rejectReferral(id, admin.id, parsed.data.reason);

  if (!result.ok) return Response.json({ error: result.message }, { status: 400 });
  return Response.json({ ok: true });
}
