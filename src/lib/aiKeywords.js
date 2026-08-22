/**
 * Local-search keyword suggestions for a campaign — short phrases a real
 * customer would type into Google to find this exact business (e.g. "RO
 * service near me", "RO repair near me" for a water-purifier-service
 * business). Shown to the business owner to pick from BEFORE any review
 * text is generated — see aiReviewDrafts.js, which then writes one review
 * per CHOSEN keyword, guaranteeing every generated review is actually tied
 * to a keyword the owner approved rather than whatever the model felt like.
 * Same "raw fetch, no SDK" style as the other lib/ai*.js helpers.
 */
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = "gpt-4o-mini";

export function aiKeywordsConfigured() {
  return Boolean(OPENAI_API_KEY);
}

/**
 * Returns an array of up to `count` distinct local-search phrases, or [] if
 * generation isn't possible.
 */
export async function generateKeywords({ businessName, category, count }) {
  const n = Math.max(1, Math.min(50, Math.floor(Number(count) || 0)));
  if (!aiKeywordsConfigured() || n < 1) return [];

  const prompt = [
    `A business is named "${businessName || "this business"}"${category ? ` and its Google category is "${category}"` : ""}.`,
    `List ${n} short local-search phrases a real customer would type into Google Search or Maps to find this exact kind of business — the way people actually search, e.g. "<service> near me", "best <service> in <area>", "<service> repair near me", "<product> shop near me".`,
    `Base them on the business name and category — e.g. an "RO Care India" / water-purifier-service business implies phrases like "RO service near me", "RO repair near me", "water purifier service near me"; a bakery implies "bakery near me", "fresh cake shop near me", "birthday cake near me".`,
    `Each phrase must be 2-5 words. Make all ${n} phrases distinct from each other — vary the specific service/product and the phrasing, don't just swap one word.`,
    ``,
    `Respond with ONLY a JSON object: {"keywords": ["phrase 1", "phrase 2", ...]} with exactly ${n} items.`,
  ].join("\n");

  let res;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.8,
        max_tokens: 40 * n,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch {
    return [];
  }

  if (!res.ok) return [];

  const data = await res.json().catch(() => null);
  const raw = data?.choices?.[0]?.message?.content;
  if (!raw) return [];

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed.keywords)) return [];
  return parsed.keywords
    .filter((k) => typeof k === "string" && k.trim())
    .map((k) => k.trim().slice(0, 100))
    .slice(0, n);
}
