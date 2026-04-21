/**
 * Small server-side helpers around better-auth, so route handlers and RSCs
 * don't import `next/headers` + config boilerplate everywhere.
 */
import "server-only";
import { headers as nextHeaders } from "next/headers";
import { auth } from "@/lib/auth";

export async function getSession() {
  return auth.api.getSession({
    headers: await nextHeaders(),
  });
}

export async function requireUser() {
  const session = await getSession();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }
  return session.user;
}
