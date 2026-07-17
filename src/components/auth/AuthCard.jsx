export default function AuthCard({ title, subtitle, children, footer }) {
  return (
    <div className="w-full max-w-md">
      <div className="rounded-card border border-default bg-surface-raised p-8 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-primary">{title}</h1>
        {subtitle ? <p className="mt-2 text-sm text-secondary">{subtitle}</p> : null}
        <div className="mt-6">{children}</div>
      </div>
      {footer ? <div className="mt-6 text-center text-sm text-secondary">{footer}</div> : null}
    </div>
  );
}
