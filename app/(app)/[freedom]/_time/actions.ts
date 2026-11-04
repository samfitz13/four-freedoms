"use server";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { timePursuits } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth-server";
import { getPrimaryHouseholdId } from "@/lib/db/scope";
import { ensureTimeSeeded } from "@/lib/freedoms/time-seed";
import { upsertLogEntry } from "./log-actions";

function numField(
  raw: FormDataEntryValue | null,
  { min = 0, max = 24 }: { min?: number; max?: number },
): number {
  if (typeof raw !== "string" || raw.trim() === "") return 0;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new Error(`Values must be between ${min} and ${max}.`);
  }
  return n;
}

/** Upsert today's time block. */
export async function logTimeBlock(formData: FormData) {
  const user = await requireUser();
  const householdId = await getPrimaryHouseholdId(user.id);
  await ensureTimeSeeded(householdId);
  const recordedOn =
    (formData.get("recordedOn") as string | null)?.trim() || new Date().toISOString().slice(0, 10);

  const deepWorkHours = numField(formData.get("deepWorkHours"), { max: 24 });
  const meetingHours = numField(formData.get("meetingHours"), { max: 24 });
  const obligationHours = numField(formData.get("obligationHours"), { max: 24 });
  const note = (formData.get("note") as string | null)?.trim() || null;

  const pursuits = await db
    .select()
    .from(timePursuits)
    .where(eq(timePursuits.householdId, householdId));
  const byKey = new Map(pursuits.map((p) => [p.systemKey, p.id]));

  for (const [systemKey, hours] of [
    ["deep_work", deepWorkHours],
    ["meetings", meetingHours],
    ["obligations", obligationHours],
  ] as const) {
    const pursuitId = byKey.get(systemKey);
    if (!pursuitId) continue;
    const next = new FormData();
    next.set("pursuitId", pursuitId);
    next.set("recordedOn", recordedOn);
    next.set("hours", String(hours));
    if (systemKey === "deep_work" && note) next.set("note", note);
    await upsertLogEntry(next);
  }

  return { ok: true };
}
