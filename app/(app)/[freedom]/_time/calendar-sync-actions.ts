"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { requireSession, requireUser } from "@/lib/auth-server";
import {
  buildGoogleCalendarAuthUrl,
  googleCalendarConfigured,
  syncGoogleCalendarAccount,
} from "@/lib/calendar/google";
import { createCalendarOAuthState } from "@/lib/calendar/oauth-state";
import { db } from "@/lib/db/client";
import { scopeForUser } from "@/lib/db/scope";
import { calendarAccounts, timeEvents } from "@/lib/db/schema";
import { str } from "./schemas";

export async function connectGoogle(formData: FormData) {
  const session = await requireSession("/time/agenda");
  if (!googleCalendarConfigured()) return;
  const scope = await scopeForUser(session.user.id);
  const redirectUrl = str(formData, "redirectUrl") || "/time/agenda";
  const state = await createCalendarOAuthState(
    session.session.id,
    scope.primaryHouseholdId,
    redirectUrl,
  );
  const url = buildGoogleCalendarAuthUrl(state);
  if (url) redirect(url);
}

export async function disconnectGoogle(formData: FormData) {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);
  const purge = str(formData, "purge") === "on";
  const id = str(formData, "id");
  if (!id) return;

  await db.transaction(async (tx) => {
    await tx
      .update(calendarAccounts)
      .set({ disabledAt: new Date(), accessToken: "disabled", refreshToken: "disabled" })
      .where(
        and(
          eq(calendarAccounts.id, id),
          eq(calendarAccounts.householdId, scope.primaryHouseholdId),
        ),
      );
    if (purge) {
      await tx
        .delete(timeEvents)
        .where(
          and(
            eq(timeEvents.householdId, scope.primaryHouseholdId),
            eq(timeEvents.source, "google"),
            eq(timeEvents.calendarAccountId, id),
          ),
        );
    }
  });
  revalidatePath("/time", "layout");
}

export async function syncNow(formData?: FormData) {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);
  if (!googleCalendarConfigured()) return;
  const id = formData ? str(formData, "id") : "";
  const rows = await db
    .select()
    .from(calendarAccounts)
    .where(eq(calendarAccounts.householdId, scope.primaryHouseholdId));
  const accounts = id ? rows.filter((row) => row.id === id) : rows;
  for (const account of accounts) {
    if (account.disabledAt) continue;
    const last = account.lastSyncedAt?.getTime() ?? 0;
    if (Date.now() - last < 60_000) continue;
    await syncGoogleCalendarAccount(account.id);
  }
  revalidatePath("/time", "layout");
}
