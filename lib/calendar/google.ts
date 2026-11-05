import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { calendarAccounts, timeEvents } from "@/lib/db/schema";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { env } from "@/lib/env";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events.readonly",
];

export function googleCalendarConfigured(): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI);
}

export function buildGoogleCalendarAuthUrl(state: string): string | null {
  if (!googleCalendarConfigured()) return null;
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", env.GOOGLE_CLIENT_ID!);
  url.searchParams.set("redirect_uri", env.GOOGLE_REDIRECT_URI!);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeGoogleCalendarCode(householdId: string, code: string) {
  if (!googleCalendarConfigured()) throw new Error("Google Calendar is not configured.");
  const token = await tokenRequest({
    code,
    client_id: env.GOOGLE_CLIENT_ID!,
    client_secret: env.GOOGLE_CLIENT_SECRET!,
    redirect_uri: env.GOOGLE_REDIRECT_URI!,
    grant_type: "authorization_code",
  });
  if (!token.refresh_token) throw new Error("Google did not return a refresh token.");

  const userinfo = await googleGet<{ id: string; email?: string }>(
    USERINFO_URL,
    token.access_token,
  );
  await db
    .insert(calendarAccounts)
    .values({
      id: randomUUID(),
      householdId,
      provider: "google",
      externalAccountId: userinfo.id,
      displayEmail: userinfo.email ?? null,
      accessToken: encryptSecret(token.access_token),
      refreshToken: encryptSecret(token.refresh_token),
      accessTokenExpiresAt: new Date(Date.now() + token.expires_in * 1000),
    })
    .onConflictDoUpdate({
      target: [
        calendarAccounts.householdId,
        calendarAccounts.provider,
        calendarAccounts.externalAccountId,
      ],
      set: {
        displayEmail: userinfo.email ?? null,
        accessToken: encryptSecret(token.access_token),
        refreshToken: encryptSecret(token.refresh_token),
        accessTokenExpiresAt: new Date(Date.now() + token.expires_in * 1000),
        disabledAt: null,
      },
    });
}

export async function syncGoogleCalendarAccount(accountId: string) {
  const [account] = await db
    .select()
    .from(calendarAccounts)
    .where(eq(calendarAccounts.id, accountId))
    .limit(1);
  if (!account || account.disabledAt) return;

  const accessToken = await validAccessToken(account);
  let syncToken = account.syncToken;
  let pageToken: string | null = null;
  let fullResync = !syncToken;

  do {
    const url = new URL(EVENTS_URL);
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("showDeleted", "true");
    url.searchParams.set("maxResults", "250");
    if (syncToken) {
      url.searchParams.set("syncToken", syncToken);
    } else {
      url.searchParams.set(
        "timeMin",
        new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString(),
      );
      url.searchParams.set(
        "timeMax",
        new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString(),
      );
    }
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (response.status === 410 && syncToken) {
      syncToken = null;
      pageToken = null;
      fullResync = true;
      continue;
    }
    if (!response.ok) throw new Error("Google Calendar sync failed.");
    const payload = (await response.json()) as GoogleEventsPayload;
    for (const event of payload.items ?? []) {
      await upsertGoogleEvent(account.householdId, account.id, event);
    }
    pageToken = payload.nextPageToken ?? null;
    if (!pageToken && payload.nextSyncToken) syncToken = payload.nextSyncToken;
    fullResync = false;
  } while (pageToken || fullResync);

  await db
    .update(calendarAccounts)
    .set({ syncToken, lastSyncedAt: new Date() })
    .where(eq(calendarAccounts.id, account.id));
}

async function validAccessToken(account: typeof calendarAccounts.$inferSelect): Promise<string> {
  const expires = account.accessTokenExpiresAt?.getTime() ?? 0;
  if (expires > Date.now() + 60_000) return decryptSecret(account.accessToken);
  const token = await tokenRequest({
    refresh_token: decryptSecret(account.refreshToken),
    client_id: env.GOOGLE_CLIENT_ID!,
    client_secret: env.GOOGLE_CLIENT_SECRET!,
    grant_type: "refresh_token",
  });
  await db
    .update(calendarAccounts)
    .set({
      accessToken: encryptSecret(token.access_token),
      accessTokenExpiresAt: new Date(Date.now() + token.expires_in * 1000),
    })
    .where(eq(calendarAccounts.id, account.id));
  return token.access_token;
}

async function upsertGoogleEvent(householdId: string, accountId: string, event: GoogleEvent) {
  if (!event.id) return;
  if (event.status === "cancelled") {
    await db
      .update(timeEvents)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(
        and(
          eq(timeEvents.householdId, householdId),
          eq(timeEvents.source, "google"),
          eq(timeEvents.externalId, event.id),
        ),
      );
    return;
  }
  const startsAt = parseGoogleDate(event.start);
  const endsAt = parseGoogleDate(event.end);
  if (!startsAt || !endsAt) return;
  await db
    .insert(timeEvents)
    .values({
      id: randomUUID(),
      householdId,
      source: "google",
      externalId: event.id,
      calendarAccountId: accountId,
      title: event.summary ?? "(untitled)",
      location: event.location ?? null,
      description: event.description ?? null,
      startsAt,
      endsAt,
      allDay: Boolean(event.start?.date),
      timezone: event.start?.timeZone ?? "UTC",
      status: event.status === "tentative" ? "tentative" : "confirmed",
    })
    .onConflictDoUpdate({
      target: [timeEvents.householdId, timeEvents.source, timeEvents.externalId],
      set: {
        calendarAccountId: accountId,
        title: event.summary ?? "(untitled)",
        location: event.location ?? null,
        description: event.description ?? null,
        startsAt,
        endsAt,
        allDay: Boolean(event.start?.date),
        timezone: event.start?.timeZone ?? "UTC",
        status: event.status === "tentative" ? "tentative" : "confirmed",
        updatedAt: new Date(),
      },
    });
}

async function tokenRequest(body: Record<string, string>) {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  if (!response.ok) throw new Error("Google OAuth token request failed.");
  return (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
}

async function googleGet<T>(url: string, accessToken: string): Promise<T> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error("Google request failed.");
  return (await response.json()) as T;
}

function parseGoogleDate(value?: { date?: string; dateTime?: string }): Date | null {
  const raw = value?.dateTime ?? value?.date;
  return raw ? new Date(raw) : null;
}

type GoogleEventsPayload = {
  items?: GoogleEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
};

type GoogleEvent = {
  id?: string;
  status?: string;
  summary?: string;
  location?: string;
  description?: string;
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
};
