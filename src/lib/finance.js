import WalletTransaction from "../models/WalletTransaction";
import WithdrawalRequest from "../models/WithdrawalRequest";
import User from "../models/User";
import { ROLES } from "./auth/roles";

/**
 * Platform money, read straight off the two ledgers that hold it: the wallet
 * ledger (models/WalletTransaction — every rupee that moved into or out of
 * anybody's wallet) and the payout queue (models/WithdrawalRequest — every
 * rupee that actually left the platform for a reviewer's bank account).
 *
 * The two answer different questions and neither substitutes for the other:
 *   - A `withdrawal` wallet transaction is written the moment a reviewer
 *     REQUESTS a payout, because the amount is held (debited) right then —
 *     see api/reviewer/withdrawals. Summing those would count money that is
 *     still sitting with us, and would double-count a request that was later
 *     rejected and refunded.
 *   - So "paid out" is measured on WithdrawalRequest.status === "approved",
 *     which by definition means the money actually landed (RazorpayX
 *     confirmed it, or an admin transferred it by hand). See that model's
 *     docblock for the full status ladder.
 *
 * Everything here is read-only aggregation — nothing in this file moves money.
 */

/**
 * Midnight IST as a UTC Date.
 *
 * "Today" on this dashboard has to mean today in India: every amount is in ₹,
 * every timestamp elsewhere in the admin is rendered with toLocaleString("en-IN"),
 * and an admin looking at "today's deposits" at 9am IST means since midnight
 * IST — a UTC boundary would still be showing them yesterday's number until
 * 5:30am. (Note this is deliberately NOT the same boundary as the reviewer
 * daily cap in lib/pacing.js, which is UTC by design; that one is a rule
 * being enforced, this one is a day being displayed.)
 *
 * IST is a fixed +5:30 with no daylight saving, so the offset is a constant
 * rather than a timezone-library lookup.
 */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function startOfTodayIST() {
  const ist = new Date(Date.now() + IST_OFFSET_MS);
  const midnightIst = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate());
  return new Date(midnightIst - IST_OFFSET_MS);
}

/** Total of `amount` over the wallet transactions matching `match`. */
async function sumTx(match) {
  const [row] = await WalletTransaction.aggregate([{ $match: match }, { $group: { _id: null, sum: { $sum: "$amount" } } }]);
  return row?.sum ?? 0;
}

/** Total of `amount` over the withdrawal requests matching `match`. */
async function sumWithdrawals(match) {
  const [row] = await WithdrawalRequest.aggregate([
    { $match: match },
    { $group: { _id: null, sum: { $sum: "$amount" }, count: { $sum: 1 } } },
  ]);
  return { sum: row?.sum ?? 0, count: row?.count ?? 0 };
}

/** Total wallet balance currently held by every user of one role. */
async function heldBy(role) {
  const [row] = await User.aggregate([{ $match: { role } }, { $group: { _id: null, sum: { $sum: "$walletBalance" } } }]);
  return row?.sum ?? 0;
}

/**
 * Every headline money number the admin dashboard and the finance page show.
 * All amounts are positive whole rupees — `spend` and `withdrawalsHeld` are
 * stored as negative wallet movements and flipped here, so a caller never has
 * to remember which direction a given ledger type points in.
 */
export async function getFinanceSummary() {
  const since = startOfTodayIST();

  const [
    depositsTotal,
    depositsToday,
    depositsGateway,
    depositsByAdmin,
    spendTotal,
    spendToday,
    rewardsTotal,
    rewardsToday,
    referralTotal,
    paidOut,
    paidOutToday,
    heldForPayout,
    rejectedPayouts,
    businessHolding,
    reviewerHolding,
  ] = await Promise.all([
    // Deposits — money entering a business wallet. Razorpay top-ups plus
    // anything an admin credited by hand (api/admin/users/[id]/wallet), which
    // is written with the same "topup" type but carries `by`.
    sumTx({ type: "topup" }),
    sumTx({ type: "topup", createdAt: { $gte: since } }),
    sumTx({ type: "topup", by: null }),
    sumTx({ type: "topup", by: { $ne: null } }),

    // Campaign spend — debits, so negative in the ledger.
    sumTx({ type: "spend" }),
    sumTx({ type: "spend", createdAt: { $gte: since } }),

    // Reviewer earnings.
    sumTx({ type: "reward" }),
    sumTx({ type: "reward", createdAt: { $gte: since } }),
    sumTx({ type: "referral" }),

    // Actually paid out — see this file's docblock for why this reads the
    // payout queue and not the wallet ledger. `reviewedAt` (not createdAt) is
    // when the money left, which is what "paid today" has to mean.
    sumWithdrawals({ status: "approved" }),
    sumWithdrawals({ status: "approved", reviewedAt: { $gte: since } }),
    sumWithdrawals({ status: { $in: ["pending", "processing"] } }),
    sumWithdrawals({ status: "rejected" }),

    heldBy(ROLES.BUSINESS_OWNER),
    heldBy(ROLES.REVIEWER),
  ]);

  const spent = Math.abs(spendTotal);
  const rewards = rewardsTotal;

  return {
    deposits: { total: depositsTotal, today: depositsToday, gateway: depositsGateway, byAdmin: depositsByAdmin },
    spend: { total: spent, today: Math.abs(spendToday) },
    rewards: { total: rewards, today: rewardsToday, referral: referralTotal },
    withdrawals: {
      paid: paidOut.sum,
      paidCount: paidOut.count,
      paidToday: paidOutToday.sum,
      paidTodayCount: paidOutToday.count,
      held: heldForPayout.sum,
      heldCount: heldForPayout.count,
      rejected: rejectedPayouts.sum,
      rejectedCount: rejectedPayouts.count,
    },
    holding: { business: businessHolding, reviewer: reviewerHolding, total: businessHolding + reviewerHolding },
    // What the platform kept out of what businesses actually spent: the ₹/review
    // they were charged, minus what was paid to reviewers for those reviews
    // (rewards + referral bonuses). Not "profit" — it ignores gateway fees,
    // taxes and every other cost that never touches these two ledgers.
    margin: spent - rewards - referralTotal,
  };
}

/** Human label for a wallet ledger row's `type`, for the finance ledger table. */
export const TX_LABEL = {
  topup: "Deposit",
  spend: "Campaign spend",
  refund: "Refund",
  reward: "Review reward",
  withdrawal: "Withdrawal hold",
  referral: "Referral bonus",
};
