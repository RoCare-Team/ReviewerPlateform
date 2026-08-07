"use client";

import { useState, useEffect } from "react";
import { X, Loader2, CheckCircle2, User, Mail, Phone, MessageSquare } from "lucide-react";
import { Label, Input, FormError } from "../auth/Field";
import { toast } from "../../lib/toast";

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
      toast.success("Request received — we'll reach out to you soon.");
      setFormData({ name: "", email: "", phone: "", description: "" });
    } catch (error) {
      setErrorMessage(error.message);
      setStatus("error");
      toast.error(error.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Book a demo"
      className="animate-fade-up fixed inset-0 z-50 flex items-center justify-center bg-surface-inverse/60 p-4 backdrop-blur-sm"
      style={{ animationDuration: "200ms" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-default bg-surface-raised p-6 shadow-xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          type="button"
          className="absolute right-4 top-4 rounded-full p-1.5 text-muted transition-all duration-200 hover:scale-110 hover:bg-surface-sunken hover:text-primary"
          aria-label="Close modal"
        >
          <X className="h-4.5 w-4.5" aria-hidden="true" />
        </button>

        {status === "success" ? (
          /* Success Message */
          <div className="flex flex-col items-center py-4 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-verified-subtle text-verified">
              <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
            </span>
            <h3 className="mt-4 text-lg font-bold text-primary">Request received</h3>
            <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-secondary">
              Your details are saved — our team will reach out to you soon.
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
          /* Main Form */
          <form onSubmit={handleSubmit} noValidate>
            <h3 className="text-xl font-bold tracking-tight text-primary">Book a demo</h3>
            
            <div className="mt-6 space-y-4">
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
                <Label htmlFor="email">Email address</Label>
                <Input
                  type="email"
                  id="email"
                  name="email"
                  required
                  disabled={status === "submitting"}
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  icon={Mail}
                />
              </div>

              <div>
                <Label htmlFor="phone">Phone number</Label>
                <Input
                  type="tel"
                  id="phone"
                  name="phone"
                  required
                  disabled={status === "submitting"}
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+91 98765 43210"
                  icon={Phone}
                />
              </div>

              <div>
                <Label htmlFor="description">Message / requirements</Label>
                <div className="group relative">
                  <MessageSquare
                    className="pointer-events-none absolute left-3 top-3 h-4.5 w-4.5 text-muted transition-colors duration-200 group-focus-within:text-accent"
                    aria-hidden="true"
                  />
                  <textarea
                    id="description"
                    name="description"
                    rows={3}
                    required
                    disabled={status === "submitting"}
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Tell us about your brand/campaign…"
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
                onClick={onClose}
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
                  "Book demo"
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
