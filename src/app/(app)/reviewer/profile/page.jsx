import { requireRole } from "../../../../lib/auth/guards";
import { ROLES } from "../../../../lib/auth/roles";
import dbConnect from "../../../../lib/db";
import User from "../../../../models/User";
import ProfileForm from "../../../../components/reviewer/ProfileForm";

export const metadata = { title: "Profile · RapportLook" };

export default async function ReviewerProfilePage() {
  const sessionUser = await requireRole(ROLES.REVIEWER);

  // Read the full record so name/phone/bio reflect the latest saved values
  // (the session JWT only carries id/email/role/status).
  await dbConnect();
  const doc = await User.findById(sessionUser.id).select("name email phone bio").lean();

  const initial = {
    name: doc?.name ?? "",
    email: doc?.email ?? sessionUser.email,
    phone: doc?.phone ?? "",
    bio: doc?.bio ?? "",
  };

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-primary">Profile</h1>
      <p className="mt-2 text-secondary">Manage your account details.</p>

      <div className="mt-8 rounded-card border border-default bg-surface-raised p-6 shadow-sm sm:p-8">
        <ProfileForm initial={initial} />
      </div>
    </div>
  );
}
