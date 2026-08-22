/**
 * AI-drafted review texts for a campaign's reviewers to copy into their own
 * review — same "raw fetch, no SDK" style as src/lib/aiVerification.js and
 * src/lib/aiReply.js, reusing OPENAI_API_KEY.
 *
 * NOTE ON POLICY: this is a deliberate product decision, made explicitly
 * against the platform's usual "reviewers write their own words, nothing is
 * scripted" stance (see the copy in components/site/HowItProfits.jsx and the
 * compliance note in data/roles.json). Handing out fully pre-written review
 * text for verbatim posting carries real risk — Google and other platforms
 * can detect near-identical/AI-patterned reviews across a listing and
 * suspend it. This module exists because the business owner explicitly
 * asked for it; each generated review is prompted to be structurally and
 * stylistically distinct from the others in the same batch specifically to
 * reduce (never eliminate) that detection risk.
 */
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = "gpt-4o-mini";

export function aiReviewDraftsConfigured() {
  return Boolean(OPENAI_API_KEY);
}

const PLATFORM_LABEL = {
  google: "Google",
  trustpilot: "Trustpilot",
  capterra: "Capterra",
  amazon: "Amazon",
  playstore: "Google Play Store",
};

/**
 * Returns an array of distinct review texts, or [] if generation isn't
 * possible (no API key, network/API failure, unusable response) — the
 * caller treats an empty result as "no drafts available", never an error
 * that blocks campaign creation.
 *
 * Two modes:
 *  - `keywords` given (from lib/aiKeywords.js, after the owner picked which
 *    ones to use): writes exactly one review per keyword, IN ORDER, each one
 *    built around that specific phrase — so reviewDrafts[i] is guaranteed to
 *    be about keywords[i], never a mismatched/unrelated pairing.
 *  - `keywords` omitted, plain `count`: same as before, each review picks
 *    its own local-search phrase freely (used when the owner skips the
 *    keyword-picking step and just asks for reviews directly).
 */
export async function generateReviewDrafts({ businessName, platform, notes, category, keywords, count }) {
  const n = keywords?.length ? keywords.length : Math.max(1, Math.min(50, Math.floor(Number(count) || 0)));
  if (!aiReviewDraftsConfigured() || n < 1) return [];

  const platformLabel = PLATFORM_LABEL[platform] || platform || "the listing";
  const prompt = [
    `Write ${n} short, positive customer reviews for "${businessName || "this business"}" to be posted on ${platformLabel}.`,
    category ? `This business's Google category is "${category}".` : "",
    notes ? `Context about the business: ${notes}` : "",
    ``,
    `Each review must be 1-3 sentences, sound like a genuine different customer wrote it, and read naturally — no corporate tone, no repeated sentence structures.`,
    keywords?.length
      ? [
          `Here are ${n} local-search phrases, one assigned per review, IN THIS ORDER:`,
          keywords.map((k, i) => `${i + 1}. "${k}"`).join("\n"),
          `Write review #i so it naturally works in phrase #i — worded as something a real customer would actually say ("found the best ${keywords[0]}", "my go-to spot"), never as a bare keyword dropped in. Each review uses ONLY its own assigned phrase, not any other review's.`,
        ].join("\n")
      : category || businessName
        ? [
            `First, work out the short local-search terms a real customer would type into Google to find this exact kind of business — the way people actually search Google Maps/Search, e.g. "<service> near me", "best <service> in <area>", "<service> repair near me", "<product/service> shop near me". Base it on the business name and category ("${businessName || ""}"${category ? `, category: "${category}"` : ""}) — e.g. an "RO Care India" / water-purifier-service business implies terms like "RO service near me", "RO repair near me", "water purifier service near me"; a bakery implies "bakery near me", "fresh cake shop near me".`,
            `Naturally weave ONE such local-search phrase into each review — worded as something a real customer would actually say ("found the best RO service near me", "my go-to RO repair near me"), never as a bare keyword dropped in. Use a DIFFERENT phrase in each review across the batch, don't repeat the same one twice.`,
          ].join(" ")
        : "",
    `Make every one of the ${n} reviews clearly different from the others: vary the length, the opening words, the specific thing praised, and the phrasing. Do not reuse the same adjectives or sentence patterns across reviews.`,
    `Never invent specific claims that could be false or misleading (no fake staff names, no fabricated incidents, no specific dates/prices).`,
    `No emojis, no hashtags, no exclamation-mark overload (at most one "!" per review).`,
    ``,
    `Respond with ONLY a JSON object: {"reviews": ["review 1", "review 2", ...]} with exactly ${n} items, in the same order as ${keywords?.length ? "the numbered phrases" : "listed"} above.`,
  ]
    .filter(Boolean)
    .join("\n");

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
        temperature: 0.9, // higher than the other AI helpers — variety across the batch is the whole point
        max_tokens: 200 * n,
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

  if (!Array.isArray(parsed.reviews)) return [];
  return parsed.reviews
    .filter((r) => typeof r === "string" && r.trim())
    .map((r) => r.trim().slice(0, 1000))
    .slice(0, n);
}
