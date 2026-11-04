"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import { useActionState, useState } from "react";
import { updateBirthDate } from "./actions";
import type { ProfileActionResult } from "./types";

export function ProfileForm({ birthDate, today }: { birthDate: string | null; today: string }) {
  const [value, setValue] = useState(birthDate ?? "");
  const [state, action, pending] = useActionState<ProfileActionResult, FormData>(
    updateBirthDate,
    null,
  );
  return (
    <form action={action} className="flex flex-col items-start gap-3">
      <Label htmlFor="birthDate" className="text-sm">
        Date of birth
      </Label>
      <div className="flex max-w-full flex-wrap items-center gap-3">
        <Input
          id="birthDate"
          name="birthDate"
          type="date"
          autoComplete="bday"
          max={today}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="w-auto max-w-full"
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save birth date"}
        </Button>
      </div>
      {state && (
        <p role={state.ok ? "status" : "alert"} className="text-sm">
          {state.message}
        </p>
      )}
    </form>
  );
}
