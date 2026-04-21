import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-server";
import { SignOutButton } from "./sign-out-button";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const { user } = session;

  return (
    <div className="mx-auto flex min-h-svh max-w-5xl flex-col px-6 py-10">
      <header className="flex items-center justify-between border-b border-[color:var(--color-border)] pb-6 text-sm">
        <Link
          href="/dashboard"
          className="font-mono tracking-tight text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-foreground)]"
        >
          freedom-four
        </Link>

        <nav className="flex items-center gap-6 text-[color:var(--color-ink-soft)]">
          <Link href="/dashboard" className="hover:text-[color:var(--color-foreground)]">
            Dashboard
          </Link>
          <Link href="/check-in" className="hover:text-[color:var(--color-foreground)]">
            Check-in
          </Link>
          <Link href="/review" className="hover:text-[color:var(--color-foreground)]">
            Review
          </Link>
          <Link href="/settings" className="hover:text-[color:var(--color-foreground)]">
            Settings
          </Link>
          <SignOutButton />
        </nav>
      </header>

      <main className="flex-1 py-10">{children}</main>

      <footer className="mt-10 border-t border-[color:var(--color-border)] pt-6 font-mono text-xs tracking-tight text-[color:var(--color-ink-soft)]">
        <span>{user.email}</span>
      </footer>
    </div>
  );
}
