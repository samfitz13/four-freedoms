import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Retain native selection, validation, and FormData behavior. */
export function NativeSelect({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "daybreak-field min-h-11 w-full min-w-0 px-3 text-sm focus:border-[color:var(--color-foreground)] disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}
