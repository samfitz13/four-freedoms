/**
 * Small server-side helpers around better-auth, so route handlers and RSCs
 * don't import `next/headers` + config boilerplate everywhere.
 */
import "server-only";
import { headers as nextHeaders } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export async function getSession() {
  return auth.api.getSession({
    headers: await nextHeaders(),
  });
}

/**
 * RSC-safe: redirects unauthenticated users to /login with a `next=`
 * pointer back to the current path. Do NOT wrap in try/catch — `redirect()`
 * throws a framework-internal sentinel that Next.js must see escape.
 */
export async function requireSession(nextPath?: string) {
  const session = await getSession();
  if (!session?.user) {
    // Always carry a `next=` marker so the proxy can distinguish this
    // redirect (stale/invalid server session) from an authed user who
    // navigated to /login on their own — otherwise the cookie-presence
    // proxy check can flip them straight back and we loop.
    const next = encodeURIComponent(nextPath ?? "/");
    redirect(`/login?next=${next}`);
  }
  return session;
}

export async function requireUser(nextPath?: string) {
  const session = await requireSession(nextPath);
  return session.user;
}
