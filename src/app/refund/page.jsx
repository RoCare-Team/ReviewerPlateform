import PolicyPage from "../../components/site/PolicyPage";

export const metadata = {
  title: "Refund policy — RapportLook",
  description:
    "How wallet funds, campaign charges, and disputed verifications are refunded on RapportLook.",
  keywords: ["RapportLook refund policy", "wallet refund", "campaign charge dispute"],
  alternates: { canonical: "/refund" },
  openGraph: {
    title: "Refund policy — RapportLook",
    description:
      "How wallet funds, campaign charges, and disputed verifications are refunded on RapportLook.",
    url: "/refund",
  },
};

const SECTIONS = [
  {
    heading: "1. Wallet funds",
    body: [
      "Funds added to a business wallet are used to pay for campaign activity and reviewer rewards. Unused wallet balance can be refunded on request, minus any payment gateway fees already incurred, within 7 business days of the request.",
    ],
  },
  {
    heading: "2. Campaign charges",
    body: [
      "Charges are deducted from the wallet only when a reviewer submission passes verification and a reward is credited. If a submission fails verification, no charge is deducted — so businesses are never billed for unverified participation.",
    ],
  },
  {
    heading: "3. Disputed verifications",
    body: [
      "If a business believes a verified submission was fraudulent despite passing our checks, they can raise a dispute within 14 days of the charge from their dashboard. We'll review the verification evidence (screenshot, device, and IP data) and, if the dispute is upheld, refund the corresponding amount to the wallet.",
    ],
  },
  {
    heading: "4. Reviewer rewards",
    body: [
      "Reviewer rewards, once credited and paid out, are final. If a reward was credited in error due to a verification failure, we may reverse it and notify the reviewer, but this does not affect rewards already withdrawn in good faith.",
    ],
  },
  {
    heading: "5. Subscription plans",
    body: [
      "Paid plan fees are billed in advance and are non-refundable for the current billing cycle once the cycle has started, except where required by law. You can cancel anytime to stop future billing; your plan remains active until the end of the paid period.",
    ],
  },
  {
    heading: "6. How to request a refund",
    body: [
      "Refund requests can be raised from your account dashboard or by contacting us through the contact page. We aim to resolve all refund requests within 7–14 business days.",
    ],
  },
];

export default function RefundPage() {
  return (
    <PolicyPage
      title="Refund policy"
      updated="5 August 2026"
      intro="This policy covers how wallet funds, campaign charges, and disputed verifications are handled on RapportLook."
      sections={SECTIONS}
    />
  );
}
