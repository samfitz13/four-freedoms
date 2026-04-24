"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { entries } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth-server";
import { getPrimaryHouseholdId } from "@/lib/db/scope";
import { FREEDOMS } from "@/lib/freedoms/constants";
import type { FreedomKey } from "@/lib/freedoms/types";
import { freedomModules } from "@/lib/freedoms";
import type { CheckInResult } from "./types";

/**
 * Accept a FormData from the check-in page and upsert one entry per freedom
 * where at least one field has a value. Silently skips freedoms the user
 * left blank. Upserts on (household_id, freedom, occurred_on).
 */
export async function submitCheckIn(
  _prev: CheckInResult | null,
  formData: FormData,
): Promise<CheckInResult> {
  const user = await requireUser();
  const householdId = await getPrimaryHouseholdId(user.id);

  const occurredOn = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .safeParse(formData.get("occurredOn"));
  if (!occurredOn.success) {
    return { ok: false, error: "Invalid date." };
  }

  const toInsert: Array<typeof entries.$inferInsert> = [];
  const written: FreedomKey[] = [];

  for (const meta of FREEDOMS) {
    const mod = freedomModules[meta.key];
    const raw: Record<string, unknown> = {};

    for (const field of mod.fields) {
      const v = formData.get(`${meta.key}.${field.name}`);
      if (v === null) continue;
      const s = typeof v === "string" ? v.trim() : "";
      if (s === "" && field.kind !== "boolean") continue;

      switch (field.kind) {
        case "number":
        case "currency": {
          const n = Number(s);
          if (Number.isFinite(n)) raw[field.name] = n;
          break;
        }
        case "percent": {
          const n = Number(s);
          if (Number.isFinite(n)) raw[field.name] = n / 100;
          break;
        }
        case "int": {
          const n = Math.round(Number(s));
          if (Number.isFinite(n)) raw[field.name] = n;
          break;
        }
        case "boolean": {
          raw[field.name] = s === "on" || s === "true";
          break;
        }
        case "text": {
          if (s) raw[field.name] = s;
          break;
        }
      }
    }

    if (Object.keys(raw).length === 0) continue;

    const parsed = mod.payloadSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: `${meta.label}: ${parsed.error.issues[0]?.message ?? "invalid input"}`,
      };
    }

    toInsert.push({
      id: randomUUID(),
      householdId,
      authorId: user.id,
      freedom: meta.key,
      occurredOn: occurredOn.data,
      payload: parsed.data as Record<string, unknown>,
      source: "manual",
    });
    written.push(meta.key);
  }

  if (toInsert.length === 0) {
    return { ok: false, error: "Nothing to save — add a value in at least one section." };
  }

  // Upsert: replace same-day entries for this household+freedom so the
  // check-in page is idempotent and editable.
  for (const row of toInsert) {
    await db
      .insert(entries)
      .values(row)
      .onConflictDoUpdate({
        target: [entries.householdId, entries.freedom, entries.occurredOn],
        set: {
          payload: row.payload,
          authorId: row.authorId,
          source: row.source,
          updatedAt: new Date(),
        },
      });
  }

  revalidatePath("/dashboard");
  revalidatePath("/check-in");
  for (const k of written) revalidatePath(`/${k}`);

  return { ok: true, written };
}
