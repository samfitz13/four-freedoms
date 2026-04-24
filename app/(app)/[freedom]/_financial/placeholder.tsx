/**
 * Shared empty-state for Wealth / Cashflow / Goals / Accounts tabs while
 * their real implementations land in later PRs.
 */
export function TabPlaceholder({
  title,
  description,
  eta,
}: {
  title: string;
  description: string;
  eta?: string;
}) {
  return (
    <section className="flex flex-col gap-4 border border-dashed border-[color:var(--color-border)] p-10">
      <h2 className="font-serif text-2xl tracking-tight">{title}</h2>
      <p className="max-w-xl text-sm text-[color:var(--color-ink-soft)]">{description}</p>
      {eta ? (
        <p className="font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-ink-soft)] uppercase">
          Ships in {eta}
        </p>
      ) : null}
    </section>
  );
}
