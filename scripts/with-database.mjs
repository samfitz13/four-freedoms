import { execFileSync, spawn } from "node:child_process";
import { config } from "dotenv";

const explicitDatabaseUrl = process.env.DATABASE_URL;
config({ path: [".env.local", ".env"], quiet: true });

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error("Usage: node scripts/with-database.mjs <command> [...args]");
  process.exit(1);
}

const keychainService = process.env.DATABASE_URL_KEYCHAIN_SERVICE;
if (!explicitDatabaseUrl && keychainService) {
  if (process.platform !== "darwin") {
    console.error("Keychain loading requires macOS. Set DATABASE_URL on other platforms.");
    process.exit(1);
  }
  try {
    process.env.DATABASE_URL = execFileSync(
      "/usr/bin/security",
      ["find-generic-password", "-s", keychainService, "-w"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    ).trimEnd();
  } catch {
    console.error("Database credential unavailable. Check the configured macOS Keychain item.");
    process.exit(1);
  }
}

// Schema pushes are for local iteration, never a hosted database.
if (command === "drizzle-kit" && args[0] === "push") {
  try {
    const url = new URL(process.env.DATABASE_URL ?? "");
    if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
      throw new Error("Remote database");
    }
  } catch {
    console.error("db:push requires a local DATABASE_URL. Use db:migrate for hosted databases.");
    process.exit(1);
  }
}

const child = spawn(command, args, { stdio: "inherit", env: process.env });
child.on("error", () => {
  console.error("Could not launch the requested command.");
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
