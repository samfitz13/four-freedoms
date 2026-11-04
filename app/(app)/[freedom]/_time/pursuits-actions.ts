"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "@/lib/auth-server";
import { db } from "@/lib/db/client";
import { scopeForUser } from "@/lib/db/scope";
import { timeLogEntries, timePursuits } from "@/lib/db/schema";
import { ensureTimeSeeded } from "@/lib/freedoms/time-seed";
import { optionalNumber, optionalString, pursuitKindSchema, str } from "./schemas";
import type { ActionResult } from "./types";

const colorFallbacks = {
  work: "var(--color-freedom-time)",
  play: "var(--color-freedom-location)",
  care: "var(--color-freedom-health)",
  rest: "var(--color-ink-soft)",
  admin: "var(--color-border)",
} as const;

const pursuitSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1).max(80),
  kind: pursuitKindSchema,
  colorVar: z.string().min(1).max(80).optional(),
  matters: z.boolean(),
  weeklyTargetHours: z.number().finite().min(0).max(168).optional(),
});

export async function createPursuit(formData: FormData): Promise<void> {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);
  await ensureTimeSeeded(scope.primaryHouseholdId);

  const parsed = pursuitSchema.safeParse({
    name: str(formData, "name"),
    kind: str(formData, "kind"),
    colorVar: optionalString(formData, "colorVar") ?? undefined,
    matters: str(formData, "matters") === "on",
    weeklyTargetHours: optionalNumber(formData, "weeklyTargetHours"),
  });
  if (!parsed.success) return;

  await db.insert(timePursuits).values({
    id: randomUUID(),
    householdId: scope.primaryHouseholdId,
    name: parsed.data.name,
    kind: parsed.data.kind,
    colorVar: parsed.data.colorVar ?? colorFallbacks[parsed.data.kind],
    matters: parsed.data.matters,
    weeklyTargetHours:
      parsed.data.weeklyTargetHours === undefined ? null : parsed.data.weeklyTargetHours.toFixed(2),
  });

  revalidateTime();
}

export async function updatePursuit(formData: FormData): Promise<void> {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);
  const parsed = pursuitSchema.safeParse({
    id: str(formData, "id"),
    name: str(formData, "name"),
    kind: str(formData, "kind"),
    colorVar: optionalString(formData, "colorVar") ?? undefined,
    matters: str(formData, "matters") === "on",
    weeklyTargetHours: optionalNumber(formData, "weeklyTargetHours"),
  });
  if (!parsed.success) return;

  await db
    .update(timePursuits)
    .set({
      name: parsed.data.name,
      kind: parsed.data.kind,
      colorVar: parsed.data.colorVar ?? colorFallbacks[parsed.data.kind],
      matters: parsed.data.matters,
      weeklyTargetHours:
        parsed.data.weeklyTargetHours === undefined
          ? null
          : parsed.data.weeklyTargetHours.toFixed(2),
    })
    .where(
      and(
        eq(timePursuits.id, parsed.data.id!),
        eq(timePursuits.householdId, scope.primaryHouseholdId),
      ),
    );

  revalidateTime();
}

export async function archivePursuit(formData: FormData) {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);
  const id = str(formData, "id");
  if (!id) return;
  await db
    .update(timePursuits)
    .set({ archivedAt: new Date() })
    .where(and(eq(timePursuits.id, id), eq(timePursuits.householdId, scope.primaryHouseholdId)));
  revalidateTime();
}

export async function mergePursuits(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);
  const fromId = str(formData, "fromId");
  const toId = str(formData, "toId");
  if (!fromId || !toId || fromId === toId) {
    return { ok: false, error: "Choose two different pursuits." };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(timeLogEntries)
      .set({ pursuitId: toId })
      .where(
        and(
          eq(timeLogEntries.householdId, scope.primaryHouseholdId),
          eq(timeLogEntries.pursuitId, fromId),
        ),
      );
    await tx
      .update(timePursuits)
      .set({ archivedAt: new Date() })
      .where(
        and(eq(timePursuits.id, fromId), eq(timePursuits.householdId, scope.primaryHouseholdId)),
      );
  });

  revalidateTime();
  return { ok: true, message: "Pursuits merged." };
}

export async function reorderPursuits(formData: FormData) {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);
  const ids = formData
    .getAll("id")
    .map((value) => (typeof value === "string" ? value : ""))
    .filter(Boolean);
  await db.transaction(async (tx) => {
    for (const [index, id] of ids.entries()) {
      await tx
        .update(timePursuits)
        .set({ sortOrder: index * 10 })
        .where(
          and(eq(timePursuits.id, id), eq(timePursuits.householdId, scope.primaryHouseholdId)),
        );
    }
  });
  revalidateTime();
}

function revalidateTime() {
  revalidatePath("/time", "layout");
  revalidatePath("/dashboard");
}
