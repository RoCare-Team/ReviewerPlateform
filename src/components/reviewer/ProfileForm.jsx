"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, Phone, Mail } from "lucide-react";
import { Label, Input, FieldError, FormError } from "../auth/Field";
import { toast } from "../../lib/toast";

/**
 * Reviewer profile form. Email is read-only (identity, not editable here). Name,
 * phone and bio PATCH to /api/reviewer/profile, which re-checks the
 * profile:update permission and scopes the write to the session user.
 */
export default function ProfileForm({ initial, endpoint = "/api/reviewer/profile" }) {
  const router = useRouter();
  const [values, setValues] = useState({
    name: initial.name ?? "",
    phone: initial.phone ?? "",
    bio: initial.bio ?? "",
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [saved, setSaved] = useState(false);

  function set(key) {
    return (e) => {
      setValues((v) => ({ ...v, [key]: e.target.value }));
      setSaved(false);
    };
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    setSaved(false);
    setPending(true);

    const res = await fetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    setPending(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.details) {
        setFieldErrors(data.details);
      } else {
        const message = data.error ?? "Something went wrong. Please try again.";
        setError(message);
        toast.error(message);
      }
      return;
    }

    setSaved(true);
    toast.success("Profile updated.");
    // Re-run the server component so any name shown elsewhere on the page refreshes.
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-xl">
      <FormError>{error}</FormError>

      <div className="space-y-5">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={initial.email} icon={Mail} disabled readOnly />
          <p className="mt-1.5 text-xs text-muted">Your email is your login and can&apos;t be changed here.</p>
        </div>

        <div>
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
            name="name"
            value={values.name}
            onChange={set("name")}
            icon={User}
            required
            error={fieldErrors.name?.[0]}
          />
          <FieldError id="name-error">{fieldErrors.name?.[0]}</FieldError>
        </div>

        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            name="phone"
            value={values.phone}
            onChange={set("phone")}
            icon={Phone}
            placeholder="+91 98765 43210"
            error={fieldErrors.phone?.[0]}
          />
          <FieldError id="phone-error">{fieldErrors.phone?.[0]}</FieldError>
        </div>

        <div>
          <Label htmlFor="bio">Bio</Label>
          <textarea
            id="bio"
            name="bio"
            value={values.bio}
            onChange={set("bio")}
            rows={3}
            maxLength={280}
            placeholder="A short line about yourself."
            className="w-full rounded-btn border border-default bg-surface px-3 py-2.5 text-primary outline-none transition placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/50"
          />
          <p className="mt-1.5 text-xs text-muted">{values.bio.length}/280</p>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center rounded-btn bg-accent px-5 py-2.5 font-semibold text-on-brand shadow-sm transition-all duration-200 hover:bg-accent-hover hover:shadow-md active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
        {saved && <span className="text-sm font-medium text-verified">Profile updated.</span>}
      </div>
    </form>
  );
}
