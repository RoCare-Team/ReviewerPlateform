import { apiRequireAdmin } from "../../../../../lib/auth/guards";
import dbConnect from "../../../../../lib/db";
import Testimonial from "../../../../../models/Testimonial";

export async function DELETE(request, { params }) {
  const { response } = await apiRequireAdmin();
  if (response) return response;

  const { id } = await params;
  await dbConnect();

  const existing = await Testimonial.findByIdAndDelete(id);
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

  return Response.json({ ok: true });
}
