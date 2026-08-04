import { z } from "zod";
import { getCurrentUser } from "../../../../lib/auth/session";
import { ROLES } from "../../../../lib/auth/roles";
import { getSettings, updateSettings } from "../../../../lib/settings";

/**
 * Admin-only global pricing control. Only an active admin may read/update.
 */
async function requireAdminApi() {
  const user = await getCurrentUser();
  if (!user || user.role !== ROLES.ADMIN || user.status !== "active") {
    return { user: null, response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { user, response: null };
}

const schema = z
  .object({
    reviewRate: z.number().int().positive().max(100000),
    reviewerReward: z.number().int().positive().max(100000),
    minWithdrawal: z.number().int().positive().max(100000),
  })
  .strict();

export async function GET() {
  const { response } = await requireAdminApi();
  if (response) return response;
  return Response.json(await getSettings());
}

export async function PATCH(request) {
  const { response } = await requireAdminApi();
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });

  if (parsed.data.reviewerReward > parsed.data.reviewRate) {
    return Response.json(
      { error: "Reviewer reward can't exceed the business review rate." },
      { status: 400 }
    );
  }

  const updated = await updateSettings(parsed.data);
  return Response.json({ ok: true, settings: updated });
}
