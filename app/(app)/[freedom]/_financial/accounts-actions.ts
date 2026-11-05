"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import {
  financialAccounts,
  isoOptionAccountDetails,
  isoOptionGrants,
  isoOptionValuations,
  isoOptionExercises,
} from "@/lib/db/schema";
import { requireUser } from "@/lib/auth-server";
import { scopeForUser } from "@/lib/db/scope";
import { DEFAULT_BASE_CURRENCY, SUPPORTED_CURRENCIES } from "@/lib/freedoms/currency";
import { isValidSubtype } from "@/lib/freedoms/account-subtypes";

const ACCOUNT_TYPES = [
  "checking",
  "savings",
  "brokerage",
  "retirement",
  "crypto",
  "real_estate",
  "loan",
  "credit_card",
  "equity_comp",
  "iso_options",
  "other",
] as const;
const accountTypeSchema = z.enum(ACCOUNT_TYPES);

const currencySchema = z.enum(SUPPORTED_CURRENCIES);
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const optionalIsoDateSchema = z
  .union([isoDateSchema, z.literal("")])
  .transform((value) => value || null);
const moneySchema = z.coerce.number().finite().min(0);
const optionalMoneySchema = z.preprocess(
  (value) => (value === "" ? null : value),
  z.coerce.number().finite().min(0).nullable(),
);
const shareSchema = z.coerce.number().int().positive();
const vestingTypeSchema = z.enum(["monthly", "quarterly", "annual"]);
const vestingDurationSchema = z.coerce.number().int().positive().max(600);
const vestingCliffSchema = z.coerce.number().int().min(0).max(600);

import type { ActionResult } from "./types";

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export async function createAccount(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);

  const parsed = z
    .object({
      name: z.string().min(1).max(80),
      type: accountTypeSchema,
      subtype: z.string().max(40).optional(),
      currency: currencySchema,
      institution: z.string().max(80).optional(),
    })
    .safeParse({
      name: str(formData, "name"),
      type: str(formData, "type"),
      subtype: str(formData, "subtype") || undefined,
      currency: str(formData, "currency") || DEFAULT_BASE_CURRENCY,
      institution: str(formData, "institution") || undefined,
    });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  if (!isValidSubtype(parsed.data.type, parsed.data.subtype)) {
    return { ok: false, error: "Subtype is not valid for this account type." };
  }

  await db.insert(financialAccounts).values({
    id: randomUUID(),
    householdId: scope.primaryHouseholdId,
    name: parsed.data.name,
    type: parsed.data.type,
    subtype: parsed.data.subtype ?? null,
    currency: parsed.data.currency,
    institution: parsed.data.institution ?? null,
    isManual: true,
    isArchived: false,
  });

  revalidatePath("/financial", "layout");
  return { ok: true, message: "Account added." };
}

export async function updateAccount(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);

  const parsed = z
    .object({
      id: z.string().min(1),
      name: z.string().min(1).max(80),
      type: accountTypeSchema,
      subtype: z.string().max(40).optional(),
      currency: currencySchema,
      institution: z.string().max(80).optional(),
    })
    .safeParse({
      id: str(formData, "id"),
      name: str(formData, "name"),
      type: str(formData, "type"),
      subtype: str(formData, "subtype") || undefined,
      currency: str(formData, "currency"),
      institution: str(formData, "institution") || undefined,
    });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  if (!isValidSubtype(parsed.data.type, parsed.data.subtype)) {
    return { ok: false, error: "Subtype is not valid for this account type." };
  }

  const result = await db
    .update(financialAccounts)
    .set({
      name: parsed.data.name,
      type: parsed.data.type,
      subtype: parsed.data.subtype ?? null,
      currency: parsed.data.currency,
      institution: parsed.data.institution ?? null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(financialAccounts.id, parsed.data.id),
        eq(financialAccounts.householdId, scope.primaryHouseholdId),
        eq(financialAccounts.isArchived, false),
      ),
    )
    .returning({ id: financialAccounts.id });

  if (result.length === 0) {
    return { ok: false, error: "Account not found." };
  }

  revalidatePath("/financial", "layout");
  return { ok: true, message: "Saved." };
}

export async function archiveAccount(formData: FormData): Promise<void> {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);
  const id = str(formData, "id");
  if (!id) return;

  await db
    .update(financialAccounts)
    .set({ isArchived: true, updatedAt: new Date() })
    .where(
      and(
        eq(financialAccounts.id, id),
        eq(financialAccounts.householdId, scope.primaryHouseholdId),
      ),
    );

  revalidatePath("/financial", "layout");
}

