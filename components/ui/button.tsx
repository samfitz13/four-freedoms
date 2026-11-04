import type { ComponentProps } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

export function Button({
  asChild = false,
  variant = "default",
  size = "default",
  className,
  type,
  ...props
}: ComponentProps<"button"> & {
  asChild?: boolean;
  variant?: "default" | "primary" | "warning";
  size?: "default" | "icon";
}) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      data-slot="button"
      type={asChild ? type : (type ?? "button")}
      className={cn(
        "daybreak-button",
        variant === "primary" && "daybreak-button-primary",
        variant === "warning" && "text-[color:var(--color-accent-warning)]",
        size === "icon" && "daybreak-icon-button",
        className,
      )}
      {...props}
    />
  );
}
