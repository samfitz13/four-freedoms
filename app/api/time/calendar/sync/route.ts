import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-server";
import { googleCalendarConfigured, syncGoogleCalendarAccount } from "@/lib/calendar/google";
import { db } from "@/lib/db/client";
import { getPrimaryHouseholdId } from "@/lib/db/scope";
import { calendarAccounts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST() {
  const user = await requireUser();
  const householdId = await getPrimaryHouseholdId(user.id);
  if (!googleCalendarConfigured()) return NextResponse.json({ ok: true, synced: 0 });

  const accounts = await db
    .select()
    .from(calendarAccounts)
    .where(eq(calendarAccounts.householdId, householdId));
  let synced = 0;
  for (const account of accounts) {
    if (account.disabledAt) continue;
    const last = account.lastSyncedAt?.getTime() ?? 0;
    if (Date.now() - last < 60_000) continue;
    await syncGoogleCalendarAccount(account.id);
    synced += 1;
  }
  return NextResponse.json({ ok: true, synced });
}