async function assertIsoOptionAccount(accountId: string, householdId: string): Promise<boolean> {
  const [account] = await db
    .select({ id: financialAccounts.id })
    .from(financialAccounts)
    .where(
      and(
        eq(financialAccounts.id, accountId),
        eq(financialAccounts.householdId, householdId),
        eq(financialAccounts.isArchived, false),
        or(
          eq(financialAccounts.type, "iso_options"),
          and(eq(financialAccounts.type, "equity_comp"), eq(financialAccounts.subtype, "iso")),
        ),
      ),
    )
    .limit(1);
  return Boolean(account);
}

async function isoAccountEmployerDefaults(accountId: string, householdId: string) {
  const [account] = await db
    .select({
      id: financialAccounts.id,
      name: financialAccounts.name,
      detailEmployerName: isoOptionAccountDetails.employerName,
      detailEmployerRelationship: isoOptionAccountDetails.employerRelationship,
      detailEmploymentEndDate: isoOptionAccountDetails.employmentEndDate,
      detailPostTerminationExerciseDays: isoOptionAccountDetails.postTerminationExerciseDays,
    })
    .from(financialAccounts)
    .leftJoin(isoOptionAccountDetails, eq(isoOptionAccountDetails.accountId, financialAccounts.id))
    .where(
      and(
        eq(financialAccounts.id, accountId),
        eq(financialAccounts.householdId, householdId),
        eq(financialAccounts.isArchived, false),
        or(
          eq(financialAccounts.type, "iso_options"),
          and(eq(financialAccounts.type, "equity_comp"), eq(financialAccounts.subtype, "iso")),
        ),
      ),
    )
    .limit(1);
  if (!account) return null;

  const [legacyGrant] = await db
    .select({
      employerName: isoOptionGrants.employerName,
      employerRelationship: isoOptionGrants.employerRelationship,
      employmentEndDate: isoOptionGrants.employmentEndDate,
      postTerminationExerciseDays: isoOptionGrants.postTerminationExerciseDays,
    })
    .from(isoOptionGrants)
    .where(
      and(eq(isoOptionGrants.accountId, accountId), eq(isoOptionGrants.householdId, householdId)),
    )
    .limit(1);

  return {
    employerName: account.detailEmployerName ?? legacyGrant?.employerName ?? account.name,
    employerRelationship:
      account.detailEmployerRelationship ?? legacyGrant?.employerRelationship ?? "current",
    employmentEndDate: account.detailEmploymentEndDate ?? legacyGrant?.employmentEndDate ?? null,
    postTerminationExerciseDays:
      account.detailPostTerminationExerciseDays ?? legacyGrant?.postTerminationExerciseDays ?? 90,
  };
}

export async function updateIsoOptionAccountDetails(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);
  const parsed = z
    .object({
      accountId: z.string().min(1),
      employerName: z.string().min(1).max(80),
      employerRelationship: z.enum(["current", "former"]),
      employmentEndDate: optionalIsoDateSchema,
      postTerminationExerciseDays: z.coerce.number().int().positive().max(3650),
    })
    .safeParse({
      accountId: str(formData, "accountId"),
      employerName: str(formData, "employerName"),
      employerRelationship: str(formData, "employerRelationship") || "current",
      employmentEndDate: str(formData, "employmentEndDate"),
      postTerminationExerciseDays: str(formData, "postTerminationExerciseDays") || "90",
    });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid ISO account details." };
  }
  if (!(await assertIsoOptionAccount(parsed.data.accountId, scope.primaryHouseholdId))) {
    return { ok: false, error: "ISO account not found." };
  }

  await db
    .insert(isoOptionAccountDetails)
    .values({
      id: randomUUID(),
      householdId: scope.primaryHouseholdId,
      accountId: parsed.data.accountId,
      employerName: parsed.data.employerName,
      employerRelationship: parsed.data.employerRelationship,
      employmentEndDate: parsed.data.employmentEndDate,
      postTerminationExerciseDays: parsed.data.postTerminationExerciseDays,
    })
    .onConflictDoUpdate({
      target: isoOptionAccountDetails.accountId,
      set: {
        employerName: parsed.data.employerName,
        employerRelationship: parsed.data.employerRelationship,
        employmentEndDate: parsed.data.employmentEndDate,
        postTerminationExerciseDays: parsed.data.postTerminationExerciseDays,
        updatedAt: new Date(),
      },
    });

  revalidatePath("/financial", "layout");
  return { ok: true, message: "ISO account details saved." };
}

