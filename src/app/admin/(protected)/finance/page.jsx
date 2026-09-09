import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Banknote,
  Coins,
  Gift,
  Landmark,
  Megaphone,
  PiggyBank,
  Wallet,
  XCircle,
} from "lucide-react";
import { requireAdmin } from "../../../../lib/auth/guards";
import dbConnect from "../../../../lib/db";
import User from "../../../../models/User";
import WalletTransaction from "../../../../models/WalletTransaction";
import { inr } from "../../../../lib/settings";
import { getFinanceSummary, TX_LABEL } from "../../../../lib/finance";
import StatCard from "../../../../components/shared/StatCard";
import TransactionLedger from "../../../../components/admin/TransactionLedger";

export const metadata = { title: "Finance · Admin", robots: { index: false } };

const ROLE_LABEL = { business_owner: "Business", reviewer: "Reviewer", admin: "Admin" };

function Section({ title, hint, children }) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-bold uppercase tracking-wide text-muted">{title}</h2>
      {hint && <p className="mt-1 text-sm text-secondary">{hint}</p>}
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">{children}</div>
    </section>
  );
}

/**
 * Where the platform's money is: what came in, what went out, what's still
 * sitting in wallets — plus the raw wallet ledger underneath it.
 *
 * Every figure comes from lib/finance.js, which is the one place that decides
 * what "deposited" and "paid out" actually mean (notably: paid-out is measured
 * on the payout queue, not on the wallet's withdrawal HOLD, and "today" is
 * midnight IST). Read that file before changing a number here.
 */
export default async function AdminFinancePage() {
  await requireAdmin();
  await dbConnect();

  const [money, txs] = await Promise.all([
    getFinanceSummary(),
    WalletTransaction.find({}).sort({ createdAt: -1 }).limit(500).lean(),
  ]);

  const users = await User.find({ _id: { $in: txs.map((t) => t.user) } })
    .select("name email role")
    .lean();
  const uMap = new Map(users.map((u) => [String(u._id), u]));

  const rows = txs.map((t) => {
    const u = uMap.get(String(t.user));
    return {
      id: String(t._id),
      amount: t.amount,
      type: t.type,
      typeLabel: TX_LABEL[t.type] ?? t.type,
      note: t.note || "",
      balanceAfter: t.balanceAfter ?? 0,
      byAdmin: Boolean(t.by),
      userName: u?.name ?? "",
      userEmail: u?.email ?? "",
      roleLabel: ROLE_LABEL[u?.role] ?? "",
      date: new Date(t.createdAt).toLocaleString("en-IN"),
    };
  });

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-primary">Finance</h1>
      <p className="mt-2 max-w-3xl text-secondary">
        Money in, money out, and what&apos;s still held in wallets. &quot;Today&quot; means since midnight IST. Payouts are
        counted when they were actually paid, not when they were requested — a request that&apos;s still waiting shows
        under Held for payout instead.
      </p>

      <Section title="Money in">
        <StatCard label="Total deposits" value={inr(money.deposits.total)} Icon={ArrowDownToLine} tone="text-verified" sub={`${inr(money.deposits.gateway)} online · ${inr(money.deposits.byAdmin)} added by admin`} />
        <StatCard label="Deposits today" value={inr(money.deposits.today)} Icon={Banknote} tone="text-verified" />
        <StatCard label="Spent on campaigns" value={inr(money.spend.total)} Icon={Megaphone} sub={`${inr(money.spend.today)} today`} href="/admin/campaigns" />
        <StatCard label="Platform margin" value={inr(money.margin)} Icon={PiggyBank} tone="text-accent" sub="Campaign spend − reviewer payouts" />
      </Section>

      <Section title="Money out">
        <StatCard label="Total withdrawals paid" value={inr(money.withdrawals.paid)} Icon={ArrowUpFromLine} tone="text-danger" sub={`${money.withdrawals.paidCount} payout${money.withdrawals.paidCount === 1 ? "" : "s"}`} href="/admin/withdrawals" />
        <StatCard label="Withdrawals paid today" value={inr(money.withdrawals.paidToday)} Icon={Landmark} tone="text-danger" sub={`${money.withdrawals.paidTodayCount} payout${money.withdrawals.paidTodayCount === 1 ? "" : "s"}`} href="/admin/withdrawals" />
        <StatCard label="Held for payout" value={inr(money.withdrawals.held)} Icon={Wallet} tone="text-pending" sub={`${money.withdrawals.heldCount} awaiting action`} href="/admin/withdrawals" />
        <StatCard label="Rejected payouts" value={inr(money.withdrawals.rejected)} Icon={XCircle} sub={`${money.withdrawals.rejectedCount} refunded to wallets`} href="/admin/withdrawals" />
      </Section>

      <Section title="Reviewer earnings" hint="What reviewers have been credited — separate from what they've cashed out above.">
        <StatCard label="Review rewards paid" value={inr(money.rewards.total)} Icon={Coins} tone="text-verified" sub={`${inr(money.rewards.today)} today`} href="/admin/verification?tab=approved" />
        <StatCard label="Referral bonuses" value={inr(money.rewards.referral)} Icon={Gift} tone="text-accent" href="/admin/referrals" />
        <StatCard label="Held in reviewer wallets" value={inr(money.holding.reviewer)} Icon={Wallet} tone="text-pending" sub="Earned, not yet withdrawn" href="/admin/users?role=reviewer" />
        <StatCard label="Held in business wallets" value={inr(money.holding.business)} Icon={Wallet} sub="Deposited, not yet spent" href="/admin/organisations" />
      </Section>

      <section className="mt-10">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Wallet ledger</h2>
        <p className="mt-1 text-sm text-secondary">
          The 500 most recent wallet movements. A withdrawal appears here the moment it&apos;s requested, because the
          amount is held from the reviewer&apos;s wallet right then.
        </p>
        <div className="mt-4">
          <TransactionLedger rows={rows} />
        </div>
      </section>
    </div>
  );
}
