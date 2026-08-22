import { Star } from "lucide-react";
import { requireAdmin } from "../../../../lib/auth/guards";
import dbConnect from "../../../../lib/db";
import Testimonial from "../../../../models/Testimonial";
import TestimonialsTable from "../../../../components/admin/TestimonialsTable";

export const metadata = { title: "Testimonials · Admin", robots: { index: false } };

export default async function AdminTestimonialsPage() {
  await requireAdmin();
  await dbConnect();

  const testimonials = await Testimonial.find({}).sort({ createdAt: -1 }).limit(500).lean();

  // Serialized for the client table — no ObjectIds or Dates cross the boundary.
  const rows = testimonials.map((t) => ({
    id: String(t._id),
    name: t.name,
    role: t.role,
    quote: t.quote,
    rating: t.rating,
    avatarUrl: t.avatarUrl,
    status: t.status,
    date: new Date(t.createdAt).toLocaleString("en-IN"),
  }));

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-subtle text-accent">
          <Star className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Testimonials</h1>
          <p className="text-sm text-secondary">
            {rows.length} submitted via the "Leave a review" modal on the homepage
          </p>
        </div>
      </div>

      <TestimonialsTable rows={rows} />
    </div>
  );
}