export async function addIsoOptionGrant(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);
  const parsed = z
    .object({
      accountId: z.string().min(1),
      label: z.string().min(1).max(80),
      grantDate: optionalIsoDateSchema,
      vestingStartDate: optionalIsoDateSchema,
      vestingType: vestingTypeSchema,
      vestingDurationMonths: vestingDurationSchema,
      vestingCliffMonths: vestingCliffSchema,
      earlyExerciseAllowed: z.boolean(),
      expirationDate: optionalIsoDateSchema,
      totalShares: shareSchema,
      strikePrice: moneySchema,
    })
    .safeParse({
      accountId: str(formData, "accountId"),
      label: str(formData, "label"),
      grantDate: str(formData, "grantDate"),
      vestingStartDate: str(formData, "vestingStartDate"),
      vestingType: str(formData, "vestingType") || "monthly",
      vestingDurationMonths: str(formData, "vestingDurationMonths") || "48",
      vestingCliffMonths: str(formData, "vestingCliffMonths") || "12",
      earlyExerciseAllowed: formData.get("earlyExerciseAllowed") === "on",
      expirationDate: str(formData, "expirationDate"),
      totalShares: str(formData, "totalShares"),
      strikePrice: str(formData, "strikePrice"),
    });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid ISO grant." };
  }
  const employerDefaults = await isoAccountEmployerDefaults(
    parsed.data.accountId,
    scope.primaryHouseholdId,
  );
  if (!employerDefaults) {
    return { ok: false, error: "ISO account not found." };
  }

  await db.insert(isoOptionGrants).values({
    id: randomUUID(),
    householdId: scope.primaryHouseholdId,
    accountId: parsed.data.accountId,
    employerName: employerDefaults.employerName,
    employerRelationship: employerDefaults.employerRelationship,
    employmentEndDate: employerDefaults.employmentEndDate,
    postTerminationExerciseDays: employerDefaults.postTerminationExerciseDays,
    label: parsed.data.label,
    grantDate: parsed.data.grantDate,
    vestingStartDate: parsed.data.vestingStartDate,
    vestingSchedule: {
      type: parsed.data.vestingType,
      durationMonths: parsed.data.vestingDurationMonths,
      cliffMonths: parsed.data.vestingCliffMonths,
    },
    earlyExerciseAllowed: parsed.data.earlyExerciseAllowed,
    expirationDate: parsed.data.expirationDate,
    totalShares: parsed.data.totalShares,
    strikePrice: parsed.data.strikePrice.toFixed(6),
  });

  revalidatePath("/financial", "layout");
  return { ok: true, message: "ISO grant added." };
}

export async function updateIsoOptionGrant(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);
  const parsed = z
    .object({
      id: z.string().min(1),
      label: z.string().min(1).max(80),
      grantDate: optionalIsoDateSchema,
      vestingStartDate: optionalIsoDateSchema,
      vestingType: vestingTypeSchema,
      vestingDurationMonths: vestingDurationSchema,
      vestingCliffMonths: vestingCliffSchema,
      earlyExerciseAllowed: z.boolean(),
      expirationDate: optionalIsoDateSchema,
      totalShares: shareSchema,
      strikePrice: moneySchema,
    })
    .safeParse({
      id: str(formData, "id"),
      label: str(formData, "label"),
      grantDate: str(formData, "grantDate"),
      vestingStartDate: str(formData, "vestingStartDate"),
      vestingType: str(formData, "vestingType") || "monthly",
      vestingDurationMonths: str(formData, "vestingDurationMonths") || "48",
      vestingCliffMonths: str(formData, "vestingCliffMonths") || "12",
      earlyExerciseAllowed: formData.get("earlyExerciseAllowed") === "on",
      expirationDate: str(formData, "expirationDate"),
      totalShares: str(formData, "totalShares"),
      strikePrice: str(formData, "strikePrice"),
    });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid ISO grant." };
  }

  const result = await db
    .update(isoOptionGrants)
    .set({
      label: parsed.data.label,
      grantDate: parsed.data.grantDate,
      vestingStartDate: parsed.data.vestingStartDate,
      vestingSchedule: {
        type: parsed.data.vestingType,
        durationMonths: parsed.data.vestingDurationMonths,
        cliffMonths: parsed.data.vestingCliffMonths,
      },
      earlyExerciseAllowed: parsed.data.earlyExerciseAllowed,
      expirationDate: parsed.data.expirationDate,
      totalShares: parsed.data.totalShares,
      strikePrice: parsed.data.strikePrice.toFixed(6),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(isoOptionGrants.id, parsed.data.id),
        eq(isoOptionGrants.householdId, scope.primaryHouseholdId),
      ),
    )
    .returning({ id: isoOptionGrants.id });
  if (result.length === 0) return { ok: false, error: "ISO grant not found." };

  revalidatePath("/financial", "layout");
  return { ok: true, message: "Grant saved." };
}

