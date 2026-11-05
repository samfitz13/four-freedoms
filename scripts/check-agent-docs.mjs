import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function validateAgentDocs(root) {
  const guide = readFileSync(path.join(root, "AGENTS.md"), "utf8");
  const manifest = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  const template = readFileSync(path.join(root, ".env.example"), "utf8");
  const nodeVersion = readFileSync(path.join(root, ".nvmrc"), "utf8").trim();
  const errors = [];
  const commands = [...guide.matchAll(/^\|\s*`pnpm ([\w:-]+)`\s*\|/gm)];
  if (!commands.length) errors.push("AGENTS.md must document its pnpm commands in a table.");
  for (const [, command] of commands) {
    if (!Object.hasOwn(manifest.scripts, command)) {
      errors.push(`AGENTS.md documents missing package script: ${command}`);
    }
  }
  for (const required of ["build", "lint", "typecheck", "check:docs"]) {
    if (!commands.some((match) => match[1] === required)) {
      errors.push(`AGENTS.md must document pnpm ${required}.`);
    }
  }
  const nodeMajor = nodeVersion.replace(/^v/, "").split(".")[0];
  if (!new RegExp(`\\| Node\\s*\\|\\s*${nodeMajor}(?:\\s|\\.)`).test(guide)) {
    errors.push("AGENTS.md Node version must match .nvmrc.");
  }
  const pnpmMajor = manifest.packageManager?.match(/^pnpm@(\d+)\./)?.[1];
  if (!pnpmMajor || !guide.includes(`**pnpm ${pnpmMajor}**`)) {
    errors.push("AGENTS.md pnpm version must match packageManager.");
  }
  const environmentNames = new Set(
    [...template.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]),
  );
  for (const [, name] of guide.matchAll(/^\|\s*`([A-Z][A-Z0-9_]*)`\s*\|/gm)) {
    if (!environmentNames.has(name))
      errors.push(`Documented environment variable missing from template: ${name}`);
  }
  for (const [, target] of guide.matchAll(/\[[^\]]+\]\(([^)\s]+)\)/g)) {
    if (/^(?:https?:|mailto:|#)/.test(target)) continue;
    const file = target.split("#")[0];
    const absolute = path.resolve(root, file);
    if (!absolute.startsWith(root + path.sep) || !existsSync(absolute)) {
      errors.push(`Broken or out-of-repository AGENTS.md link: ${target}`);
    }
  }
  return errors;
}

const root = fileURLToPath(new URL("../", import.meta.url)).replace(/\/$/, "");
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = validateAgentDocs(root);
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log(
      "AGENTS.md commands, toolchain versions, environment names and local links are consistent.",
    );
  }
}
