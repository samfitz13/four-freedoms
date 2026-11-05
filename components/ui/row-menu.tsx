"use client";

import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";

const SelectionContext = createContext<((submit: boolean) => void) | null>(null);

export function RowMenu({
  label = "More",
  children,
  align = "right",
}: {
  label?: string;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const submitRef = useRef(false);
  return (
    <SelectionContext.Provider
      value={(submit) => {
        // Focus a durable opener before an item can unmount itself to open a dialog.
        triggerRef.current?.focus({ preventScroll: true });
        submitRef.current = submit;
      }}
    >
      <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button ref={triggerRef} size="icon" aria-label={label}>
            <span aria-hidden>⋯</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align={align === "right" ? "end" : "start"}
          aria-label={label}
          onCloseAutoFocus={(event) => {
            if (submitRef.current) {
              submitRef.current = false;
              event.preventDefault();
              // Validate after the menu releases focus, so invalid fields keep it.
              const form = triggerRef.current?.form;
              if (form) {
                const valid = form.checkValidity();
                form.requestSubmit();
                if (valid) triggerRef.current?.focus({ preventScroll: true });
              }
              return;
            }
            // A menu action may have opened a dialog. Do not steal its focus.
            const topDialog = Array.from(document.querySelectorAll('[role="dialog"]')).at(-1);
            if (topDialog && !topDialog.contains(triggerRef.current)) event.preventDefault();
          }}
        >
          {children(() => setOpen(false))}
        </DropdownMenuContent>
      </DropdownMenu>
    </SelectionContext.Provider>
  );
}

export function RowMenuItem({
  onSelect,
  children,
  tone = "default",
  type = "button",
}: {
  onSelect?: () => void;
  children: ReactNode;
  tone?: "default" | "warning";
  type?: "button" | "submit";
}) {
  const prepareSelection = useContext(SelectionContext);
  return (
    <DropdownMenuItem
      tone={tone}
      onSelect={() => {
        prepareSelection?.(type === "submit");
        onSelect?.();
      }}
    >
      {children}
    </DropdownMenuItem>
  );
}
