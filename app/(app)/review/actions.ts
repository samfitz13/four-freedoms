"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { weeklyReviews } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth-server";
import { getPrimaryHouseholdId } from "@/lib/db/scope";

import type { ReviewResult } from "./types";

const reflectionsSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  wins: z.string().max(1000).optional(),
  struggles: z.string().max(1000).optional(),
  nextWeek: z.string().max(1000).optional(),
  overallScore: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .pipe(z.number().int().min(0).max(100).nullable()),
});

/**
 * Upsert a weekly_reviews row for the current week. Idempotent via the
 * (household_id, week_start) unique index.
 */
export async function submitReview(
  _prev: ReviewResult | null,
  formData: FormData,
): Promise<ReviewResult> {
  const user = await requireUser();
  const householdId = await getPrimaryHouseholdId(user.id);

  const parsed = reflectionsSchema.safeParse({
    weekStart: formData.get("weekStart"),
    wins: formData.get("wins") ?? undefined,
    struggles: formData.get("struggles") ?? undefined,
    nextWeek: formData.get("nextWeek") ?? undefined,
    overallScore: formData.get("overallScore") ?? undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { weekStart, wins, struggles, nextWeek, overallScore } = parsed.data;
  const reflections = {
    ...(wins?.trim() ? { wins: wins.trim() } : {}),
    ...(struggles?.trim() ? { struggles: struggles.trim() } : {}),
    ...(nextWeek?.trim() ? { nextWeek: nextWeek.trim() } : {}),
  };

  if (!Object.keys(reflections).length && overallScore === null) {
    return { ok: false, error: "Add at least one reflection or score before saving." };
  }

  await db
    .insert(weeklyReviews)
    .values({
      id: randomUUID(),
      householdId,
      authorId: user.id,
      weekStart,
      reflectionsJson: reflections,
      overallScore,
    })
    .onConflictDoUpdate({
      target: [weeklyReviews.householdId, weeklyReviews.weekStart],
      set: {
        reflectionsJson: reflections,
        overallScore,
        authorId: user.id,
        updatedAt: new Date(),
      },
    });

  revalidatePath("/dashboard");
  revalidatePath("/review");
  return { ok: true, weekStart };
}
