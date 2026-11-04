import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { parse as parseEnv } from "dotenv";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { financialAccounts, investmentSnapshots, memberships } from "../lib/db/schema";
import { atlasSnapshot, summarizeSnapshot } from "../lib/financial/portfolio/atlas";

async function main() {
  const { values } = parseArgs({
    options: {
      file: { type: "string" },
      household: { type: "string" },
      account: { type: "string" },
      "prepared-on": { type: "string" },
      "cash-as-of": { type: "string" },
      apply: { type: "boolean", default: false },
    },
  });
  const args = z
    .object({
      file: z.string().min(1),
      household: z.string().min(1),
      account: z.string().min(1),
      "prepared-on": z.iso.date(),
      "cash-as-of": z.iso.date(),
      apply: z.boolean(),
    })
    .parse(values);
  const contents = await readFile(args.file, "utf8");
  if (Buffer.byteLength(contents) > 2_000_000) throw new Error("Import: source file exceeds 2 MB.");
  const data = atlasSnapshot(JSON.parse(contents), args["cash-as-of"]);
  const preparedTime = Date.parse(`${data.prepared} UTC`);
  if (
    !Number.isFinite(preparedTime) ||
    new Date(preparedTime).toISOString().slice(0, 10) !== args["prepared-on"]
  ) {
    throw new Error(
      "Import: prepared-on must match the source's preparation date, not an assumed quote date.",
    );
  }
  if (args["cash-as-of"] > args["prepared-on"])
    throw new Error("Import: reconstructed cash cannot postdate preparation.");
  const sourceKey = `atlas-v1:${createHash("sha256")
    .update(JSON.stringify({ preparedOn: args["prepared-on"], data }))
    .digest("hex")}`;

  const environment = parseEnv(await readFile(".env.local", "utf8"));
  for (const [key, value] of Object.entries(environment)) process.env[key] ??= value;
  const target = new URL(process.env.DATABASE_URL ?? "");
  if (!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname))
    throw new Error("Import: this command only writes to local databases.");
  const { db } = await import("../lib/db/client");
  try {
    await db.transaction(async (tx) => {
      const member = await tx
        .select({ userId: memberships.userId })
        .from(memberships)
        .where(and(eq(memberships.householdId, args.household), eq(memberships.role, "owner")))
        .limit(1);
      if (!member.length) throw new Error("Import: household has no owner.");
      const accounts = await tx
        .select()
        .from(financialAccounts)
        .where(
          and(
            eq(financialAccounts.householdId, args.household),
            eq(financialAccounts.id, args.account),
            eq(financialAccounts.isArchived, false),
          ),
        )
        .for("share");
      const account = accounts[0];
      if (!account || account.type !== "brokerage") {
        throw new Error("Import: expected this household's existing active brokerage account.");
      }
      if (accounts.some((a) => a.currency !== "USD"))
        throw new Error("Import: Atlas amounts require USD accounts.");
      const existing = await tx
        .select({ accountId: investmentSnapshots.accountId })
        .from(investmentSnapshots)
        .where(
          and(
            eq(investmentSnapshots.householdId, args.household),
            eq(investmentSnapshots.accountId, args.account),
            eq(investmentSnapshots.sourceKey, sourceKey),
          ),
        );
      console.log(
        JSON.stringify(
          {
            mode: args.apply ? "apply" : "preview",
            existingSnapshots: existing.length,
            account: {
              name: account.name,
              holdings: data.funds.length,
              snapshotTotal: summarizeSnapshot(data).totalCents / 100,
              cashBasis: data.cash.basis,
            },
            statementsChanged: 0,
            accountsCreated: 0,
            moneyMarketChanged: false,
          },
          null,
          2,
        ),
      );
      if (!args.apply) return;
      const inserted = await tx
        .insert(investmentSnapshots)
        .values({
          id: randomUUID(),
          householdId: args.household,
          accountId: account.id,
          preparedOn: args["prepared-on"],
          sourceKey,
          data,
        })
        .onConflictDoNothing({
          target: [investmentSnapshots.accountId, investmentSnapshots.sourceKey],
        })
        .returning({ id: investmentSnapshots.id });
      console.log(
        `Inserted ${inserted.length} immutable snapshots. Existing records were not updated.`,
      );
    });
  } finally {
    await db.$client.end();
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof z.ZodError
      ? error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n")
      : error instanceof Error && error.message.startsWith("Import:")
        ? error.message
        : "Import failed. Check the source, local database, environment, and migrations. No import transaction committed.",
  );
  process.exitCode = 1;
});
