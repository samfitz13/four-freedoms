"use client";

import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { env } from "@/lib/env";

type State =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "sent"; email: string }
  | { status: "error"; message: string };

export function LoginForm({ next }: { next?: string }) {
  const [state, setState] = useState<State>({ status: "idle" });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    if (!email) {
      setState({ status: "error", message: "Enter an email." });
      return;
    }
    setState({ status: "sending" });

    const callbackURL = next && next.startsWith("/") ? next : "/dashboard";

    const { error } = await authClient.signIn.magicLink({
      email,
      callbackURL,
    });

    if (error) {
      setState({ status: "error", message: error.message ?? "Failed." });
      return;
    }
    setState({ status: "sent", email });
  }

  if (state.status === "sent") {
    return (
      <div className="flex flex-col gap-3 rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--color-paper-soft)] px-4 py-6">
        <p className="font-serif text-lg">Check your inbox.</p>
        <p className="text-sm text-[color:var(--color-ink-soft)]">
          A sign-in link is on its way to <strong>{state.email}</strong>. It opens a session in this
          browser.
        </p>
        {env.NEXT_PUBLIC_SITE_URL?.includes("localhost") ? (
          <p className="font-mono text-xs text-[color:var(--color-ink-soft)]">
            Dev mode: if no RESEND_API_KEY is set, the link is printed to the server console.
          </p>
        ) : null}
      </div>
    );
  }

  const pending = state.status === "sending";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-2">
        <span className="font-mono text-xs tracking-[0.14em] text-[color:var(--color-ink-soft)] uppercase">
          Email
        </span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="you@domain.com"
          className="h-11 rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-transparent px-3 text-base text-[color:var(--color-foreground)] ring-0 transition-colors outline-none focus:border-[color:var(--color-foreground)]"
        />
      </label>

      {state.status === "error" ? (
        <p className="text-sm text-[color:var(--color-freedom-health)]">{state.message}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 items-center justify-center rounded-[var(--radius-sm)] bg-[color:var(--color-foreground)] px-5 text-sm font-medium text-[color:var(--color-background)] transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send magic link"}
      </button>
    </form>
  );
}
