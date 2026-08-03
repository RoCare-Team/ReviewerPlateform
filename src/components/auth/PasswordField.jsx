"use client";

import { useState } from "react";
import { Lock, Eye, EyeOff } from "lucide-react";
import { Label, Input, FieldError } from "./Field";

export default function PasswordField({
  id = "password",
  name = "password",
  label = "Password",
  autoComplete = "current-password",
  // Dots, not words: a literal placeholder like "Your password" is one more
  // thing to read, and it reads as prefilled at a glance.
  placeholder = "••••••••",
  error,
  hint,
}) {
  const [show, setShow] = useState(false);

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required
          error={error}
          icon={Lock}
          className="pr-11"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-muted transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="h-4.5 w-4.5" aria-hidden="true" /> : <Eye className="h-4.5 w-4.5" aria-hidden="true" />}
        </button>
      </div>
      {hint ? <p className="mt-1.5 text-xs text-muted">{hint}</p> : null}
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </div>
  );
}
