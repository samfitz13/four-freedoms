"use client";

import { useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "./dialog";

/** Compatibility adapter so existing forms share Radix's dialog behavior. */
export function Modal({
  open,
  onClose,
  title,
  description,
  size = "md",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: "sm" | "md" | "lg" | "xl";
  children: ReactNode;
}) {
  const openerRef = useRef<HTMLElement | null>(null);
  const width =
    size === "sm"
      ? "max-w-md"
      : size === "lg"
        ? "max-w-3xl"
        : size === "xl"
          ? "max-w-5xl"
          : "max-w-xl";
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        className={width}
        {...(!description ? { "aria-describedby": undefined } : {})}
        onOpenAutoFocus={() => {
          // Existing launchers control open state without a DialogTrigger.
          const focused = document.activeElement;
          openerRef.current = focused instanceof HTMLElement ? focused : null;
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (openerRef.current?.isConnected) openerRef.current.focus({ preventScroll: true });
        }}
      >
        <div className="daybreak-dialog-content flex flex-col gap-6">
          <header className="flex items-start justify-between gap-5">
            <div className="flex min-w-0 flex-col gap-2">
              <DialogTitle>{title}</DialogTitle>
              {description ? <DialogDescription>{description}</DialogDescription> : null}
            </div>
            <DialogClose asChild>
              <Button size="icon" aria-label="Close dialog">
                <X size={18} aria-hidden />
              </Button>
            </DialogClose>
          </header>
          <div className="flex min-w-0 flex-col gap-4">{open ? children : null}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
