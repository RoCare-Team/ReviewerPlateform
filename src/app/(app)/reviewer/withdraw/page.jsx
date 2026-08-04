import { requireRole } from "../../../../lib/auth/guards";
import { ROLES } from "../../../../lib/auth/roles";
import dbConnect from "../../../../lib/db";
import User from "../../../../models/User";
import WithdrawalRequest from "../../../../models/WithdrawalRequest";
import { getSettings, inr } from "../../../../lib/settings";
import WithdrawForm from "../../../../components/reviewer/WithdrawForm";

export const metadata = { title: "Withdraw · ReviewHub" };

export default async function ReviewerWithdrawPage() {
  const user = await requireRole(ROLES.REVIEWER);

  await dbConnect();
  const [me, requests, settings] = await Promise.all([
    User.findById(user.id).select("walletBalance bankAccountHolder bankAccountNumber bankIfsc").lean(),
    WithdrawalRequest.find({ reviewer: user.id }).sort({ createdAt: -1 }).lean(),
    getSettings(),
  ]);

  const hasPending = requests.some((r) => r.status === "pending");

  const history = requests.map((r) => ({
    id: String(r._id),
    amount: r.amount,
    status: r.status,
    accountNumber: r.accountNumber,
    rejectionReason: r.rejectionReason,
    createdAt: r.createdAt.toISOString(),
    reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-primary">Withdraw</h1>
      <p className="mt-2 text-secondary">
        Request a payout of your wallet balance — {inr(me?.walletBalance ?? 0)} available. An admin
        reviews and pays out every request manually.
      </p>

      <div className="mt-8">
        <WithdrawForm
          balance={me?.walletBalance ?? 0}
          minWithdrawal={settings.minWithdrawal}
          bankDetails={{
            accountHolderName: me?.bankAccountHolder ?? "",
            accountNumber: me?.bankAccountNumber ?? "",
            ifsc: me?.bankIfsc ?? "",
          }}
          hasPending={hasPending}
          history={history}
        />
      </div>
    </div>
  );
}
