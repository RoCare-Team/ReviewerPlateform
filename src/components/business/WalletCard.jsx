import { ArrowDownLeft, ArrowUpRight, Receipt, Wallet } from "lucide-react";

/**
 * Wallet balance (read-only). The add-funds top-up flow is removed for now —
 * no payment gateway is wired up yet, so businesses can't self-serve credit.
 * Receives the current balance and recent transactions from the server page.
 */
function inr(n) {
  return `₹${Number(n).toLocaleString("en-IN")}`;
}

export default function WalletCard({ balance, transactions }) {
  return (
    <div className="rounded-card border border-default bg-surface-raised p-6 shadow-sm transition-shadow duration-300 hover:shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-subtle text-accent">
            <Wallet className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm text-secondary">Wallet balance</p>
            <p className="nums text-2xl font-extrabold tracking-tight text-primary">{inr(balance)}</p>
          </div>
        </div>
      </div>

      {/* Recent transactions */}
      <div className="mt-5 border-t border-default pt-4">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">Recent transactions</p>
        {transactions.length === 0 ? (
          <div className="mt-4 flex flex-col items-center gap-2 py-4 text-center">
            <Receipt className="h-6 w-6 text-muted" aria-hidden="true" />
            <p className="text-sm text-secondary">No transactions yet.</p>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-default">
            {transactions.map((t) => {
              const positive = t.amount >= 0;
              return (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2.5 text-sm transition-colors duration-150 hover:bg-surface-sunken/60">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${positive ? "bg-verified-subtle" : "bg-danger-subtle"}`}>
                      {positive ? (
                        <ArrowDownLeft className="h-4 w-4 text-verified" aria-hidden="true" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4 text-danger" aria-hidden="true" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-primary">
                        {t.note || (t.type === "topup" ? "Top-up" : t.type)}
                      </span>
                      <span className="block text-xs text-muted">{new Date(t.at).toLocaleDateString("en-IN")}</span>
                    </span>
                  </span>
                  <span className={`nums shrink-0 font-semibold ${positive ? "text-verified" : "text-danger"}`}>
                    {positive ? "+" : "−"}
                    {inr(Math.abs(t.amount))}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
