import { apiRequirePermission } from "../../../../../lib/auth/guards";
import { uploadImage, cloudinaryConfigured } from "../../../../../lib/cloudinary";

/**
 * Upload one image for a campaign's review-image pool (see
 * models/Campaign.js reviewImages) — used by NewCampaignModal before the
 * campaign exists. Nothing is persisted to a campaign here; the owner
 * collects URLs client-side and the final list is only saved when the
 * campaign itself is created (POST /api/business/campaigns, field
 * `reviewImages`). Same validation posture as the blog/submission upload
 * routes: magic-byte sniff, not just the declared mime type.
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

export async function POST(request) {
  const { response } = await apiRequirePermission("campaign:create");
  if (response) return response;

  const form = await request.formData().catch(() => null);
  const file = form?.get("image");
  if (!file || typeof file !== "object" || typeof file.arrayBuffer !== "function") {
    return Response.json({ error: "No image provided." }, { status: 400 });
  }
  if (!ALLOWED[file.type]) return Response.json({ error: "Image must be PNG, JPG or WebP." }, { status: 400 });
  if (file.size === 0) return Response.json({ error: "The image file is empty." }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "Image must be under 5 MB." }, { status: 400 });

  if (!cloudinaryConfigured()) {
    return Response.json({ error: "Image uploads are not configured on the server." }, { status: 503 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const sniffed = sniffImage(bytes);
  if (!sniffed || sniffed !== file.type) {
    return Response.json({ error: "File doesn't look like a valid image." }, { status: 400 });
  }

  try {
    const { url } = await uploadImage(bytes, file.type, "reviewhub/campaign-images");
    return Response.json({ url });
  } catch (err) {
    return Response.json({ error: err.message ?? "Upload failed." }, { status: 502 });
  }
}
