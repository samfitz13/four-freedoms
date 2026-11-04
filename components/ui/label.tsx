import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn("text-xs text-[color:var(--color-ink-soft)]", className)}
      {...props}
    />
  );
}
