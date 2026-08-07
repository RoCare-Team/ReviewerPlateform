/**
 * SEED data only — run `node --env-file=.env.local scripts/seed-blog.js` to
 * load these into MongoDB once. The live site (/blog, /blog/[slug], and
 * /admin/blog) reads exclusively from the BlogPost collection via
 * src/lib/blog.js — this file is not imported by any page anymore. Posts are
 * authored from /admin/blog going forward, not by editing this array.
 *
 * `content` is a block list (heading/body/list), matching the BlogPost.content
 * schema exactly — that's what keeps rendering (and its SEO/JSON-LD) fully
 * under our control with zero markdown/HTML rendering dependency.
 *
 * Compliance note (see src/app/page.jsx copy note): nothing here may imply a
 * review can be bought, gated on rating, or filtered by sentiment. Every post
 * that touches incentives stays on the "verified participation" line.
 */

export const POSTS = [
  {
    slug: "verified-reviews-vs-bought-reviews",
    title: "Verified Reviews vs. Bought Reviews: Why the Difference Matters",
    description:
      "Bought reviews get accounts banned and erode customer trust. Here's why verified participation is the only review strategy that actually holds up.",
    excerpt:
      "Paying for positive ratings feels like a shortcut — until the platform notices. Here's what actually separates a defensible review strategy from a risky one.",
    category: "Reputation management",
    tags: ["verified reviews", "review policy", "trust"],
    publishedAt: "2026-02-10",
    updatedAt: "2026-02-10",
    author: "RapportLook Team",
    readMinutes: 6,
    content: [
      {
        body: [
          "Every review platform — Google, Trustpilot, the Play Store, G2 — has the same rule buried in its terms: you cannot pay for a review, and you cannot condition a reward on what the review says. Businesses break this rule constantly, usually without realizing how easy it is to get caught, and how expensive getting caught actually is.",
        ],
      },
      {
        heading: "What \"bought\" actually means to a platform",
        body: [
          "Platforms don't need a smoking gun to act. Sudden review velocity spikes, a cluster of five-star ratings with near-identical phrasing, or reviewer accounts with no other activity are all signals that trigger automated review filtering — and in serious cases, listing suspension.",
          "The damage isn't just the removed reviews. A suspended Google Business Profile listing can take weeks to reinstate, during which the business is effectively invisible in local search. For a business relying on foot traffic or local search leads, that's not a minor setback.",
        ],
      },
      {
        heading: "What verified participation looks like instead",
        body: [
          "The alternative isn't \"don't ask customers for reviews\" — asking is fine, and encouraged by every platform. The distinction is what you're rewarding.",
          "Rewarding someone for leaving any review, verified as genuine, is compliant. Rewarding someone specifically for a 5-star review, or hiding a reward until you've confirmed the rating, is not. The reward has to be for participation — proof that a real customer did a real thing — never for the sentiment of what they wrote.",
        ],
        list: [
          "Screenshot or receipt verification confirms the interaction happened",
          "The reward is fixed regardless of star rating",
          "Negative reviews are never filtered, hidden, or discouraged",
        ],
      },
      {
        heading: "The trust compounding effect",
        body: [
          "There's a second cost to bought reviews that's easy to underestimate: customers can tell. A page of suspiciously uniform five-star reviews reads as manufactured, and it undermines the ratings that actually are genuine. A 4.6 average built from real, verified, occasionally critical feedback is more persuasive — and more durable — than a fragile 5.0 that collapses the first time a platform runs a review-authenticity sweep.",
        ],
      },
    ],
  },
  {
    slug: "google-review-policy-guide",
    title: "Google Review Policy: What's Allowed and What Gets You Suspended",
    description:
      "A plain-language breakdown of Google's review policies — what incentivizing reviews actually means, and the mistakes that get business listings suspended.",
    excerpt:
      "Google's review policy is short, but the ways businesses accidentally violate it are not. Here's what's actually allowed.",
    category: "Platform policy",
    tags: ["Google reviews", "Google Business Profile", "compliance"],
    publishedAt: "2026-03-04",
    updatedAt: "2026-03-04",
    author: "RapportLook Team",
    readMinutes: 7,
    content: [
      {
        body: [
          "Google's review policy fits in a few short paragraphs, but the number of businesses that unknowingly violate it is enormous — because the violations are usually well-intentioned. Nobody sets out to \"buy fake reviews\"; they set out to \"encourage happy customers to leave feedback,\" and cross a line they didn't know existed.",
        ],
      },
      {
        heading: "What's explicitly not allowed",
        list: [
          "Offering money, discounts, or free products in exchange for a review",
          "Offering a reward only if the review is positive, or only after checking the rating",
          "Asking employees, friends, or family to post reviews for the business",
          "Reviewing your own business, or a competitor's, from a personal or affiliated account",
          "Posting reviews in bulk from the same device, network, or account cluster",
        ],
      },
      {
        heading: "What's explicitly allowed",
        list: [
          "Asking customers to leave a review, with no reward attached",
          "Sending a follow-up email or SMS with a direct review link",
          "Displaying a QR code or review-link card at checkout",
          "Rewarding customers for verified participation in a feedback program — as long as the reward is not conditioned on rating or content",
        ],
      },
      {
        heading: "The gray area: incentivized-but-compliant programs",
        body: [
          "This is where most legitimate review-collection tools live, and where the line is easiest to blur. A program is compliant when the reward is for proof of genuine participation — a screenshot, a verified purchase, a confirmed interaction — and the reward amount and eligibility never change based on what the review says.",
          "The moment a business filters submissions by star rating before paying out, or offers a bigger reward for five stars than for three, the program crosses from \"encouraging reviews\" into \"buying ratings\" — even if no one explicitly says so out loud.",
        ],
      },
      {
        heading: "If a listing gets suspended",
        body: [
          "Google's process for reinstatement requires demonstrating the violation has stopped and won't recur — removing any incentive language tied to ratings, and in some cases, requesting a review of the flagged reviews individually. It's a slow process, and prevention is far cheaper than the appeal.",
        ],
      },
    ],
  },
  {
    slug: "how-review-verification-works",
    title: "How Review Verification Actually Works",
    description:
      "From screenshot proof to AI-assisted checks: a look at how legitimate review verification confirms a submission is real before any reward is paid out.",
    excerpt:
      "Verification is the difference between a review program that holds up and one that gets flagged. Here's what actually happens behind the scenes.",
    category: "Product",
    tags: ["verification", "AI review checks", "how it works"],
    publishedAt: "2026-04-18",
    updatedAt: "2026-04-18",
    author: "RapportLook Team",
    readMinutes: 5,
    content: [
      {
        body: [
          "\"Verified\" gets used loosely across the review-collection industry, so it's worth being specific about what it should mean: a reviewer submitted evidence a human (or an automated check) confirmed as a genuine interaction, before anything was paid out or counted.",
        ],
      },
      {
        heading: "Step 1: proof of the interaction",
        body: [
          "The reviewer submits a screenshot of the posted review, alongside context — which platform, which listing, and the review itself. This is the baseline evidence that a review actually exists and was actually posted, not just claimed.",
        ],
      },
      {
        heading: "Step 2: automated checks",
        body: [
          "Screenshots are screened for tampering signals, duplicate submissions, and consistency with the claimed platform and listing. Device and network signals help catch bulk submission attempts — the same pattern platforms themselves watch for.",
        ],
      },
      {
        heading: "Step 3: decision, independent of sentiment",
        body: [
          "This is the part that keeps a program compliant: the verification decision checks whether the submission is genuine, never what the review says. A confirmed one-star review and a confirmed five-star review pass verification on identical terms. If a program's approval rate quietly correlates with star rating, that's not verification — that's filtering, and it's the exact behavior platforms penalize.",
        ],
      },
      {
        heading: "Why this matters for the business, not just the platform",
        body: [
          "A verification layer isn't just about staying inside platform rules. It's what makes the resulting review data trustworthy enough to act on — a business can look at its verified review trends and know they reflect real customers, not a handful of enthusiastic insiders or a burst of incentivized noise.",
        ],
      },
    ],
  },
  {
    slug: "small-business-reputation-checklist",
    title: "A Small Business Reputation Management Checklist",
    description:
      "A practical checklist for small businesses managing online reputation across Google, Trustpilot, and other review platforms — without cutting compliance corners.",
    excerpt:
      "Reputation management for a small business doesn't need a big budget — it needs consistency. Here's a checklist to work through.",
    category: "Guides",
    tags: ["small business", "reputation management", "checklist"],
    publishedAt: "2026-05-22",
    updatedAt: "2026-05-22",
    author: "RapportLook Team",
    readMinutes: 6,
    content: [
      {
        body: [
          "Reputation management sounds like an enterprise problem, but most of it is small, consistent habits — the kind any business can run without a dedicated team.",
        ],
      },
      {
        heading: "Claim and complete every listing",
        list: [
          "Google Business Profile — verify ownership, fill in hours, categories, and photos",
          "Trustpilot, G2, or category-relevant platforms your customers actually use",
          "Keep name, address, and phone number identical across every listing — inconsistency hurts local search ranking",
        ],
      },
      {
        heading: "Make leaving a review effortless",
        body: [
          "The single biggest lever for review volume isn't asking harder — it's removing friction. A direct review link (not a search-and-find), sent at the right moment (right after a good interaction, not three weeks later), outperforms almost any other tactic.",
        ],
      },
      {
        heading: "Reply to every review — especially the negative ones",
        body: [
          "An unanswered negative review reads as unresolved. A thoughtful, non-defensive reply — acknowledging the issue and stating what was done about it — is read by every future customer who sees that review, not just the one who wrote it.",
        ],
      },
      {
        heading: "Never filter, gate, or selectively request reviews",
        body: [
          "It's tempting to only ask customers you're confident are happy. This is a policy violation risk (see our Google review policy guide) and, more practically, it produces a rating that doesn't reflect reality — which erodes trust the moment a less flattering review inevitably appears.",
        ],
      },
      {
        heading: "Track trends, not just the average",
        body: [
          "A single low rating means less than a downward trend across several. Reviewing verified feedback monthly — not just reacting to the latest one-star review — is what turns review data into an actual improvement loop instead of noise.",
        ],
      },
    ],
  },
  {
    slug: "where-to-collect-reviews-first",
    title: "Google vs. Trustpilot vs. Play Store: Where Should You Collect Reviews First?",
    description:
      "Not every review platform matters equally for every business. A breakdown of where to focus review collection first, based on business type.",
    excerpt:
      "Trying to collect reviews everywhere at once dilutes the effort. Here's how to prioritize by business type.",
    category: "Guides",
    tags: ["Google reviews", "Trustpilot", "Play Store", "strategy"],
    publishedAt: "2026-06-30",
    updatedAt: "2026-06-30",
    author: "RapportLook Team",
    readMinutes: 5,
    content: [
      {
        body: [
          "\"Collect reviews everywhere\" is easy advice and hard to execute well. Spreading a small review-collection effort across six platforms usually means none of them build up a meaningful, trustworthy volume. Prioritizing gets better results faster.",
        ],
      },
      {
        heading: "Local, brick-and-mortar businesses → Google first",
        body: [
          "If customers find you through local search or Google Maps, Google Business Profile reviews are the highest-leverage place to focus. Review count and rating directly influence local pack ranking — arguably more than any other single factor a small business can control.",
        ],
      },
      {
        heading: "B2B SaaS and services → G2, Capterra, Trustpilot",
        body: [
          "Buyers evaluating software or professional services lean on category-specific platforms during vendor comparison, not general search. A strong G2 or Capterra profile shows up directly in the moment a prospect is deciding between you and a competitor.",
        ],
      },
      {
        heading: "Consumer apps → Play Store and App Store",
        body: [
          "For an app, store reviews aren't just social proof — they're a ranking input for store search and a factor in featured placement. A low rating or review count can suppress discoverability regardless of how good the app actually is.",
        ],
      },
      {
        heading: "E-commerce → Trustpilot plus platform-native reviews",
        body: [
          "Shoppers weigh both store-level trust (Trustpilot, Google Shopping ratings) and product-level reviews (on the product page itself). Store-level trust matters most before the first purchase; product reviews matter most for repeat and comparison purchases.",
        ],
      },
      {
        heading: "The mistake to avoid",
        body: [
          "Whichever platform you prioritize, the same rule applies everywhere: reward verified participation, never a rating. A strong Google profile built on bought reviews is a liability with a delay timer on it, not an asset.",
        ],
      },
    ],
  },
];
