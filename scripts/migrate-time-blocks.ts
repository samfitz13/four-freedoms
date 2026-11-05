import "dotenv/config";
import { db } from "@/lib/db/client";
import { households } from "@/lib/db/schema";
import { ensureTimeSeeded } from "@/lib/freedoms/time-seed";

async function main() {
  const rows = await db.select({ id: households.id }).from(households);
  for (const household of rows) {
    await ensureTimeSeeded(household.id);
  }
  console.log(`Migrated time_blocks for ${rows.length} household(s).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Migration failed.");
  process.exitCode = 1;
});
