import { z } from "zod";
import { apiRequirePermission } from "../../../../../lib/auth/guards";
import { generateKeywords, aiKeywordsConfigured } from "../../../../../lib/aiKeywords";

/**
 * Step 1 of the review-draft flow: suggest `count` local-search keyword
 * phrases (e.g. "RO service near me") for the campaign the owner is about to
 * create. Nothing is persisted — the owner picks which ones to keep
 * client-side, then POSTs the CHOSEN keywords to
 * /api/business/campaigns/suggest-reviews to get one full review per
 * keyword. See lib/aiKeywords.js.
 */
const schema = z.object({
  name: z.string().trim().max(120).optional().default(""),
  category: z.string().trim().max(120).optional().default(""),
  count: z.number().int().min(1).max(50),
});

export async function POST(request) {
  const { response } = await apiRequirePermission("campaign:create");
  if (response) return response;

  if (!aiKeywordsConfigured()) {
    return Response.json({ error: "AI keyword suggestions aren't configured on this server." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const keywords = await generateKeywords({
    businessName: parsed.data.name,
    category: parsed.data.category,
    count: parsed.data.count,
  });

  if (keywords.length === 0) {
    return Response.json({ error: "Couldn't generate keywords right now — try again." }, { status: 502 });
  }

  return Response.json({ ok: true, keywords });
}
