import mongoose from "mongoose";

/**
 * Audit trail for admin "log in as" sessions — who impersonated whom, when,
 * and for how long. Support/trust feature: an admin acting inside a real
 * user's account needs a paper trail as much as (arguably more than) any
 * other admin action.
 */
const ImpersonationLogSchema = new mongoose.Schema(
  {
    admin: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    adminEmail: { type: String, required: true },
    targetUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // Reviewer/business_owner sign in by phone (see roles.json) and often have
    // no email at all — this is a display field for the audit log, not an
    // identity requirement, so it can't be `required`.
    targetEmail: { type: String, default: "" },
    targetPhone: { type: String, default: "" },
    targetRole: { type: String, required: true },
    startedAt: { type: Date, required: true, default: Date.now },
    endedAt: { type: Date, default: null }, // set when explicitly ended via "Return to admin"
  },
  { timestamps: true }
);

export default mongoose.models.ImpersonationLog ||
  mongoose.model("ImpersonationLog", ImpersonationLogSchema);
