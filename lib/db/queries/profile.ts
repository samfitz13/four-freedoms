import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

export async function getUserBirthDate(userId: string): Promise<string | null> {
  const [profile] = await db
    .select({ birthDate: users.birthDate })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return profile?.birthDate ?? null;
}
