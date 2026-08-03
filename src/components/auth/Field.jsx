import { AlertCircle, Loader2 } from "lucide-react";

export function Label({ htmlFor, children }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-primary">
      {children}
    </label>
  );
}

export function Input({ id, error, icon: Icon, className = "", ...props }) {
  const input = (
    <input
      id={id}
      aria-invalid={error ? "true" : undefined}
      aria-describedby={error ? `${id}-error` : undefined}
      {...props}
      className={`w-full rounded-btn border bg-surface py-2.5 text-primary outline-none transition-all duration-200 placeholder:text-muted/70 focus:ring-2 focus:ring-accent/50 ${
        Icon ? "pl-10 pr-3" : "px-3"
      } ${
        error
          ? "border-danger focus:ring-danger/40"
          : "border-default hover:border-strong focus:border-accent"
      } ${className}`}
    />
  );

  if (!Icon) return input;

  return (
    // `group` so the leading icon can react to focus/error state — the icon
    // lighting up in the accent is the cheapest possible "you are here" cue.
    <div className="group relative">
      <Icon
        className={`pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 transition-colors duration-200 ${
          error ? "text-danger" : "text-muted group-focus-within:text-accent"
        }`}
        aria-hidden="true"
      />
      {input}
    </div>
  );
}

export function FieldError({ id, children }) {
  if (!children) return null;
  return (
    <p id={id} className="mt-1.5 flex items-start gap-1.5 text-sm text-danger">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

export function FormError({ children }) {
  if (!children) return null;
  return (
    <div
      role="alert"
      className="mb-4 flex items-start gap-2 rounded-btn border border-danger bg-danger-subtle px-3 py-2.5 text-sm leading-relaxed text-danger"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

export function SubmitButton({ pending, disabled, children }) {
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="inline-flex w-full items-center justify-center rounded-btn bg-accent px-4 py-3 font-semibold text-on-brand shadow-sm transition-all duration-200 hover:bg-accent-hover hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100"
    >
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          Please wait…
        </>
      ) : (
        children
      )}
    </button>
  );
}
