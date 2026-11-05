import type { BirthDateResult } from "./types";

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function parseBirthDate(value: unknown, today = new Date()): BirthDateResult {
  if (value === "" || value === null) return { ok: true, birthDate: null };
  if (typeof value !== "string" || !validDate(value))
    return { ok: false, error: "Enter a valid birth date." };
  if (value > today.toISOString().slice(0, 10))
    return { ok: false, error: "Birth date cannot be in the future." };
  return { ok: true, birthDate: value };
}

export function ageInMonths(birthDate: string | null | undefined, date: string): number | null {
  if (!birthDate || !validDate(birthDate) || !validDate(date) || date < birthDate) return null;
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [year, month, day] = date.split("-").map(Number);
  return (year! - by!) * 12 + month! - bm! - (day! < bd! ? 1 : 0);
}

export function formatProjectionDate(
  date: string,
  birthDate?: string | null,
  yearsOnly = false,
): string {
  const months = ageInMonths(birthDate, date);
  if (months !== null) {
    const years = Math.floor(months / 12);
    return yearsOnly || months % 12 === 0 ? `Age ${years}` : `Age ${years}y ${months % 12}m`;
  }
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en", {
    ...(yearsOnly ? {} : { month: "short" as const }),
    year: "numeric",
    timeZone: "UTC",
  });
}
