export function Label({ htmlFor, children }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-primary">
      {children}
    </label>
  );
}

export function Input({ id, error, className = "", ...props }) {
  return (
    <input
      id={id}
      aria-invalid={error ? "true" : undefined}
      aria-describedby={error ? `${id}-error` : undefined}
      {...props}
      className={`w-full rounded-btn border bg-surface px-3 py-2 text-primary outline-none transition placeholder:text-muted focus:ring-2 focus:ring-accent ${
        error ? "border-danger" : "border-default focus:border-accent"
      } ${className}`}
    />
  );
}

export function FieldError({ id, children }) {
  if (!children) return null;
  return (
    <p id={id} className="mt-1.5 text-sm text-danger">
      {children}
    </p>
  );
}

export function FormError({ children }) {
  if (!children) return null;
  return (
    <div
      role="alert"
      className="mb-4 rounded-btn border border-danger bg-danger-subtle px-3 py-2 text-sm text-danger"
    >
      {children}
    </div>
  );
}

export function SubmitButton({ pending, disabled, children }) {
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="w-full rounded-btn bg-accent px-4 py-2.5 font-medium text-on-brand transition hover:bg-accent-hover focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Please wait…" : children}
    </button>
  );
}
