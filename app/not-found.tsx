import Link from "next/link";
import { AppearanceControls } from "@/components/ui/appearance-controls";

export default function NotFound() {
  return (
    <main className="daybreak-public daybreak-auth flex flex-col items-start justify-center gap-6">
      <AppearanceControls />
      <p className="eyebrow">404</p>
      <h1 className="font-display text-5xl leading-[1.02] tracking-tight">Nothing here.</h1>
      <p className="max-w-md text-sm text-[color:var(--color-ink-soft)]">
        The page you were looking for doesn&rsquo;t exist — or hasn&rsquo;t been written yet.
      </p>
      <Link
        href="/"
        className="daybreak-button inline-flex min-h-11 items-center bg-[color:var(--glass-primary)] px-4 text-sm text-[color:var(--glass-primary-ink)] hover:opacity-90"
      >
        Back home
      </Link>
    </main>
  );
}
