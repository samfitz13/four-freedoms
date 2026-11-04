import type { ReactNode } from "react";

/** A section boundary so action revalidation includes every tab below it. */
export default function FreedomLayout({ children }: { children: ReactNode }) {
  return children;
}
