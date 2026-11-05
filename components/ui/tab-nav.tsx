import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Route tabs are links, not ARIA tabs controlling an in-page tabpanel. */
export function TabNav({ className, ...props }: ComponentProps<"nav">) {
  return <nav data-slot="tab-nav" className={cn("daybreak-tabs", className)} {...props} />;
}

export function TabNavLink({
  active = false,
  className,
  ...props
}: ComponentProps<typeof Link> & { active?: boolean }) {
  return (
    <Link
      data-slot="tab-nav-link"
      aria-current={active ? "page" : undefined}
      className={cn("daybreak-tab", className)}
      {...props}
    />
  );
}
