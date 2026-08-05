import PolicyPage from "../../components/site/PolicyPage";

export const metadata = {
  title: "Privacy policy — RapportLook",
  description:
    "How RapportLook collects, uses, and protects data from businesses and reviewers on the platform.",
  keywords: ["RapportLook privacy policy", "data protection", "review platform privacy"],
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "Privacy policy — RapportLook",
    description:
      "How RapportLook collects, uses, and protects data from businesses and reviewers on the platform.",
    url: "/privacy",
  },
};

const SECTIONS = [
  {
    heading: "1. What we collect",
    body: [
      "We collect the information you give us directly — account details, business profile information, review campaign settings, and reward/payout details — plus information generated as you use the platform.",
    ],
    list: [
      "Account data: name, email, phone number, password hash, role (business or reviewer).",
      "Business data: company name, billing details, review platform links, wallet and campaign activity.",
      "Reviewer verification data: screenshot proof submitted for a campaign, device fingerprint, and IP address, used only to confirm genuine participation.",
      "Usage data: pages visited, actions taken in the dashboard, and log/diagnostic data for security and reliability.",
    ],
  },
  {
    heading: "2. How we use it",
    body: [
      "Data is used to operate the platform: creating and running review campaigns, verifying that a review submission is genuine, crediting reviewer rewards, processing business billing, and keeping the service secure.",
      "We never use reviewer data to alter, filter, or gate a review based on its rating — verification checks that a submission is real, not what it says.",
    ],
  },
  {
    heading: "3. Sharing",
    body: [
      "We do not sell personal data. Information is shared only with service providers that help us run the platform (payments, hosting, email delivery), and only to the extent needed for that service, under contractual confidentiality.",
      "We may disclose data if required by law or to protect the rights, safety, or property of RapportLook, our users, or the public.",
    ],
  },
  {
    heading: "4. Data retention & security",
    body: [
      "We retain account and campaign data for as long as an account is active, plus a reasonable period afterward for legal and accounting purposes. Verification artifacts (e.g. screenshots) are retained only as long as needed to resolve disputes.",
      "We use industry-standard safeguards — encryption in transit, access controls, and audit logging — to protect data against unauthorized access.",
    ],
  },
  {
    heading: "5. Your rights",
    body: [
      "You can access, correct, or request deletion of your personal data at any time from your account settings, or by contacting us at the address below. Some data may be retained where required by law or for legitimate business records.",
    ],
  },
  {
    heading: "6. Contact",
    body: [
      "Questions about this policy can be sent through our contact page or to the email listed there. We'll respond within a reasonable time.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <PolicyPage
      title="Privacy policy"
      updated="5 August 2026"
      intro="This policy explains what data RapportLook collects from businesses and reviewers, why we collect it, and how it's protected."
      sections={SECTIONS}
    />
  );
}
