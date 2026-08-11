import { z } from "zod";
import { apiRequirePermission } from "../../../../../lib/auth/guards";
import { generateReviewDrafts, aiReviewDraftsConfigured } from "../../../../../lib/aiReviewDrafts";

/**
 * Draft `count` AI-written reviews for the campaign the owner is about to
 * create — used by NewCampaignModal's "Suggest reviews" button, before the
 * campaign exists. Nothing is persisted here; the owner reviews/edits the
 * list client-side and the final set is only saved when the campaign itself
 * is created (POST /api/business/campaigns, field `reviewDrafts`).
 */
const schema = z.object({
  name: z.string().trim().max(120).optional().default(""),
  platform: z.enum(["google", "trustpilot", "capterra", "amazon", "playstore"]).optional().default("google"),
  notes: z.string().trim().max(500).optional().default(""),
  // The business's own Google category (e.g. "Dental clinic"), synced from
  // GmbLocation.category — steers the AI toward business-relevant phrasing.
  category: z.string().trim().max(120).optional().default(""),
  count: z.number().int().min(1).max(50),
});

export async function POST(request) {
  const { response } = await apiRequirePermission("campaign:create");
  if (response) return response;

  if (!aiReviewDraftsConfigured()) {
    return Response.json({ error: "AI review drafting isn't configured on this server." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const reviews = await generateReviewDrafts({
    businessName: parsed.data.name,
    platform: parsed.data.platform,
    notes: parsed.data.notes,
    category: parsed.data.category,
    count: parsed.data.count,
  });

  if (reviews.length === 0) {
    return Response.json({ error: "Couldn't generate reviews right now — try again." }, { status: 502 });
  }

  return Response.json({ ok: true, reviews });
}
