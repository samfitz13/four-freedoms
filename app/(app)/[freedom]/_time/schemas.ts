import { z } from "zod";

export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const pursuitKindSchema = z.enum(["work", "play", "care", "rest", "admin"]);

export const habitCadenceSchema = z.enum(["daily", "weekly", "custom"]);

export const eventStatusSchema = z.enum(["confirmed", "tentative", "cancelled"]);

export function str(fd: FormData, key: string): string {
  const value = fd.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function optionalString(fd: FormData, key: string): string | null {
  const value = str(fd, key);
  return value === "" ? null : value;
}

export function optionalNumber(fd: FormData, key: string): number | undefined {
  const value = str(fd, key);
  if (value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