export async function deleteIsoOptionGrant(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);
  const id = str(formData, "id");
  if (!id) return { ok: false, error: "ISO grant not found." };

  const result = await db
    .delete(isoOptionGrants)
    .where(
      and(eq(isoOptionGrants.id, id), eq(isoOptionGrants.householdId, scope.primaryHouseholdId)),
    )
    .returning({ id: isoOptionGrants.id });
  if (result.length === 0) return { ok: false, error: "ISO grant not found." };

  revalidatePath("/financial", "layout");
  return { ok: true, message: "Grant deleted." };
}

export async function addIsoOptionValuation(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);
  const parsed = z
    .object({
      accountId: z.string().min(1),
      asOf: isoDateSchema,
      fmv: moneySchema,
      sharePrice: optionalMoneySchema,
      notes: z.string().max(200).optional(),
    })
    .safeParse({
      accountId: str(formData, "accountId"),
      asOf: str(formData, "asOf"),
      fmv: str(formData, "fmv"),
      sharePrice: str(formData, "sharePrice"),
      notes: str(formData, "notes") || undefined,
    });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid valuation." };
  }
  if (!(await assertIsoOptionAccount(parsed.data.accountId, scope.primaryHouseholdId))) {
    return { ok: false, error: "ISO account not found." };
  }

  await db.insert(isoOptionValuations).values({
    id: randomUUID(),
    householdId: scope.primaryHouseholdId,
    accountId: parsed.data.accountId,
    asOf: parsed.data.asOf,
    fmv: parsed.data.fmv.toFixed(6),
    sharePrice: parsed.data.sharePrice === null ? null : Number(parsed.data.sharePrice).toFixed(6),
    notes: parsed.data.notes ?? null,
  });

  revalidatePath("/financial", "layout");
  return { ok: true, message: "Valuation added." };
}

export async function addIsoOptionExercise(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);
  const parsed = z
    .object({
      grantId: z.string().min(1),
      exerciseDate: isoDateSchema,
      shares: shareSchema,
      exercisePrice: optionalMoneySchema,
      fmvAtExercise: optionalMoneySchema,
      notes: z.string().max(200).optional(),
    })
    .safeParse({
      grantId: str(formData, "grantId"),
      exerciseDate: str(formData, "exerciseDate"),
      shares: str(formData, "shares"),
      exercisePrice: str(formData, "exercisePrice"),
      fmvAtExercise: str(formData, "fmvAtExercise"),
      notes: str(formData, "notes") || undefined,
    });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid exercise." };
  }

  const [grant] = await db
    .select({ id: isoOptionGrants.id, accountId: isoOptionGrants.accountId })
    .from(isoOptionGrants)
    .where(
      and(
        eq(isoOptionGrants.id, parsed.data.grantId),
        eq(isoOptionGrants.householdId, scope.primaryHouseholdId),
      ),
    )
    .limit(1);
  if (!grant) return { ok: false, error: "ISO grant not found." };
  if (!(await assertIsoOptionAccount(grant.accountId, scope.primaryHouseholdId)))
    return { ok: false, error: "ISO account not found or archived." };

  await db.insert(isoOptionExercises).values({
    id: randomUUID(),
    householdId: scope.primaryHouseholdId,
    grantId: parsed.data.grantId,
    exerciseDate: parsed.data.exerciseDate,
    shares: parsed.data.shares,
    exercisePrice:
      parsed.data.exercisePrice === null ? null : Number(parsed.data.exercisePrice).toFixed(6),
    fmvAtExercise:
      parsed.data.fmvAtExercise === null ? null : Number(parsed.data.fmvAtExercise).toFixed(6),
    notes: parsed.data.notes ?? null,
  });

  revalidatePath("/financial", "layout");
  return { ok: true, message: "Exercise added." };
}
