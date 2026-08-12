import dbConnect from "../../../lib/db";
import Testimonial from "../../../models/Testimonial";
import { uploadImage, cloudinaryConfigured } from "../../../lib/cloudinary";
import { rateLimit, clientIp } from "../../../lib/rate-limit";

/**
 * Public "Leave a review" submission from the homepage testimonials modal,
 * plus the GET the homepage uses to render approved ones. Anonymous —
 * anyone with the link can post — so POST is rate-limited; see the model
 * for the moderation posture.
 */
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED = { "image/png": true, "image/jpeg": true, "image/webp": true };

function sniffImage(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

export async function GET() {
  try {
    await dbConnect();
    const testimonials = await Testimonial.find({ status: "approved" })
      .sort({ createdAt: -1 })
      .limit(20)
      .select("name role quote rating avatarUrl createdAt")
      .lean();

    return Response.json({ testimonials });
  } catch (error) {
    console.error("Testimonial fetch error:", error);
    return Response.json({ error: "Could not load reviews." }, { status: 500 });
  }
}

export async function POST(request) {
  const { ok, retryAfter } = rateLimit(`testimonial:${clientIp(request)}`, {
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!ok) {
    return Response.json(
      { error: "Too many submissions — please try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  const form = await request.formData().catch(() => null);
  if (!form) return Response.json({ error: "Invalid form data." }, { status: 400 });

  const name = String(form.get("name") ?? "").trim().slice(0, 80);
  const role = String(form.get("role") ?? "").trim().slice(0, 100);
  const quote = String(form.get("quote") ?? "").trim().slice(0, 600);
  const rating = Math.min(5, Math.max(1, Number(form.get("rating")) || 5));
  const file = form.get("photo");

  if (!name || !quote) {
    return Response.json({ error: "Name and review are required." }, { status: 400 });
  }

  let avatarUrl = "";
  if (file && typeof file === "object" && typeof file.arrayBuffer === "function" && file.size > 0) {
    if (!ALLOWED[file.type]) {
      return Response.json({ error: "Photo must be PNG, JPG or WebP." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return Response.json({ error: "Photo must be under 5 MB." }, { status: 400 });
    }
    if (!cloudinaryConfigured()) {
      return Response.json({ error: "Photo uploads are not configured on the server." }, { status: 503 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const sniffed = sniffImage(bytes);
    if (!sniffed || sniffed !== file.type) {
      return Response.json({ error: "File doesn't look like a valid image." }, { status: 400 });
    }

    try {
      const { url } = await uploadImage(bytes, file.type, "reviewhub/testimonials");
      avatarUrl = url;
    } catch (err) {
      return Response.json({ error: err.message ?? "Photo upload failed." }, { status: 502 });
    }
  }

  try {
    await dbConnect();
    await Testimonial.create({ name, role, quote, rating, avatarUrl });
    return Response.json(
      { success: true, message: "Thanks — your review is now live." },
      { status: 201 }
    );
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((val) => val.message);
      return Response.json({ error: messages.join(", ") }, { status: 400 });
    }
    console.error("Testimonial submission error:", error);
    return Response.json({ error: "An unexpected server error occurred." }, { status: 500 });
  }
}
