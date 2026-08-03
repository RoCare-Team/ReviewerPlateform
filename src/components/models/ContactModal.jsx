"use client";

import { useState, useEffect } from "react";
import { X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export default function ContactModal({ isOpen, onClose }) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    description: "",
  });

  const [status, setStatus] = useState("idle"); // 'idle' | 'submitting' | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState("");

  // Close modal when "Escape" key is pressed
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      // Prevent background scrolling when modal is open
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("submitting");
    setErrorMessage("");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "An error occurred while submitting.");
      }

      setStatus("success");
      setFormData({ name: "", email: "", phone: "", description: "" });
    } catch (error) {
      setErrorMessage(error.message);
      setStatus("error");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Inline styles for guaranteed animations, independent of tailwind.config.js */}
      <style>{`
        @keyframes customFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes customModalZoom {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-customFade {
          animation: customFadeIn 0.2s ease-out forwards;
        }
        .animate-customZoom {
          animation: customModalZoom 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Backdrop Overlay with Smooth Fade-In */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 animate-customFade"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Content Box (We removed opacity-0 so it works immediately) */}
      <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-default/50 bg-surface-raised p-6 shadow-xl transition-all duration-300 animate-customZoom z-10">
        {/* Close Button */}
        <button
          onClick={onClose}
          type="button"
          className="absolute right-4 top-4 rounded-md p-1.5 text-secondary hover:bg-default/15 hover:text-primary transition-colors duration-200 cursor-pointer"
          aria-label="Close modal"
        >
          <X className="h-4 w-4" />
        </button>

        {status === "success" ? (
          /* Success Message */
          <div className="flex flex-col items-center text-center py-6">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 mb-4">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-primary">Saved Successfully!</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-secondary max-w-xs">
              Your details are successfully logged. We will connect with you soon.
            </p>
            <button
              onClick={onClose}
              type="button"
              className="mt-6 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-on-brand hover:bg-accent/90 transition-all duration-200 cursor-pointer"
            >
              Done
            </button>
          </div>
        ) : (
          /* Main Form */
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-primary">Book a Demo</h3>
              <p className="text-[11px] text-secondary mt-0.5">
                Tell us about your requirements to request a customized demo.
              </p>
            </div>

            <div className="space-y-3">
              {/* Name */}
              <div className="flex flex-col">
                <label htmlFor="name" className="text-[10px] font-bold uppercase tracking-wider text-secondary mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  disabled={status === "submitting"}
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="John Doe"
                  className="w-full rounded-md border border-default/60 bg-background px-3 py-1.5 text-xs text-primary transition-all duration-200 focus:border-accent focus:ring-2 focus:ring-accent/10 focus:outline-none disabled:opacity-50"
                />
              </div>

              {/* Email */}
              <div className="flex flex-col">
                <label htmlFor="email" className="text-[10px] font-bold uppercase tracking-wider text-secondary mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  disabled={status === "submitting"}
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  className="w-full rounded-md border border-default/60 bg-background px-3 py-1.5 text-xs text-primary transition-all duration-200 focus:border-accent focus:ring-2 focus:ring-accent/10 focus:outline-none disabled:opacity-50"
                />
              </div>

              {/* Phone */}
              <div className="flex flex-col">
                <label htmlFor="phone" className="text-[10px] font-bold uppercase tracking-wider text-secondary mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  required
                  disabled={status === "submitting"}
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+919876543210"
                  className="w-full rounded-md border border-default/60 bg-background px-3 py-1.5 text-xs text-primary transition-all duration-200 focus:border-accent focus:ring-2 focus:ring-accent/10 focus:outline-none disabled:opacity-50"
                />
              </div>

              {/* Description */}
              <div className="flex flex-col">
                <label htmlFor="description" className="text-[10px] font-bold uppercase tracking-wider text-secondary mb-1">
                  Message / Requirements
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={3}
                  required
                  disabled={status === "submitting"}
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Tell us about your brand/campaign..."
                  className="w-full rounded-md border border-default/60 bg-background px-3 py-1.5 text-xs text-primary transition-all duration-200 focus:border-accent focus:ring-2 focus:ring-accent/10 focus:outline-none disabled:opacity-50 resize-none"
                />
              </div>
            </div>

            {/* Error Message */}
            {status === "error" && (
              <div className="flex items-center gap-2 rounded-md bg-rose-500/10 p-2.5 text-[11px] text-rose-500 border border-rose-500/15">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="w-1/3 rounded-md border border-default py-2 text-xs font-semibold text-secondary hover:bg-surface-sunken transition-colors duration-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={status === "submitting"}
                className="w-2/3 flex items-center justify-center rounded-md bg-accent py-2 text-xs font-semibold text-on-brand transition-all duration-200 hover:bg-accent/95 disabled:pointer-events-none disabled:opacity-75 shadow-sm cursor-pointer"
              >
                {status === "submitting" ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Submitting...</span>
                  </div>
                ) : (
                  <span>Book Demo</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}