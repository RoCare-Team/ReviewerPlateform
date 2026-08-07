/**
 * AI verification of reviewer-submitted screenshots — no SDK, plain fetch to
 * OpenAI's vision-capable chat completions endpoint (same "raw fetch, no
 * dependency" style as src/lib/cloudinary.js). Given the uploaded screenshot
 * URL and the campaign it's supposed to prove a review for, asks the model
 * whether the screenshot genuinely shows a posted review on the right
 * platform/business.
 *
 * Without OPENAI_API_KEY configured, verification is skipped entirely and the
 * submission stays "pending" for manual admin review — this feature is
 * additive, never a hard requirement.
 */
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = "gpt-4o-mini";

export function aiVerificationConfigured() {
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
 * Returns { decision: "approve" | "reject" | "uncertain", confidence: 0..1, reason: string }.
 * Never throws — on any error (network, bad response, no API key) it returns
 * an "uncertain" verdict so the caller falls back to manual admin review.
 */
export async function verifyScreenshot(imageUrl, { campaignName, platform, businessName }) {
  if (!aiVerificationConfigured()) {
    return { decision: "uncertain", confidence: 0, reason: "AI verification not configured." };
  }

  const platformLabel = PLATFORM_LABEL[platform] || platform;
  const prompt = [
    `You are verifying proof-of-review screenshots for a review-collection platform.`,
    `The reviewer claims to have posted a review on ${platformLabel}${businessName ? ` for "${businessName}"` : ""} (campaign: "${campaignName}").`,
    ``,
    `Look at the attached screenshot and decide if it genuinely shows a review the reviewer posted on ${platformLabel} for this business.`,
    `Reject if: it's not a screenshot of ${platformLabel}, it doesn't show a posted review (e.g. just the write-a-review form, empty page), it's an obvious mock-up/edit, or it's for a clearly different business.`,
    `Approve only if you can clearly see a posted review (star rating and/or text) on ${platformLabel}, plausibly for this business.`,
    `If the image is ambiguous, low quality, or you're not confident either way, say uncertain — do not guess.`,
    ``,
    `Respond with ONLY a JSON object: {"decision": "approve" | "reject" | "uncertain", "confidence": number between 0 and 1, "reason": "one short sentence"}`,
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
        temperature: 0,
        max_tokens: 200,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
      }),
    });
  } catch (e) {
    return { decision: "uncertain", confidence: 0, reason: `AI verification unreachable: ${e.message}` };
  }

  if (!res.ok) {
    return { decision: "uncertain", confidence: 0, reason: `AI verification failed (${res.status}).` };
  }

  const data = await res.json().catch(() => null);
  const raw = data?.choices?.[0]?.message?.content;
  if (!raw) return { decision: "uncertain", confidence: 0, reason: "AI returned no verdict." };

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { decision: "uncertain", confidence: 0, reason: "AI returned an unparsable verdict." };
  }

  const decision = ["approve", "reject", "uncertain"].includes(parsed.decision) ? parsed.decision : "uncertain";
  const confidence = Number.isFinite(parsed.confidence) ? Math.max(0, Math.min(1, parsed.confidence)) : 0;
  const reason = typeof parsed.reason === "string" ? parsed.reason.slice(0, 300) : "";

  return { decision, confidence, reason };
}
