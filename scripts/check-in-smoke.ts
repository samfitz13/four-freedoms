/**
 * Dev-only: exercise the exact validation + upsert codepath used by the
 * /check-in server action, without going through Next's action protocol.
 *   pnpm tsx --env-file=.env.local scripts/check-in-smoke.ts <userId>
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../lib/db/client";
import { entries, memberships } from "../lib/db/schema";
import { FREEDOMS } from "../lib/freedoms/constants";
import { freedomModules } from "../lib/freedoms";

async function main() {
  const userId = process.argv[2];
  if (!userId) {
    console.error("usage: tsx scripts/check-in-smoke.ts <userId>");
    process.exit(1);
  }
  const [m] = await db
    .select({ householdId: memberships.householdId })
    .from(memberships)
    .where(eq(memberships.userId, userId))
    .limit(1);
  if (!m) throw new Error("no household");
  const householdId = m.householdId;

  const today = new Date().toISOString().slice(0, 10);

  // Emulate what the check-in form POSTs.
  const form: Record<string, string> = {
    "financial.savingsRate": "42",
    "financial.runwayMonths": "15",
    "location.place": "Lisbon, PT",
    "location.satisfaction": "9",
    "location.preferred": "on",
    "time.deepWorkHours": "3.5",
    "time.prioritySplit": "65",
    "health.sleepHours": "7.5",
    "health.trained": "on",
    "health.energy": "8",
  };

  // Translate per-field into typed payloads — identical rules to actions.ts.
  for (const meta of FREEDOMS) {
    const mod = freedomModules[meta.key];
    const raw: Record<string, unknown> = {};
    for (const field of mod.fields) {
      const key = `${meta.key}.${field.name}`;
      if (!(key in form)) continue;
      const s = form[key]!.trim();
      if (s === "" && field.kind !== "boolean") continue;
      switch (field.kind) {
        case "number":
          raw[field.name] = Number(s);
          break;
        case "percent":
          raw[field.name] = Number(s) / 100;
          break;
        case "int":
          raw[field.name] = Math.round(Number(s));
          break;
        case "boolean":
          raw[field.name] = s === "on" || s === "true";
          break;
        case "text":
          if (s) raw[field.name] = s;
          break;
      }
    }
    if (!Object.keys(raw).length) continue;
    const parsed = mod.payloadSchema.safeParse(raw);
    if (!parsed.success) {
      console.error(`${meta.key} invalid:`, parsed.error.issues[0]);
      process.exit(2);
    }
    await db
      .insert(entries)
      .values({
        id: randomUUID(),
        householdId,
        authorId: userId,
        freedom: meta.key,
        occurredOn: today,
        payload: parsed.data as Record<string, unknown>,
        source: "manual",
      })
      .onConflictDoUpdate({
        target: [entries.householdId, entries.freedom, entries.occurredOn],
        set: {
          payload: parsed.data as Record<string, unknown>,
          authorId: userId,
          source: "manual",
          updatedAt: new Date(),
        },
      });
    console.log(`ok ${meta.key}:`, JSON.stringify(parsed.data));
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
