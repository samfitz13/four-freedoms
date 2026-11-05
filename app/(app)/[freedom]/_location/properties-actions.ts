"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { financialAccounts, places, properties } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth-server";
import { getPrimaryHouseholdId } from "@/lib/db/scope";

function str(fd: FormData, key: string, max = 200): string {
  const value = fd.get(key);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

const PROPERTY_USES = ["owner_occupied", "second_home", "rental", "investment", "other"] as const;
type PropertyUse = (typeof PROPERTY_USES)[number];

export async function createProperty(formData: FormData) {
  const user = await requireUser();
  const householdId = await getPrimaryHouseholdId(user.id);
  const placeId = str(formData, "placeId", 80);
  const use = str(formData, "use", 40);
  const acquiredOn = str(formData, "acquiredOn", 10) || new Date().toISOString().slice(0, 10);
  if (!placeId || !isPropertyUse(use)) throw new Error("Place and use are required.");
  await assertPlace(householdId, placeId);

  await db.transaction(async (tx) => {
    let accountId = str(formData, "accountId", 80);
    if (accountId) {
      const [account] = await tx
        .select({ id: financialAccounts.id })
        .from(financialAccounts)
        .where(
          and(
            eq(financialAccounts.id, accountId),
            eq(financialAccounts.householdId, householdId),
            eq(financialAccounts.type, "real_estate"),
          ),
        )
        .limit(1);
      if (!account) {
        throw new Error("Property account must be a real-estate account in this household.");
      }
    } else {
      const accountName = str(formData, "accountName", 80);
      if (!accountName) throw new Error("Choose an account or enter a new account name.");
      accountId = randomUUID();
      await tx.insert(financialAccounts).values({
        id: accountId,
        householdId,
        name: accountName,
        type: "real_estate",
        currency: str(formData, "currency", 3) || "USD",
        isManual: true,
        isArchived: false,
      });
    }

    await tx.insert(properties).values({
      id: randomUUID(),
      householdId,
      placeId,
      accountId,
      use,
      ownershipPct: (Number(str(formData, "ownershipPct")) || 100).toFixed(2),
      acquiredOn,
      notes: str(formData, "notes", 500) || null,
    });
  });

  revalidateLocation();
}

export async function updateProperty(formData: FormData) {
  const user = await requireUser();
  const householdId = await getPrimaryHouseholdId(user.id);
  const id = str(formData, "id", 80);
  const use = str(formData, "use", 40);
  if (!id || !isPropertyUse(use)) throw new Error("Property and use are required.");

  await db
    .update(properties)
    .set({
      use,
      ownershipPct: (Number(str(formData, "ownershipPct")) || 100).toFixed(2),
      disposedOn: str(formData, "disposedOn", 10) || null,
      notes: str(formData, "notes", 500) || null,
    })
    .where(and(eq(properties.id, id), eq(properties.householdId, householdId)));

  revalidateLocation();
}

export async function disposeProperty(formData: FormData) {
  const user = await requireUser();
  const householdId = await getPrimaryHouseholdId(user.id);
  const id = str(formData, "id", 80);
  if (!id) return;
  await db
    .update(properties)
    .set({ disposedOn: new Date().toISOString().slice(0, 10) })
    .where(and(eq(properties.id, id), eq(properties.householdId, householdId)));
  revalidateLocation();
}

async function assertPlace(householdId: string, placeId: string) {
  const [place] = await db
    .select({ id: places.id })
    .from(places)
    .where(and(eq(places.id, placeId), eq(places.householdId, householdId)))
    .limit(1);
  if (!place) throw new Error("Place not found.");
}

function isPropertyUse(value: string): value is PropertyUse {
  return PROPERTY_USES.includes(value as PropertyUse);
}

function revalidateLocation() {
  revalidatePath("/location", "layout");
  revalidatePath("/financial", "layout");
  revalidatePath("/dashboard");
}
