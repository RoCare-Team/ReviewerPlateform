import { apiRequirePermission } from "../../../../../lib/auth/guards";
import { uploadImage, cloudinaryConfigured } from "../../../../../lib/cloudinary";
import { getImageDimensions } from "../../../../../lib/imageDimensions";

/**
 * Upload one image for a campaign's review-image pool (see
 * models/Campaign.js reviewImages) — used by NewCampaignModal before the
 * campaign exists. Nothing is persisted to a campaign here; the owner
 * collects URLs client-side and the final list is only saved when the
 * campaign itself is created (POST /api/business/campaigns, field
 * `reviewImages`). Same validation posture as the blog/submission upload
 * routes: magic-byte sniff, not just the declared mime type.
 *
 * Every image here ends up downloaded by a reviewer and attached straight to
 * a real Google review, so it's gated to Google Business Profile's own
 * published photo requirements — same file-size range (10 KB–5 MB) and
 * minimum resolution (250×250) any photo posted to Google Maps has to clear,
 * plus a sane upper bound on resolution so nobody's uploading a 40-megapixel
 * original just to be downloaded again a moment later.
 */
const MIN_BYTES = 10 * 1024; // 10 KB — Google's own published minimum
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB — Google's own published maximum
const MIN_DIMENSION = 250; // px, both width and height — Google's minimum
const MAX_DIMENSION = 3000; // px, both width and height
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
  if (file.size < MIN_BYTES) {
    return Response.json({ error: "Image is too small — Google requires at least 10 KB." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) return Response.json({ error: "Image must be under 5 MB." }, { status: 400 });

  if (!cloudinaryConfigured()) {
    return Response.json({ error: "Image uploads are not configured on the server." }, { status: 503 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const sniffed = sniffImage(bytes);
  if (!sniffed || sniffed !== file.type) {
    return Response.json({ error: "File doesn't look like a valid image." }, { status: 400 });
  }

  // Best-effort — a format we couldn't parse the header of still uploads
  // (see lib/imageDimensions.js's docblock); only an image we COULD measure
  // and that's actually out of range gets rejected.
  const dimensions = getImageDimensions(bytes, sniffed);
  if (dimensions) {
    if (dimensions.width < MIN_DIMENSION || dimensions.height < MIN_DIMENSION) {
      return Response.json(
        { error: `Image is too small (${dimensions.width}×${dimensions.height}px) — Google requires at least ${MIN_DIMENSION}×${MIN_DIMENSION}px.` },
        { status: 400 }
      );
    }
    if (dimensions.width > MAX_DIMENSION || dimensions.height > MAX_DIMENSION) {
      return Response.json(
        { error: `Image is too large (${dimensions.width}×${dimensions.height}px) — max is ${MAX_DIMENSION}×${MAX_DIMENSION}px.` },
        { status: 400 }
      );
    }
  }

  try {
    const { url } = await uploadImage(bytes, file.type, "reviewhub/campaign-images");
    return Response.json({ url });
  } catch (err) {
    return Response.json({ error: err.message ?? "Upload failed." }, { status: 502 });
  }
}
