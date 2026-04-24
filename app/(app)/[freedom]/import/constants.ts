/** Hard cap per upload. Synchronous inserts — we don't want to OOM the server. */
export const MAX_ROWS = 5_000;

/** Max file size — ~2MB is generous for 5k rows of CSV. */
export const MAX_BYTES = 2 * 1024 * 1024;

export const IMPORT_KINDS = ["accounts", "transactions", "holdings"] as const;
