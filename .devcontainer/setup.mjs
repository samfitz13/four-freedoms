import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";

// Never replace an existing environment file or print a generated secret.
try {
  writeFileSync(
    ".env.local",
    [
      `BETTER_AUTH_SECRET=${randomBytes(48).toString("base64")}`,
      "NEXT_PUBLIC_SITE_URL=http://localhost:3000",
      "BETTER_AUTH_URL=http://localhost:3000",
      "",
    ].join("\n"),
    { flag: "wx", mode: 0o600 },
  );
  console.log("Created development auth configuration.");
} catch (error) {
  if (error.code !== "EEXIST") throw error;
  console.log(
    "Preserved existing .env.local; container environment forces local database and disables providers.",
  );
}
