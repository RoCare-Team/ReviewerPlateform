/**
 * AI-generated replies to Google Business Profile reviews — same "raw fetch,
 * no SDK" style as src/lib/aiVerification.js, reusing OPENAI_API_KEY.
 *
 * Used by the auto-reply cron (src/app/api/cron/gmb-auto-reply) to draft a
 * short, on-brand reply for a newly synced review that has no reply yet.
 */
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = "gpt-4o-mini";

export function aiReplyConfigured() {
  return Boolean(OPENAI_API_KEY);
}

/**
 * Returns a reply string (never empty, trimmed to Google's practical length)
 * or null if generation isn't possible (no API key, network/API failure, or
 * an empty/unusable response) — the caller should just skip that review and
 * let the next cron run retry it.
 */
export async function generateReviewReply({ businessName, reviewerName, starRating, comment }) {
  if (!aiReplyConfigured()) return null;

  const prompt = [
    `You are replying, on behalf of the business "${businessName || "our business"}", to a customer review on Google.`,
    `Reviewer: ${reviewerName || "a customer"}`,
    `Star rating: ${starRating || "unknown"} out of 5`,
    `Review text: ${comment ? `"${comment}"` : "(no text, rating only)"}`,
    ``,
    `Write a short, warm, genuine-sounding reply (1-3 sentences, under 400 characters).`,
    `Thank them by first name if given. For 4-5 star reviews, express gratitude and invite them back.`,
    `For 1-3 star reviews, apologize sincerely, avoid being defensive, and briefly invite them to reach out privately to resolve it — don't invent specifics you don't know.`,
    `Never make promises (refunds, compensation) or invent details about what happened.`,
    `Do not use emojis or exclamation-heavy language. Sound like a real person, not a template.`,
    ``,
    `Respond with ONLY a JSON object: {"reply": "the reply text"}`,
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
        temperature: 0.6,
        max_tokens: 200,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch {
    return null;
  }

  if (!res.ok) return null;

  const data = await res.json().catch(() => null);
  const raw = data?.choices?.[0]?.message?.content;
  if (!raw) return null;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  const reply = typeof parsed.reply === "string" ? parsed.reply.trim() : "";
  if (!reply) return null;

  return reply.slice(0, 1500); // Google enforces its own cap; keep a generous margin
}
