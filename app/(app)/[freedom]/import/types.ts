import type { IMPORT_KINDS } from "./constants";

export type ImportKind = (typeof IMPORT_KINDS)[number];

export interface ImportRowError {
  row: number;
  message: string;
}

export interface ImportResultOk {
  ok: true;
  kind: ImportKind;
  inserted: number;
  skipped: number;
  errors: ImportRowError[];
}

export interface ImportResultErr {
  ok: false;
  error: string;
}

export type ImportResult = ImportResultOk | ImportResultErr;

export interface ImportAccountOption {
  id: string;
  name: string;
  type: string;
}
