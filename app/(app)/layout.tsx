import Link from "next/link";
import { requireUser } from "@/lib/auth-server";
import { FREEDOMS } from "@/lib/freedoms/constants";
import { AppNav, FreedomNav } from "./app-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Carries the `?next=/` marker so the proxy's "authed user on /login →
  // /dashboard" convenience doesn't loop when the cookie is stale.
  await requireUser();

  return (
    <div className="daybreak-shell">
      <a href="#main-content" className="skip-link daybreak-button">
        Skip to content
      </a>
      <header className="daybreak-shell-top">
        <Link href="/dashboard" className="flex min-h-11 items-center gap-3">
          <span className="grid grid-cols-2 gap-1" aria-hidden>
            {FREEDOMS.map((freedom) => (
              <span key={freedom.key} data-freedom={freedom.key} className="daybreak-brand-tile" />
            ))}
          </span>
          <span className="brand-mark">
            freedom<span className="mx-1">/</span>four
          </span>
        </Link>

        <p className="daybreak-date">
          {new Intl.DateTimeFormat("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          }).format(new Date())}
        </p>
      </header>
      <div className="daybreak-shell-body">
        <aside className="daybreak-sidebar">
          <p className="daybreak-rail-label">Your world</p>
          <FreedomNav />
          <AppNav />
          <p className="daybreak-rail-foot">
            At your pace.
            <br />
            In your own way.
          </p>
        </aside>
        <main id="main-content" tabIndex={-1} className="daybreak-workspace">
          {children}
        </main>
      </div>
    </div>
  );
}
