import { requireAdmin } from "../../../../lib/auth/guards";
import dbConnect from "../../../../lib/db";
import User from "../../../../models/User";
import WithdrawalRequest from "../../../../models/WithdrawalRequest";
import WithdrawalQueue from "../../../../components/admin/WithdrawalQueue";

export const metadata = { title: "Withdrawals · Admin", robots: { index: false } };

export default async function AdminWithdrawalsPage() {
  await requireAdmin();
  await dbConnect();

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
        Reviewer payout requests. Approving fires a real payout via RazorpayX to the reviewer's bank
        account. Rejecting — or a payout that fails to even start — refunds the held amount back to
        their wallet.
      </p>

      <div className="mt-8">
        <WithdrawalQueue requests={requests} />
      </div>
    </div>
  );
}
