import { Banknote, Clock, Wallet } from "lucide-react";
import { requireRole } from "../../../../lib/auth/guards";
import { ROLES } from "../../../../lib/auth/roles";
import dbConnect from "../../../../lib/db";
import User from "../../../../models/User";
import WithdrawalRequest from "../../../../models/WithdrawalRequest";
import { getSettings, inr } from "../../../../lib/settings";
import WithdrawForm from "../../../../components/reviewer/WithdrawForm";
import StatCard from "../../../../components/shared/StatCard";

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
  const pendingAmount = requests.filter((r) => r.status === "pending").reduce((s, r) => s + r.amount, 0);
  const paidOut = requests.filter((r) => r.status === "approved").reduce((s, r) => s + r.amount, 0);

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
        Request a payout of your wallet balance. An admin reviews and pays out every request manually.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <StatCard label="Wallet balance" value={inr(me?.walletBalance ?? 0)} Icon={Wallet} tone="text-accent" />
        <StatCard
          label="Pending requests"
          value={String(requests.filter((r) => r.status === "pending").length)}
          Icon={Clock}
          tone="text-pending"
          sub={pendingAmount > 0 ? `${inr(pendingAmount)} held` : undefined}
        />
        <StatCard label="Paid out so far" value={inr(paidOut)} Icon={Banknote} tone="text-verified" />
      </div>

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
