import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";

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
  const secret = parseEnv(readFileSync(".env.local", "utf8")).BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) {
    console.error(
      "Existing .env.local needs a BETTER_AUTH_SECRET of at least 32 characters. Set a local development secret, then rerun container setup. The file was not changed.",
    );
    process.exitCode = 1;
  } else {
    console.log(
      "Preserved existing .env.local; container environment forces local database and disables providers.",
    );
  }
}
