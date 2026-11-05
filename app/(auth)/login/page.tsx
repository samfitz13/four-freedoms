import Link from "next/link";
import { AppearanceControls } from "@/components/ui/appearance-controls";
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
    <main className="daybreak-public daybreak-auth flex flex-col justify-center">
      <AppearanceControls />
      <Link href="/" className="brand-mark mb-16 hover:text-[color:var(--color-foreground)]">
        ← freedom-four
      </Link>

      <div className="flex flex-col gap-3">
        <p className="eyebrow">Sign in</p>
        <h1 className="font-display text-4xl leading-[1.05] tracking-tight">Begin.</h1>
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

      <p className="brand-mark mt-16">Private beta · v0.1</p>
    </main>
  );
}
