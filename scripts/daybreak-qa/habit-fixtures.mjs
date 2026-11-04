// Synthetic records only. This module has no persistence or database access.
export function habitFixtures(today = new Date().toISOString().slice(0, 10)) {
  const ago = (days) => {
    const date = new Date(`${today}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - days);
    return date.toISOString().slice(0, 10);
  };
  const pursuit = {
    id: "qa-reading",
    householdId: "qa-household",
    name: "A little curiosity",
    kind: "play",
    matters: true,
    colorVar: "var(--color-freedom-time)",
    sortOrder: 0,
    archivedAt: null,
    createdAt: new Date(`${ago(60)}T00:00:00Z`),
  };
  const samples = [
    {
      id: "qa-read",
      title: "Read a few pages",
      cadence: "daily",
      targetPerWeek: 7,
      timeOfDay: "Before bed",
      linkKind: "none",
      linkParams: {},
      pursuit,
      offsets: [0, 1, 2, 4, 6, 8, 10, 11, 13, 17, 19, 21, 25],
    },
    {
      id: "qa-walk",
      title: "Go for a walk",
      cadence: "custom",
      targetPerWeek: 4,
      timeOfDay: "After lunch",
      linkKind: "none",
      linkParams: {},
      pursuit: null,
      offsets: [1, 3, 5, 6, 9, 10, 13, 18, 22, 24],
    },
    {
      id: "qa-sleep",
      title: "Get seven hours of sleep",
      cadence: "daily",
      targetPerWeek: 5,
      timeOfDay: null,
      linkKind: "sleep",
      linkParams: { minHours: 7 },
      pursuit: null,
      offsets: [0, 1, 3, 5, 6, 8, 9, 12, 15, 16, 18, 20, 24, 26],
    },
  ];
  return {
    today,
    pursuits: [pursuit],
    habits: samples.map(({ offsets, ...habit }) => ({
      ...habit,
      householdId: "qa-household",
      pursuitId: habit.pursuit?.id ?? null,
      startedOn: ago(40),
      archivedAt: null,
      createdAt: new Date(`${ago(40)}T00:00:00Z`),
      checkins: offsets.map((offset) => ({
        id: `${habit.id}-${offset}`,
        householdId: "qa-household",
        habitId: habit.id,
        occurredOn: ago(offset),
        note: null,
        createdAt: new Date(`${ago(offset)}T00:00:00Z`),
      })),
    })),
  };
}
