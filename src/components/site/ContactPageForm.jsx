"use client";

import { useState } from "react";
import { Loader2, Mail, Phone, User, MessageSquare } from "lucide-react";
import { Label, Input, FormError } from "../auth/Field";
import { toast } from "../../lib/toast";

/**
 * Full-page counterpart to ContactModal — same /api/contact endpoint and
 * fields, laid out inline instead of in a dialog. Kept as a separate
 * component (not a reused ContactModal) because a page form has no open/close
 * state and shouldn't carry the modal's dialog semantics (role="dialog",
 * Escape-to-close, backdrop click).
 */
export default function ContactPageForm() {
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", description: "" });
  const [status, setStatus] = useState("idle"); // 'idle' | 'submitting' | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState("");

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
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
      toast.success("Message sent — our team will reach out to you soon.");
      setFormData({ name: "", email: "", phone: "", description: "" });
    } catch (error) {
      setStatus("error");
      setErrorMessage(error.message);
      toast.error(error.message);
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-card border border-verified bg-verified-subtle p-6 text-center">
        <p className="text-base font-bold text-verified">Message received</p>
        <p className="mt-1.5 text-sm leading-relaxed text-primary">
          Your details are saved — our team will reach out to you soon.
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-4 text-sm font-semibold text-accent hover:underline"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="rounded-card border border-default bg-surface-raised p-6 shadow-sm sm:p-8">
      <div className="space-y-4">
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
          <Label htmlFor="description">Message</Label>
          <div className="group relative">
            <MessageSquare
              className="pointer-events-none absolute left-3 top-3 h-4.5 w-4.5 text-muted transition-colors duration-200 group-focus-within:text-accent"
              aria-hidden="true"
            />
            <textarea
              id="description"
              name="description"
              rows={5}
              required
              disabled={status === "submitting"}
              value={formData.description}
              onChange={handleChange}
              placeholder="Tell us what you need help with…"
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

      <button
        type="submit"
        disabled={status === "submitting"}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-btn bg-accent py-3 text-sm font-semibold text-on-brand shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-md disabled:pointer-events-none disabled:opacity-70 disabled:hover:translate-y-0"
      >
        {status === "submitting" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Sending…
          </>
        ) : (
          "Send message"
        )}
      </button>
    </form>
  );
}
