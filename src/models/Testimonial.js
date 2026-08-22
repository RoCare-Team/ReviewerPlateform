import mongoose from "mongoose";

/**
 * Public-site testimonials, submitted via the "Leave a review" modal on the
 * homepage. There's no admin moderation screen yet, so submissions default
 * to `approved` and show up immediately — GET /api/testimonials only ever
 * returns `approved` rows, so flipping a bad one to `rejected` by hand (or
 * building a moderation UI later) is enough to pull it without a code
 * change.
 */
const TestimonialSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [80, "Name cannot be more than 80 characters"],
    },
    role: {
      type: String,
      trim: true,
      maxlength: [100, "Role cannot be more than 100 characters"],
      default: "",
    },
    quote: {
      type: String,
      required: [true, "Review is required"],
      trim: true,
      maxlength: [600, "Review cannot exceed 600 characters"],
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      default: 5,
    },
    avatarUrl: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "approved",
    },
  },
  { timestamps: true }
);

export default mongoose.models.Testimonial || mongoose.model("Testimonial", TestimonialSchema);
