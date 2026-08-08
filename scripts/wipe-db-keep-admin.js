/**
 * DESTRUCTIVE. Empties every collection in the database EXCEPT admin User
 * documents (role: "admin") — those are left untouched, everyone else
 * (business owners, reviewers) and every other collection's data is deleted
 * permanently. No backup, no dry-run. Run only when you mean it:
 *
 *   node --env-file=.env.local scripts/wipe-db-keep-admin.js --yes
 *
 * The --yes flag is required — running it without a flag just prints what
 * WOULD be deleted (counts only) and exits, so a bare invocation can't nuke
 * anything by accident.
 */
import mongoose from "mongoose";

const CONFIRMED = process.argv.includes("--yes");

const { MONGODB_URI } = process.env;
if (!MONGODB_URI) {
  console.error("MONGODB_URI is not set. Is .env.local present?");
  process.exit(1);
}

// Import every real model so we hit the actual schemas/collection names, not
// guessed strings.
const [
  { default: User },
  { default: Role },
  { default: Otp },
  { default: Account },
  { default: GmbConnection },
  { default: GmbReview },
  { default: GmbLocation },
  { default: Contact },
  { default: WalletTransaction },
  { default: WithdrawalRequest },
  { default: AppSettings },
  { default: VerificationToken },
  { default: BlogPost },
  { default: Submission },
  { default: Claim },
  { default: Campaign },
] = await Promise.all([
  import("../src/models/User.js"),
  import("../src/models/Role.js"),
  import("../src/models/Otp.js"),
  import("../src/models/Account.js"),
  import("../src/models/GmbConnection.js"),
  import("../src/models/GmbReview.js"),
  import("../src/models/GmbLocation.js"),
  import("../src/models/Contact.js"),
  import("../src/models/WalletTransaction.js"),
  import("../src/models/WithdrawalRequest.js"),
  import("../src/models/AppSettings.js"),
  import("../src/models/VerificationToken.js"),
  import("../src/models/BlogPost.js"),
  import("../src/models/Submission.js"),
  import("../src/models/Claim.js"),
  import("../src/models/Campaign.js"),
]);

// Every collection wiped COMPLETELY — no filter, no survivors.
const WIPE_FULLY = {
  Role, Otp, Account, GmbConnection, GmbReview, GmbLocation, Contact,
  WalletTransaction, WithdrawalRequest, AppSettings, VerificationToken,
  BlogPost, Submission, Claim, Campaign,
};

await mongoose.connect(MONGODB_URI);

const nonAdminUsers = await User.countDocuments({ role: { $ne: "admin" } });
const adminUsers = await User.countDocuments({ role: "admin" });

console.log("This will permanently delete:");
console.log(`  User (non-admin): ${nonAdminUsers} document(s) — ${adminUsers} admin document(s) kept`);
for (const [name, Model] of Object.entries(WIPE_FULLY)) {
  const count = await Model.countDocuments({});
  console.log(`  ${name}: ${count} document(s)`);
}

if (!CONFIRMED) {
  console.log("\nDry run only — nothing deleted. Re-run with --yes to actually wipe.");
  await mongoose.disconnect();
  process.exit(0);
}

console.log("\nDeleting...");

const userResult = await User.deleteMany({ role: { $ne: "admin" } });
console.log(`  User: deleted ${userResult.deletedCount}`);

for (const [name, Model] of Object.entries(WIPE_FULLY)) {
  const result = await Model.deleteMany({});
  console.log(`  ${name}: deleted ${result.deletedCount}`);
}

console.log("\nDone. Only admin User document(s) remain; every other collection is empty.");

await mongoose.disconnect();
