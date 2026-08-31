import { requireAdmin } from "../../../../lib/auth/guards";
import dbConnect from "../../../../lib/db";
import User from "../../../../models/User";
import WithdrawalRequest from "../../../../models/WithdrawalRequest";
import WithdrawalQueue from "../../../../components/admin/WithdrawalQueue";
import { getSettings } from "../../../../lib/settings";

export const metadata = { title: "Withdrawals · Admin", robots: { index: false } };

export default async function AdminWithdrawalsPage() {
  await requireAdmin();
  await dbConnect();

  // What "Mark paid" actually does depends on this — see
  // api/admin/withdrawals/[id] and AppSettings.payoutMode.
  const { payoutMode } = await getSettings();

  const reqs = await WithdrawalRequest.find({}).sort({ createdAt: -1 }).lean();
  const reviewers = await User.find({ _id: { $in: reqs.map((r) => r.reviewer) } })
    .select("name email")
    .lean();
  const rMap = new Map(reviewers.map((r) => [String(r._id), r]));

  const requests = reqs.map((r) => {
    const reviewer = rMap.get(String(r.reviewer));
    return {
      id: String(r._id),
      amount: r.amount,
      status: r.status,
      accountHolderName: r.accountHolderName,
      accountNumber: r.accountNumber,
      ifsc: r.ifsc,
      rejectionReason: r.rejectionReason,
      adminNote: r.adminNote || "",
      paidManually: Boolean(r.paidManually),
      paymentReference: r.paymentReference || "",
      reviewerName: reviewer?.name ?? "",
      reviewerEmail: reviewer?.email ?? "",
      date: new Date(r.createdAt).toLocaleString("en-IN"),
      reviewedDate: r.reviewedAt ? new Date(r.reviewedAt).toLocaleString("en-IN") : "",
    };
  });

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-primary">Withdrawals</h1>
      <p className="mt-2 text-secondary">
        Reviewer payout requests. {payoutMode === "razorpayx"
          ? "Approving fires a real payout via RazorpayX to the reviewer's bank account."
          : "Payouts are manual right now: send the money yourself to the account below, then mark it paid here."}{" "}
        Rejecting refunds the held amount back to their wallet.
      </p>

      <div className="mt-8">
        <WithdrawalQueue requests={requests} payoutMode={payoutMode} />
      </div>
    </div>
  );
}
