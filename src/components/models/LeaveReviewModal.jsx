"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, CheckCircle2, User, Briefcase, MessageSquare, Star, Camera } from "lucide-react";
import { Label, Input, FormError } from "../auth/Field";
import { toast } from "../../lib/toast";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export default function LeaveReviewModal({ isOpen, onClose, onSubmitted }) {
  const [formData, setFormData] = useState({ name: "", role: "", quote: "" });
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [status, setStatus] = useState("idle"); // 'idle' | 'submitting' | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  // Revoke the object URL when it's replaced or the modal unmounts, so we
  // don't leak blob memory across repeated photo picks.
  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error("Photo must be PNG, JPG or WebP.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error("Photo must be under 5 MB.");
      e.target.value = "";
      return;
    }

    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const clearPhoto = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(null);
    setPhotoPreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const resetForm = () => {
    setFormData({ name: "", role: "", quote: "" });
    setRating(5);
    clearPhoto();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("submitting");
    setErrorMessage("");

    try {
      const body = new FormData();
      body.append("name", formData.name);
      body.append("role", formData.role);
      body.append("quote", formData.quote);
      body.append("rating", String(rating));
      if (photo) body.append("photo", photo);

      const response = await fetch("/api/testimonials", { method: "POST", body });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "An error occurred while submitting.");
      }

      setStatus("success");
      toast.success("Thanks — your review is now live.");
      resetForm();
      onSubmitted?.();
    } catch (error) {
      setErrorMessage(error.message);
      setStatus("error");
      toast.error(error.message);
    }
  };

  const handleClose = () => {
    if (status !== "submitting") onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Leave a review"
      className="animate-fade-up fixed inset-0 z-50 flex items-center justify-center bg-surface-inverse/60 p-4 backdrop-blur-sm"
      style={{ animationDuration: "200ms" }}
      onClick={handleClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-default bg-surface-raised p-6 shadow-xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleClose}
          type="button"
          className="absolute right-4 top-4 rounded-full p-1.5 text-muted transition-all duration-200 hover:scale-110 hover:bg-surface-sunken hover:text-primary"
          aria-label="Close modal"
        >
          <X className="h-4.5 w-4.5" aria-hidden="true" />
        </button>

        {status === "success" ? (
          <div className="flex flex-col items-center py-4 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-verified-subtle text-verified">
              <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
            </span>
            <h3 className="mt-4 text-lg font-bold text-primary">Review submitted</h3>
            <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-secondary">
              Thanks for sharing your experience — it's live on the site now.
            </p>
            <button
              onClick={onClose}
              type="button"
              className="mt-6 w-full rounded-btn bg-accent px-4 py-2.5 text-sm font-semibold text-on-brand shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-md"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <h3 className="text-xl font-bold tracking-tight text-primary">Leave a review</h3>
            <p className="mt-1 text-sm text-secondary">Tell other businesses and reviewers about your experience.</p>

            <div className="mt-6 space-y-4">
              {/* Photo — optional, shown as a round avatar preview matching how
                  it'll render on the testimonial card. */}
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={status === "submitting"}
                  className="group relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-dashed border-default bg-surface text-muted transition-colors duration-200 hover:border-accent hover:text-accent disabled:opacity-60"
                  aria-label={photoPreview ? "Change photo" : "Add a photo"}
                >
                  {photoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element -- transient blob: preview, not a Cloudinary URL next/image can optimize
                    <img src={photoPreview} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Camera className="h-5 w-5" aria-hidden="true" />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handlePhotoChange}
                    disabled={status === "submitting"}
                    className="hidden"
                  />
                  <p className="text-sm font-semibold text-primary">Photo (optional)</p>
                  <p className="mt-0.5 text-xs text-muted">PNG, JPG or WebP, up to 5 MB.</p>
                  {photoPreview && (
                    <button
                      type="button"
                      onClick={clearPhoto}
                      disabled={status === "submitting"}
                      className="mt-1 text-xs font-semibold text-danger hover:underline"
                    >
                      Remove photo
                    </button>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  name="name"
                  required
                  disabled={status === "submitting"}
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="John Doe"
                  icon={User}
                />
              </div>

              <div>
                <Label htmlFor="role">Role / company (optional)</Label>
                <Input
                  id="role"
                  name="role"
                  disabled={status === "submitting"}
                  value={formData.role}
                  onChange={handleChange}
                  placeholder="Founder, Acme Inc."
                  icon={Briefcase}
                />
              </div>

              <div>
                <Label htmlFor="rating">Rating</Label>
                <div id="rating" role="radiogroup" aria-label="Rating out of 5" className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((value) => {
                    const filled = value <= (hoverRating || rating);
                    return (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={rating === value}
                        aria-label={`${value} star${value > 1 ? "s" : ""}`}
                        disabled={status === "submitting"}
                        onClick={() => setRating(value)}
                        onMouseEnter={() => setHoverRating(value)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="rounded-full p-0.5 transition-transform duration-150 hover:scale-110 disabled:pointer-events-none"
                      >
                        <Star
                          className={`h-6 w-6 transition-colors duration-150 ${
                            filled ? "fill-amber-400 text-amber-400" : "text-muted"
                          }`}
                          aria-hidden="true"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label htmlFor="quote">Your review</Label>
                <div className="group relative">
                  <MessageSquare
                    className="pointer-events-none absolute left-3 top-3 h-4.5 w-4.5 text-muted transition-colors duration-200 group-focus-within:text-accent"
                    aria-hidden="true"
                  />
                  <textarea
                    id="quote"
                    name="quote"
                    rows={4}
                    required
                    maxLength={600}
                    disabled={status === "submitting"}
                    value={formData.quote}
                    onChange={handleChange}
                    placeholder="Share what stood out about your experience…"
                    className="w-full resize-none rounded-2xl border border-default bg-surface py-2.5 pl-10 pr-3 text-primary outline-none transition-all duration-200 placeholder:text-muted/70 hover:border-strong focus:border-accent focus:ring-2 focus:ring-accent/50 disabled:opacity-60"
                  />
                </div>
              </div>
            </div>

            {status === "error" && (
              <div className="mt-4">
                <FormError>{errorMessage}</FormError>
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="w-1/3 rounded-btn border border-default bg-surface py-2.5 text-sm font-semibold text-secondary transition-colors duration-200 hover:bg-surface-sunken"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={status === "submitting"}
                className="flex w-2/3 items-center justify-center gap-2 rounded-btn bg-accent py-2.5 text-sm font-semibold text-on-brand shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-md disabled:pointer-events-none disabled:opacity-70 disabled:hover:translate-y-0"
              >
                {status === "submitting" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Submitting…
                  </>
                ) : (
                  "Submit review"
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
