import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-server";
import { getPrimaryHouseholdId } from "@/lib/db/scope";

export async function healthScope() {
  const user = await requireUser();
  return getPrimaryHouseholdId(user.id);
}

export function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function note(formData: FormData): string | null {
  const value = str(formData, "note");
  return value ? value.slice(0, 500) : null;
}

export function id(formData: FormData): string {
  const value = str(formData, "id");
  if (!value) throw new Error("Missing id.");
  return value;
}

export function isoDate(formData: FormData, key: string): string {
  const value = str(formData, key) || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Use a valid date.");
  return value;
}

export function optionalTime(formData: FormData, key: string): string | null {
  const value = str(formData, key);
  if (!value) return null;
  if (!/^\d{2}:\d{2}$/.test(value)) throw new Error("Use a valid time.");
  return value;
}

export function recordedAt(formData: FormData, dateKey = "recordedOn", timeKey = "recordedTime") {
  const date = isoDate(formData, dateKey);
  const time = optionalTime(formData, timeKey) ?? "12:00";
  return new Date(`${date}T${time}:00`);
}

export function optionalNum(
  formData: FormData,
  key: string,
  { min, max }: { min: number; max: number },
): number | null {
  const value = str(formData, key);
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`Values must be between ${min} and ${max}.`);
  }
  return parsed;
}

export function requiredNum(
  formData: FormData,
  key: string,
  bounds: { min: number; max: number },
): number {
  const parsed = optionalNum(formData, key, bounds);
  if (parsed === null) throw new Error("Missing required number.");
  return parsed;
}

export function revalidateHealth() {
  revalidatePath("/health", "layout");
  revalidatePath("/dashboard");
}
