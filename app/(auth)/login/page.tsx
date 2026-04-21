import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "Sign in",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-6 py-16">
      <Link
        href="/"
        className="mb-16 font-mono text-xs tracking-tight text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-foreground)]"
      >
        ← freedom-four
      </Link>

      <div className="flex flex-col gap-3">
        <p className="font-mono text-xs tracking-[0.18em] text-[color:var(--color-ink-soft)] uppercase">
          Sign in
        </p>
        <h1 className="font-serif text-4xl leading-[1.05] tracking-tight">Begin.</h1>
        <p className="text-[color:var(--color-ink-soft)]">
          We&rsquo;ll email you a single-use link. No password.
        </p>
      </div>

      {error ? (
        <p className="mt-6 rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--color-paper-soft)] px-3 py-2 text-sm text-[color:var(--color-freedom-health)]">
          {error}
        </p>
      ) : null}

      <div className="mt-10">
        <LoginForm next={next} />
      </div>

      <p className="mt-16 font-mono text-xs tracking-tight text-[color:var(--color-ink-soft)]">
        Private beta · v0.1
      </p>
    </main>
  );
}
