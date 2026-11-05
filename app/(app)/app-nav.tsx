"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, House } from "lucide-react";
import { FREEDOMS } from "@/lib/freedoms/constants";
import { FreedomIcon } from "@/components/freedoms/freedom-icon";
import { SignOutButton } from "./sign-out-button";

const LINKS = [
  { href: "/relations", label: "Patterns" },
  { href: "/review/this-week", label: "Weekly review" },
  { href: "/settings", label: "Settings" },
] as const;

export function AppNav() {
  const pathname = usePathname() ?? "";
  return (
    <div className="daybreak-utility-nav">
      <nav aria-label="Primary" className="app-primary-nav">
        {LINKS.map((l) => {
          const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? "page" : undefined}
              className="app-nav-link"
            >
              {l.label}
              <ArrowUpRight size={13} aria-hidden />
            </Link>
          );
        })}
        <SignOutButton />
      </nav>
    </div>
  );
}

export function FreedomNav() {
  const pathname = usePathname() ?? "";
  const descriptions = {
    financial: "Room to choose",
    location: "Somewhere that fits",
    time: "A little breathing room",
    health: "Find your rhythm",
  };
  return (
    <nav
      aria-label="Freedoms"
      className="daybreak-blades"
      onKeyDown={(event) => {
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        const direction = ["ArrowRight", "ArrowDown"].includes(event.key)
          ? 1
          : ["ArrowLeft", "ArrowUp"].includes(event.key)
            ? -1
            : 0;
        if (!direction) return;
        const links = Array.from(event.currentTarget.querySelectorAll<HTMLAnchorElement>("a"));
        const index = links.findIndex((link) => link === document.activeElement);
        if (index < 0) return;
        event.preventDefault();
        const next = links[(index + direction + links.length) % links.length];
        next?.focus();
        next?.click();
      }}
    >
      <Link
        href="/dashboard"
        aria-current={pathname === "/dashboard" ? "page" : undefined}
        className="daybreak-blade"
      >
        <House size={21} aria-hidden />
        <span>
          <strong>Home</strong>
          <small>The whole picture</small>
        </span>
        <span className="daybreak-blade-chevron" aria-hidden>
          ›
        </span>
      </Link>
      {FREEDOMS.map((freedom) => {
        const active = pathname === `/${freedom.key}` || pathname.startsWith(`/${freedom.key}/`);
        return (
          <Link
            key={freedom.key}
            href={`/${freedom.key}/overview`}
            data-freedom={freedom.key}
            aria-current={active ? "page" : undefined}
            className="daybreak-blade"
          >
            <FreedomIcon freedom={freedom.key} size={21} />
            <span>
              <strong>{freedom.label}</strong>
              <small>{descriptions[freedom.key]}</small>
            </span>
            <span className="daybreak-blade-chevron" aria-hidden>
              ›
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
