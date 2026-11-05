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
    <section className="daybreak-panel flex flex-col gap-4 border-dashed p-10">
      <h2 className="font-display text-2xl tracking-tight">{title}</h2>
      <p className="max-w-xl text-sm text-[color:var(--color-ink-soft)]">{description}</p>
      {eta ? (
        <p className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
          Ships in {eta}
        </p>
      ) : null}
    </section>
  );
}
