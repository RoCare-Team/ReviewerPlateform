import PolicyPage from "../../components/site/PolicyPage";

export const metadata = {
  title: "Terms & conditions — ReviewHub",
  description:
    "The terms that govern use of ReviewHub by businesses running review campaigns and reviewers submitting verified participation.",
  alternates: { canonical: "/terms" },
  openGraph: {
    title: "Terms & conditions — ReviewHub",
    description:
      "The terms that govern use of ReviewHub by businesses running review campaigns and reviewers submitting verified participation.",
    url: "/terms",
  },
};

const SECTIONS = [
  {
    heading: "1. Acceptance",
    body: [
      "By creating an account or using ReviewHub, you agree to these terms. If you're using ReviewHub on behalf of a business, you confirm you have authority to bind that business to this agreement.",
    ],
  },
  {
    heading: "2. What ReviewHub is",
    body: [
      "ReviewHub is a review and reputation management platform. Businesses fund campaigns from a wallet; reviewers are rewarded for verified participation — submitting proof that they genuinely used a business and left a review on a supported platform.",
      "Rewards are never conditioned on a review being positive. We do not buy, sell, write, or edit reviews on behalf of any business.",
    ],
  },
  {
    heading: "3. Business accounts",
    body: [
      "Businesses must provide accurate billing and campaign information, fund campaigns before launching them, and use ReviewHub only to solicit genuine reviews from real customers.",
    ],
    list: [
      "No incentivizing reviewers to leave a specific rating or hide negative feedback.",
      "No submitting fake business listings or review links you don't control.",
      "No attempting to reverse-engineer or bypass reviewer verification.",
    ],
  },
  {
    heading: "4. Reviewer accounts",
    body: [
      "Reviewers must submit genuine proof of participation — screenshots and device data are checked by our verification system before a reward is credited.",
    ],
    list: [
      "No submitting fabricated, duplicated, or reused screenshots.",
      "No using multiple accounts, bots, or automation to farm rewards.",
      "Honest negative reviews are rewarded exactly the same as positive ones.",
    ],
  },
  {
    heading: "5. Payments & rewards",
    body: [
      "Business wallet funds are used to pay campaign costs and reviewer rewards. Wallet funds are non-transferable between accounts. Reviewer rewards are credited only after a submission passes verification, and are subject to the refund policy for any disputed transaction.",
    ],
  },
  {
    heading: "6. Suspension & termination",
    body: [
      "We may suspend or terminate an account that violates these terms, submits fraudulent verification data, or attempts to manipulate reviews or rewards. We'll make reasonable efforts to notify you before doing so, except where immediate action is needed to prevent abuse.",
    ],
  },
  {
    heading: "7. Liability",
    body: [
      "ReviewHub is provided as-is. We aren't liable for third-party review platform policy changes, account actions taken by Google, Trustpilot or similar platforms, or indirect losses arising from use of the service.",
    ],
  },
  {
    heading: "8. Changes to these terms",
    body: [
      "We may update these terms from time to time. Material changes will be posted on this page with an updated date; continued use after a change means you accept the update.",
    ],
  },
];

export default function TermsPage() {
  return (
    <PolicyPage
      title="Terms & conditions"
      updated="5 August 2026"
      intro="These terms govern how businesses and reviewers use ReviewHub — please read them before running a campaign or submitting a review."
      sections={SECTIONS}
    />
  );
}
