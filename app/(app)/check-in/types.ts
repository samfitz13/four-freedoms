import type { FreedomKey } from "@/lib/freedoms/types";

export interface CheckInResultOk {
  ok: true;
  written: FreedomKey[];
}

export interface CheckInResultErr {
  ok: false;
  error: string;
}

export type CheckInResult = CheckInResultOk | CheckInResultErr;
