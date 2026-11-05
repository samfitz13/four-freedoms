import { execFileSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import eslintConfig from "../eslint.config.mjs";
import { qualitySummary } from "./ci-reporting.mjs";
import {
  checkMetricBudgets,
  checkDebtChanges,
  debtMarkerRule,
  isSourcePath,
  maintainabilityLimits,
  validateDebtRegister,
} from "./maintainability-policy.mjs";

const root = path.resolve(fileURLToPath(new URL("../", import.meta.url)));

export function createMaintainabilityLinter(entries, cwd = root) {
  return new ESLint({
    cwd,
    allowInlineConfig: false,
    overrideConfigFile: true,
    overrideConfig: [
      ...eslintConfig,
      {
        plugins: { maintenance: { rules: { "debt-markers": debtMarkerRule(entries) } } },
        rules: {
          complexity: ["error", { max: maintainabilityLimits().complexity, variant: "classic" }],
          "maintenance/debt-markers": "error",
        },
      },
    ],
  });
}

export function sourceLineMetrics(file, bytes) {
  const metrics = [];
  if (isSourcePath(file)) {
    const text = bytes.toString("utf8");
    const lines = text ? text.replace(/\r?\n$/, "").split(/\r?\n/).length : 0;
    if (lines > maintainabilityLimits().lines)
      metrics.push({ kind: "lines", path: file, value: lines });
  }
  return metrics;
}

export function lintMetrics(results, cwd = root) {
  const errors = [];
  const metrics = [];
  for (const result of results) {
    const file = path.relative(cwd, result.filePath).split(path.sep).join("/");
    for (const message of result.messages) {
      if (message.ruleId === "complexity") {
        const match = /^(.*?) has a complexity of (\d+)\. Maximum allowed is \d+\.$/.exec(
          message.message,
        );
        if (!match) throw new Error("Unrecognized ESLint complexity diagnostic.");
        metrics.push({
          kind: "complexity",
          path: file,
          symbol: match[1],
          value: Number(match[2]),
          line: message.line,
        });
      } else if (message.ruleId === "maintenance/debt-markers") {
        errors.push(`${file}:${message.line}: ${message.message}`);
      } else if (message.fatal || message.ruleId === null) {
        errors.push(`${file}:${message.line ?? 1}: source could not be analyzed.`);
      }
    }
  }
  return { errors, metrics };
}

export function baselineRef(environment) {
  if (environment.GITHUB_BASE_REF) return `origin/${environment.GITHUB_BASE_REF}`;
  if (environment.GITHUB_EVENT_NAME !== "push") return "origin/main";
  const event = JSON.parse(readFileSync(environment.GITHUB_EVENT_PATH, "utf8"));
  if (!/^[a-f0-9]{40}$/.test(event.before ?? "")) throw new Error("Missing pre-push SHA.");
  return /^0{40}$/.test(event.before) ? null : event.before;
}

function baseRegister(cwd) {
  const ref = baselineRef(process.env);
  if (!ref) return null;
  const file = "docs/maintenance/debt.json";
  const listed = execFileSync("git", ["ls-tree", "--name-only", ref, "--", file], {
    cwd,
    encoding: "utf8",
  }).trim();
  if (!listed) return null;
  return JSON.parse(execFileSync("git", ["show", `${ref}:${file}`], { cwd, encoding: "utf8" }));
}

export async function checkMaintainability(cwd = root, readPrevious = baseRegister) {
  const register = JSON.parse(readFileSync(path.join(cwd, "docs/maintenance/debt.json"), "utf8"));
  const errors = validateDebtRegister(register);
  if (errors.length) return { errors, metrics: [], files: 0, sourceFiles: 0, debts: [] };
  const previous = readPrevious(cwd);
  if (previous) {
    const priorErrors = validateDebtRegister(previous);
    if (priorErrors.length) throw new Error("Base debt register is invalid.");
    errors.push(...checkDebtChanges(register, previous));
  }
  const files = [
    ...new Set(
      execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
        cwd,
        encoding: "utf8",
      })
        .split("\0")
        .filter((file) => file && existsSync(path.join(cwd, file))),
    ),
  ].sort();
  const metrics = [];
  const sources = [];
  for (const file of files) {
    const absolute = path.join(cwd, file);
    const stat = lstatSync(absolute);
    if (!stat.isFile()) {
      errors.push(`${file}: non-regular files cannot bypass the size/source checks.`);
      continue;
    }
    // Non-source files need only a stat, never read environment or user data.
    if (!isSourcePath(file)) {
      if (stat.size > maintainabilityLimits().assetBytes)
        errors.push(`${file}: file exceeds the 5 MiB asset limit.`);
      continue;
    }
    if (stat.size > maintainabilityLimits().sourceBytes) {
      errors.push(`${file}: source exceeds the 128 KiB limit.`);
      continue;
    }
    sources.push(file);
    metrics.push(...sourceLineMetrics(file, readFileSync(absolute)));
  }
  for (const entry of register.entries) {
    if (entry.status === "open" && !files.includes(entry.path))
      errors.push(`${entry.id}: referenced source file does not exist.`);
  }
  if (!sources.length) errors.push("No authored source files found; refusing an empty check.");
  if (!sources.length)
    return { errors, metrics, files: files.length, sourceFiles: 0, debts: register.entries };
  const analysis = lintMetrics(
    await createMaintainabilityLinter(register.entries, cwd).lintFiles(sources),
    cwd,
  );
  errors.push(
    ...analysis.errors,
    ...checkMetricBudgets([...metrics, ...analysis.metrics], register.entries),
  );
  return {
    errors,
    metrics: [...metrics, ...analysis.metrics],
    files: files.length,
    sourceFiles: sources.length,
    debts: register.entries,
  };
}

async function main() {
  const report = { limits: maintainabilityLimits(), ...(await checkMaintainability()) };
  const destination = path.join(root, "reports/maintainability/report.json");
  mkdirSync(path.dirname(destination), { recursive: true });
  writeFileSync(destination, JSON.stringify(report, null, 2) + "\n");
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, qualitySummary(report));
  console.log(
    `Checked ${report.files} files; ${report.metrics.length} existing hotspots remain tracked as debt.`,
  );
  if (report.errors.length) {
    console.error(report.errors.join("\n"));
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    console.error("Maintainability analysis failed; check the register, source and Git checkout.");
    process.exitCode = 1;
  });
}
