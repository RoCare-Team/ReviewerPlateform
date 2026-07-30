export default function AuthCard({ title, subtitle, children, footer }) {
  return (
    <div className="w-full max-w-md">
      <div className="rounded-2xl border border-default bg-surface-raised p-8 shadow-lg sm:p-10">
        <h1 className="text-2xl font-extrabold tracking-tight text-primary sm:text-[1.75rem]">
          {title}
        </h1>
        {subtitle ? <p className="mt-2 text-sm leading-relaxed text-secondary">{subtitle}</p> : null}
        <div className="mt-7">{children}</div>
      </div>
      {footer ? (
        <div className="mt-6 text-center text-sm font-medium text-secondary">{footer}</div>
      ) : null}
    </div>
  );
}
