/**
 * AI review-screenshot verification via OpenAI vision (gpt-4o-mini) — no SDK
 * dependency, raw REST. Given a Cloudinary image URL, returns a structured
 * verdict the submissions route acts on automatically.
 *
 * Cost control: the image is requested from Cloudinary at a downscaled size
 * (w_1000,q_auto,f_auto) so fewer image tokens are billed, and max_tokens is
 * capped. One call per submission.
 */
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";

export function openaiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

/** Insert a downscale transformation into a Cloudinary delivery URL. */
function downscale(url) {
  if (typeof url !== "string" || !url.includes("/upload/")) return url;
  return url.replace("/upload/", "/upload/w_1000,q_auto,f_auto/");
}

const SYSTEM = `You verify screenshots that users submit as proof they left an online review for a business.
Judge ONLY what is visible in the image. Return STRICT JSON, no prose.`;

function buildPrompt({ platform, businessName }) {
  return `This screenshot should show a review the user posted${
    platform ? ` on ${platform}` : ""
  }${businessName ? ` for "${businessName}"` : ""}.

Return JSON with exactly these keys:
{
  "isReviewScreenshot": boolean,   // is this genuinely a screenshot of a review/rating UI?
  "platformMatch": boolean,        // does it look like the expected platform (or unknown=true if unsure)?
  "starsVisible": boolean,         // are star ratings visible?
  "rating": number,                // 0-5, 0 if not visible
  "hasReviewText": boolean,        // is there written review text?
  "suspicious": boolean,           // signs of editing, fake, screenshot-of-screenshot, or unrelated image
  "decision": "approve" | "reject",// approve ONLY if it is a real review screenshot with text and not suspicious
  "confidence": number,            // 0.0-1.0
  "reason": string                 // one short sentence
}`;
}

/**
 * @returns {Promise<{decision:'approve'|'reject'|'uncertain', confidence:number, reason:string, rating:number}>}
 */
export async function verifyReviewScreenshot({ imageUrl, platform, businessName }) {
  if (!openaiConfigured()) {
    return { decision: "uncertain", confidence: 0, reason: "AI not configured", rating: 0 };
  }

  const body = {
    model: MODEL,
    max_tokens: 300,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: [
          { type: "text", text: buildPrompt({ platform, businessName }) },
          { type: "image_url", image_url: { url: downscale(imageUrl), detail: "auto" } },
        ],
      },
    ],
  };

  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text();
      return { decision: "uncertain", confidence: 0, reason: `AI error ${res.status}: ${t.slice(0, 120)}`, rating: 0 };
    }
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content ?? "{}";
    const v = JSON.parse(raw);

    const approve = v.decision === "approve" && v.isReviewScreenshot && v.hasReviewText && !v.suspicious;
    return {
      decision: approve ? "approve" : "reject",
      confidence: typeof v.confidence === "number" ? v.confidence : 0,
      reason: String(v.reason ?? "").slice(0, 200) || (approve ? "Looks like a genuine review." : "Not a valid review screenshot."),
      rating: typeof v.rating === "number" ? v.rating : 0,
    };
  } catch (e) {
    return { decision: "uncertain", confidence: 0, reason: `AI failed: ${String(e.message).slice(0, 120)}`, rating: 0 };
  }
}
