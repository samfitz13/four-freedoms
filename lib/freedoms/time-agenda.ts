import "server-only";
import { RRule } from "rrule";
import { listTimeEvents } from "@/lib/db/queries/time";
import { agendaVestMarkers } from "@/lib/correspondences/financial-time";

export async function listAgendaEvents(
  householdId: string,
  from: Date,
  to: Date,
): Promise<
  Array<
    Awaited<ReturnType<typeof listTimeEvents>>[number] & {
      occurrenceStartsAt: Date;
      occurrenceEndsAt: Date;
    }
  >
> {
  const [rows, vestMarkers] = await Promise.all([
    listTimeEvents(householdId, from, to),
    agendaVestMarkers(householdId, from, to),
  ]);
  const folded: Array<
    Awaited<ReturnType<typeof listTimeEvents>>[number] & {
      occurrenceStartsAt: Date;
      occurrenceEndsAt: Date;
    }
  > = [];
  for (const row of rows) {
    if (!row.rrule) {
      folded.push({ ...row, occurrenceStartsAt: row.startsAt, occurrenceEndsAt: row.endsAt });
      continue;
    }
    const duration = row.endsAt.getTime() - row.startsAt.getTime();
    try {
      const rule = RRule.fromString(row.rrule);
      const occurrences = rule.between(from, to, true);
      for (const occurrence of occurrences) {
        folded.push({
          ...row,
          occurrenceStartsAt: occurrence,
          occurrenceEndsAt: new Date(occurrence.getTime() + duration),
        });
      }
    } catch {
      folded.push({ ...row, occurrenceStartsAt: row.startsAt, occurrenceEndsAt: row.endsAt });
    }
  }
  for (const marker of vestMarkers) {
    folded.push({
      id: marker.id,
      householdId,
      source: "native",
      externalId: marker.id,
      calendarAccountId: null,
      title: marker.title,
      location: null,
      placeId: null,
      connectionIds: [],
      description: null,
      pursuitId: null,
      startsAt: marker.startsAt,
      endsAt: marker.endsAt,
      allDay: marker.allDay,
      rrule: null,
      timezone: "UTC",
      status: "confirmed",
      updatedAt: marker.startsAt,
      createdAt: marker.startsAt,
      pursuitName: null,
      pursuitColorVar: "var(--color-freedom-financial)",
      occurrenceStartsAt: marker.startsAt,
      occurrenceEndsAt: marker.endsAt,
    });
  }

  return folded
    .filter((event) => event.status !== "cancelled")
    .sort((a, b) => a.occurrenceStartsAt.getTime() - b.occurrenceStartsAt.getTime());
}
