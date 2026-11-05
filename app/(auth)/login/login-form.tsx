"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

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
        <p className="font-display text-lg">Check your inbox.</p>
        <p className="text-sm text-[color:var(--color-ink-soft)]">
          A sign-in link is on its way to <strong>{state.email}</strong>. It opens a session in this
          browser.
        </p>
        {env.NEXT_PUBLIC_SITE_URL?.includes("localhost") ? (
          <p className="font-sans text-xs text-[color:var(--color-ink-soft)]">
            Dev mode: if no RESEND_API_KEY is set, the link is printed to the server console.
          </p>
        ) : null}
      </div>
    );
  }

  const pending = state.status === "sending";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Label className="flex flex-col gap-2">
        <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
          Email
        </span>
        <Input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="you@domain.com"
          className="text-base"
        />
      </Label>

      {state.status === "error" ? (
        <p role="alert" className="text-sm text-[color:var(--color-freedom-health)]">
          {state.message}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} variant="primary">
        {pending ? "Sending…" : "Send magic link"}
      </Button>
    </form>
  );
}
