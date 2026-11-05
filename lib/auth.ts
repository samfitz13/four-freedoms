/**
 * better-auth server configuration.
 *
 *   - Magic-link email sign-in (no passwords).
 *   - Database-backed sessions (opaque cookie, revokable).
 *   - Drizzle adapter against our Postgres schema.
 *   - On user create, auto-provision a personal household + owner membership.
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { db, schema } from "@/lib/db/client";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { logAuthError } from "@/lib/logger";
import { randomUUID } from "node:crypto";

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL ?? env.NEXT_PUBLIC_SITE_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.NEXT_PUBLIC_SITE_URL],
  logger: { log: logAuthError },

  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),

  // We don't use email+password; magic link is the only flow today.
  emailAndPassword: { enabled: false },

  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await sendEmail({
          to: email,
          subject: "Your freedom-four sign-in link",
          html: `
            <h2 style="font-family: Georgia, serif;">Sign in to freedom-four</h2>
            <p>Click the link below to sign in. The link works once and expires in 15 minutes.</p>
            <p><a href="${url}">Sign in</a></p>
            <p style="color:#888; font-size:12px;">If you didn't request this, you can ignore this email.</p>
          `,
          text: `Sign in to freedom-four: ${url}`,
        });
      },
      expiresIn: 60 * 15, // 15 minutes
    }),
  ],

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // touch cookie if >1d old
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },

  // Atomic bootstrap: every new user gets their own household + owner membership.
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const householdId = randomUUID();
          await db.insert(schema.households).values({
            id: householdId,
            name: "Personal",
            createdBy: user.id,
          });
          await db.insert(schema.memberships).values({
            householdId,
            userId: user.id,
            role: "owner",
          });
        },
      },
    },
  },
});
