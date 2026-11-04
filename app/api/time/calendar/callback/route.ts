import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-server";
import { exchangeGoogleCalendarCode, syncGoogleCalendarAccount } from "@/lib/calendar/google";
import { db } from "@/lib/db/client";
import { getPrimaryHouseholdId } from "@/lib/db/scope";
import { calendarAccounts } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

export async function GET(request: Request) {
  const user = await requireUser();
  const householdId = await getPrimaryHouseholdId(user.id);
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") || "/time/agenda";
  if (!code) redirect("/time/agenda");

  await exchangeGoogleCalendarCode(householdId, code);
  const [account] = await db
    .select({ id: calendarAccounts.id })
    .from(calendarAccounts)
    .where(eq(calendarAccounts.householdId, householdId))
    .orderBy(desc(calendarAccounts.createdAt))
    .limit(1);
  if (account) await syncGoogleCalendarAccount(account.id);
  redirect(state.startsWith("/") ? state : "/time/agenda");
}
