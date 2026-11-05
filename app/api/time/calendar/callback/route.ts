import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-server";
import { exchangeGoogleCalendarCode, syncGoogleCalendarAccount } from "@/lib/calendar/google";
import { consumeCalendarOAuthState } from "@/lib/calendar/oauth-state";
import { db } from "@/lib/db/client";
import { getPrimaryHouseholdId } from "@/lib/db/scope";
import { calendarAccounts } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

export async function GET(request: Request) {
  const session = await requireSession("/time/agenda");
  const householdId = await getPrimaryHouseholdId(session.user.id);
  const url = new URL(request.url);
  const returnPath = await consumeCalendarOAuthState(
    session.session.id,
    householdId,
    url.searchParams.get("state"),
  );
  if (!returnPath) {
    return NextResponse.json(
      { error: "Invalid or expired calendar connection. Please try connecting again." },
      { status: 400 },
    );
  }
  const code = url.searchParams.get("code");
  if (!code) redirect(returnPath);

  await exchangeGoogleCalendarCode(householdId, code);
  const [account] = await db
    .select({ id: calendarAccounts.id })
    .from(calendarAccounts)
    .where(eq(calendarAccounts.householdId, householdId))
    .orderBy(desc(calendarAccounts.createdAt))
    .limit(1);
  if (account) await syncGoogleCalendarAccount(account.id);
  redirect(returnPath);
}
