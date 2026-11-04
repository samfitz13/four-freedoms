"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "@/lib/auth-server";
import { db } from "@/lib/db/client";
import { paystubs } from "@/lib/db/schema";
import { scopeForUser } from "@/lib/db/scope";
import { normalizeStateTaxes } from "@/lib/db/queries/statements";
import { computeNet } from "@/lib/freedoms/paystub-math";
import type { ActionResult } from "./types";

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const numSchema = z.coerce.number().finite().min(0);
const kindSchema = z.enum(["regular", "bonus", "rsu", "correction", "final"]);

const paystubSchema = z.object({
  id: z.string().optional(),
  payDate: isoDateSchema,
  kind: kindSchema.default("regular"),
  employer: z.string().max(80).default(""),
  gross: numSchema.default(0),
  federalIncomeTax: numSchema.default(0),
  socialSecurity: numSchema.default(0),
  medicare: numSchema.default(0),
  additionalMedicare: numSchema.default(0),
  employee401k: numSchema.default(0),
  employeeRoth401k: numSchema.default(0),
  employerMatch: numSchema.default(0),
  hsa: numSchema.default(0),
  otherPretax: numSchema.default(0),
  otherPosttax: numSchema.default(0),
  benefits: numSchema.default(0),
  otherIncome: numSchema.default(0),
  net: numSchema.default(0),
  netOverridden: z.boolean().default(false),
  stateTaxes: z.string().default("[]"),
  notes: z.string().max(500).default(""),
});

function fd(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function decimal(value: number): string {
  return value.toFixed(2);
}

async function getScopedHouseholdId(): Promise<string> {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);
  return scope.primaryHouseholdId;
}

function parseStateTaxes(value: string) {
  try {
    return normalizeStateTaxes(JSON.parse(value || "[]")).filter(
      (entry) =>
        entry.income !== 0 ||
        (entry.disability ?? 0) !== 0 ||
        (entry.fli ?? 0) !== 0 ||
        (entry.local?.length ?? 0) > 0,
    );
  } catch {
    return [];
  }
}

function parsePaystub(formData: FormData) {
  const parsed = paystubSchema.safeParse({
    id: fd(formData, "id") || undefined,
    payDate: fd(formData, "payDate"),
    kind: fd(formData, "kind") || "regular",
    employer: fd(formData, "employer"),
    gross: fd(formData, "gross") || "0",
    federalIncomeTax: fd(formData, "federalIncomeTax") || "0",
    socialSecurity: fd(formData, "socialSecurity") || "0",
    medicare: fd(formData, "medicare") || "0",
    additionalMedicare: fd(formData, "additionalMedicare") || "0",
    employee401k: fd(formData, "employee401k") || "0",
    employeeRoth401k: fd(formData, "employeeRoth401k") || "0",
    employerMatch: fd(formData, "employerMatch") || "0",
    hsa: fd(formData, "hsa") || "0",
    otherPretax: fd(formData, "otherPretax") || "0",
    otherPosttax: fd(formData, "otherPosttax") || "0",
    benefits: fd(formData, "benefits") || "0",
    otherIncome: fd(formData, "otherIncome") || "0",
    net: fd(formData, "net") || "0",
    netOverridden: fd(formData, "netOverridden") === "on",
    stateTaxes: fd(formData, "stateTaxes"),
    notes: fd(formData, "notes"),
  });
  if (!parsed.success) return parsed;
  const stateTaxes = parseStateTaxes(parsed.data.stateTaxes);
  const computedNet = computeNet({ ...parsed.data, stateTaxes });
  return {
    ...parsed,
    data: {
      ...parsed.data,
      stateTaxes,
      net: parsed.data.netOverridden ? parsed.data.net : computedNet,
    },
  };
}

export async function addPaystub(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const householdId = await getScopedHouseholdId();
  const parsed = parsePaystub(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid paystub." };
  }

  const v = parsed.data;
  await db.insert(paystubs).values({
    id: randomUUID(),
    householdId,
    payDate: v.payDate,
    periodStart: null,
    periodEnd: null,
    kind: v.kind,
    employer: v.employer || null,
    gross: decimal(v.gross),
    federalIncomeTax: decimal(v.federalIncomeTax),
    socialSecurity: decimal(v.socialSecurity),
    medicare: decimal(v.medicare),
    additionalMedicare: decimal(v.additionalMedicare),
    employee401k: decimal(v.employee401k),
    employeeRoth401k: decimal(v.employeeRoth401k),
    employerMatch: decimal(v.employerMatch),
    hsa: decimal(v.hsa),
    otherPretax: decimal(v.otherPretax),
    otherPosttax: decimal(v.otherPosttax),
    benefits: decimal(v.benefits),
    otherIncome: decimal(v.otherIncome),
    stateTaxes: v.stateTaxes,
    net: decimal(v.net),
    netOverridden: v.netOverridden,
    notes: v.notes || null,
  });
  revalidatePath("/financial", "layout");
  revalidatePath("/dashboard");
  return { ok: true, message: "Paystub added." };
}

export async function updatePaystub(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const householdId = await getScopedHouseholdId();
  const parsed = parsePaystub(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid paystub." };
  }
  const v = parsed.data;
  if (!v.id) return { ok: false, error: "Paystub not found." };

  await db
    .update(paystubs)
    .set({
      payDate: v.payDate,
      periodStart: null,
      periodEnd: null,
      kind: v.kind,
      employer: v.employer || null,
      gross: decimal(v.gross),
      federalIncomeTax: decimal(v.federalIncomeTax),
      socialSecurity: decimal(v.socialSecurity),
      medicare: decimal(v.medicare),
      additionalMedicare: decimal(v.additionalMedicare),
      employee401k: decimal(v.employee401k),
      employeeRoth401k: decimal(v.employeeRoth401k),
      employerMatch: decimal(v.employerMatch),
      hsa: decimal(v.hsa),
      otherPretax: decimal(v.otherPretax),
      otherPosttax: decimal(v.otherPosttax),
      benefits: decimal(v.benefits),
      otherIncome: decimal(v.otherIncome),
      stateTaxes: v.stateTaxes,
      net: decimal(v.net),
      netOverridden: v.netOverridden,
      notes: v.notes || null,
      updatedAt: new Date(),
    })
    .where(and(eq(paystubs.id, v.id), eq(paystubs.householdId, householdId)));

  revalidatePath("/financial", "layout");
  revalidatePath("/dashboard");
  return { ok: true, message: "Saved." };
}

export async function deletePaystub(formData: FormData): Promise<void> {
  const householdId = await getScopedHouseholdId();
  const id = fd(formData, "id");
  if (!id) return;
  await db.delete(paystubs).where(and(eq(paystubs.id, id), eq(paystubs.householdId, householdId)));
  revalidatePath("/financial", "layout");
  revalidatePath("/dashboard");
}
