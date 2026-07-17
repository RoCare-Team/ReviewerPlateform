"use client";

import { useState } from "react";
import { Label, Input, FieldError } from "./Field";

export default function PasswordField({
  id = "password",
  name = "password",
  label = "Password",
  autoComplete = "current-password",
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
          required
          error={error}
          className="pr-16"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute inset-y-0 right-0 px-3 text-sm text-secondary hover:text-primary"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
      {hint ? <p className="mt-1.5 text-xs text-muted">{hint}</p> : null}
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </div>
  );
}
