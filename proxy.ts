import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/financial",
  "/location",
  "/time",
  "/health",
  "/settings",
  "/onboarding",
  "/relations",
  "/review",
];

const AUTH_ROUTES = ["/login"];

/**
 * Lightweight middleware — does NOT verify the session (that's a DB hit we
 * avoid in the edge hot path). We just check presence/shape of the session
 * cookie and redirect unauthenticated requests away from protected routes.
 *
 * Server components still call `auth.api.getSession()` to verify; this is
 * just a UX short-circuit.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = getSessionCookie(request);

  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
  const isAuthRoute = AUTH_ROUTES.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (isProtected && !sessionCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  // Authed users hitting /login get bounced to /dashboard — but ONLY when
  // they arrived there on their own. If a `next=` is present the user was
  // redirected here by `requireUser()`, meaning the server could not
  // actually verify the session even though the cookie looked valid
  // (stale / cross-db cookie / revoked session). Bouncing back would loop.
  const hasNextParam = request.nextUrl.searchParams.has("next");
  if (isAuthRoute && sessionCookie && !hasNextParam) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
