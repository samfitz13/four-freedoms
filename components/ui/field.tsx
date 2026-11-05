"use client";

import { useId, type ReactElement } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";
import { Label } from "./label";

/** One label and one control, without wrapping calendar or menu buttons in a label. */
export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactElement<{ id?: string }>;
  className?: string;
}) {
  const generatedId = useId();
  const id = children.props.id ?? generatedId;
  return (
    <div data-slot="field" className={cn("flex min-w-0 flex-col gap-1", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Slot id={id}>{children}</Slot>
    </div>
  );
}
