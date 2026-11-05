import { listPlaces, currentStay } from "@/lib/db/queries/location";
import { archivePlace, createPlace, endCurrentStay, startStay, togglePreferred } from "./actions";

export async function LocationPlacesTab({ householdId }: { householdId: string }) {
  const [rows, here] = await Promise.all([listPlaces(householdId), currentStay(householdId)]);

  return (
    <div className="flex flex-col gap-10">
      <header className="daybreak-section-head flex flex-col gap-3 border-b border-[color:var(--color-border)] pb-6">
        <h2 className="font-display text-2xl tracking-tight">Places</h2>
        <p className="max-w-xl text-sm text-[color:var(--color-ink-soft)]">
          The places you live, stay, and move between. Mark the ones you&apos;d choose again — the
          preferred list is how the score knows you&apos;re home.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h3 className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
          Currently
        </h3>
        {here ? (
          <div className="daybreak-panel flex items-baseline justify-between gap-6 p-6">
            <div className="flex flex-col">
              <span className="font-display text-xl">
                {here.placeName}
                {here.country ? (
                  <span className="ml-3 font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
                    {here.country}
                  </span>
                ) : null}
              </span>
              <span className="font-sans text-xs text-[color:var(--color-ink-soft)] tabular-nums">
                since {here.startedOn}
              </span>
            </div>
            <form action={endCurrentStay}>
              <button
                type="submit"
                className="daybreak-button font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-foreground)]"
              >
                End stay
              </button>
            </form>
          </div>
        ) : (
          <p className="text-sm text-[color:var(--color-ink-soft)]">
            No open stay. Start one from the list below.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="font-display text-xl">All places</h3>
        {rows.length === 0 ? (
          <p className="text-sm text-[color:var(--color-ink-soft)]">
            No places yet. Add one below to get started.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-[color:var(--color-border)]">
            {rows.map((p) => (
              <li key={p.id} className="py-3">
                <PlaceRow place={p} isCurrent={p.id === here?.placeId} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="daybreak-panel flex flex-col gap-3 p-6">
        <h3 className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
          New place
        </h3>
        <form action={createPlace} className="flex flex-wrap items-baseline gap-4">
          <input
            name="name"
            placeholder="Name"
            required
            maxLength={120}
            className="daybreak-field w-56 border-b border-[color:var(--color-border)] bg-[color:var(--glass-control)] px-1 py-1 text-sm focus:border-[color:var(--color-foreground)]"
          />
          <input
            name="country"
            placeholder="Country"
            maxLength={80}
            className="daybreak-field w-40 border-b border-[color:var(--color-border)] bg-[color:var(--glass-control)] px-1 py-1 text-sm focus:border-[color:var(--color-foreground)]"
          />
          <label className="flex items-center gap-2 text-sm text-[color:var(--color-ink-soft)]">
            <input
              type="checkbox"
              name="isPreferred"
              className="daybreak-field h-4 w-4 accent-current"
            />
            Preferred
          </label>
          <button
            type="submit"
            className="daybreak-button border border-[color:var(--color-border)] px-3 py-1 font-sans text-xs tracking-normal hover:bg-[color:var(--color-surface-muted,transparent)]"
          >
            Add
          </button>
        </form>
      </section>
    </div>
  );
}

type PlaceRowData = Awaited<ReturnType<typeof listPlaces>>[number];

function PlaceRow({ place, isCurrent }: { place: PlaceRowData; isCurrent: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <div className="flex flex-col">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-lg tracking-tight">{place.name}</span>
          {place.country ? (
            <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
              {place.country}
            </span>
          ) : null}
          {place.isPreferred ? (
            <span className="font-sans text-xs tracking-normal text-[color:var(--color-freedom-location,#3730a3)]">
              Preferred
            </span>
          ) : null}
          {isCurrent ? (
            <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
              Currently here
            </span>
          ) : null}
          {place.role ? (
            <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
              {place.role}
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {!isCurrent ? (
          <form action={startStay}>
            <input type="hidden" name="placeId" value={place.id} />
            <button
              type="submit"
              className="daybreak-button font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-foreground)]"
            >
              Start stay
            </button>
          </form>
        ) : null}
        <form action={togglePreferred}>
          <input type="hidden" name="id" value={place.id} />
          <button
            type="submit"
            className="daybreak-button font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-foreground)]"
          >
            {place.isPreferred ? "Unpin" : "Pin"}
          </button>
        </form>
        <form action={archivePlace}>
          <input type="hidden" name="id" value={place.id} />
          <button
            type="submit"
            className="daybreak-button font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-accent-warning,#9a3412)]"
          >
            Archive
          </button>
        </form>
      </div>
    </div>
  );
}
