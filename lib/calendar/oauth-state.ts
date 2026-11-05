import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { verifications } from "@/lib/db/schema";

const DEFAULT_RETURN_PATH = "/time/agenda";
const STATE_LIFETIME_MS = 10 * 60 * 1000;
const RETURN_ORIGIN = "https://calendar-return.invalid";

export async function createCalendarOAuthState(
  sessionId: string,
  householdId: string,
  returnPath: string,
): Promise<string> {
  const state = randomBytes(32).toString("base64url");
  await db.insert(verifications).values({
    id: randomUUID(),
    identifier: stateIdentifier(sessionId, householdId, state),
    value: safeReturnPath(returnPath),
    expiresAt: new Date(Date.now() + STATE_LIFETIME_MS),
  });
  return state;
}

export async function consumeCalendarOAuthState(
  sessionId: string,
  householdId: string,
  state: string | null,
): Promise<string | null> {
  if (!state || !/^[A-Za-z0-9_-]{43}$/.test(state)) return null;

  // Atomic consumption prevents concurrent callbacks from reusing the same state.
  const [verification] = await db
    .delete(verifications)
    .where(eq(verifications.identifier, stateIdentifier(sessionId, householdId, state)))
    .returning({ value: verifications.value, expiresAt: verifications.expiresAt });
  if (!verification || verification.expiresAt.getTime() <= Date.now()) return null;
  return safeReturnPath(verification.value);
}

function stateIdentifier(sessionId: string, householdId: string, state: string): string {
  const digest = createHash("sha256")
    .update(JSON.stringify([sessionId, householdId, state]))
    .digest("hex");
  return `google-calendar-oauth:${digest}`;
}

function safeReturnPath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//") || /[\\\s]/.test(value)) {
    return DEFAULT_RETURN_PATH;
  }
  try {
    const url = new URL(value, RETURN_ORIGIN);
    return url.origin === RETURN_ORIGIN && !url.pathname.startsWith("//")
      ? `${url.pathname}${url.search}${url.hash}`
      : DEFAULT_RETURN_PATH;
  } catch {
    return DEFAULT_RETURN_PATH;
  }
}
