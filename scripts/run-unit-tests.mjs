import { spawn } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const suites = {
  paystub: ["lib/freedoms/paystub-math.test.ts"],
  financial: [
    "lib/freedoms/fi-plan.test.ts",
    "lib/freedoms/fi-contributions.test.ts",
    "lib/freedoms/fi-scenarios.test.ts",
    "lib/freedoms/paystub-math.test.ts",
    "lib/freedoms/wealth.test.ts",
    "lib/financial/portfolio/atlas.test.ts",
    "components/freedoms/financial/fi-chart-model.test.ts",
  ],
};
const allowedEnvironment = new Set([
  "PATH",
  "HOME",
  "USERPROFILE",
  "TMPDIR",
  "TEMP",
  "TMP",
  "SYSTEMROOT",
  "WINDIR",
  "COMSPEC",
  "PATHEXT",
  "CI",
  "FORCE_COLOR",
  "NO_COLOR",
  "NODE_V8_COVERAGE",
]);

export function unitTestEnvironment(environment) {
  return {
    ...Object.fromEntries(
      Object.entries(environment).filter(([key]) => allowedEnvironment.has(key.toUpperCase())),
    ),
    NODE_ENV: "test",
    TZ: "UTC",
  };
}

function discover(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return discover(file);
    return entry.isFile() && entry.name.endsWith(".test.ts") ? [file] : [];
  });
}

export function unitTestFiles(selection) {
  const files = selection.length
    ? selection.flatMap((name) => (Object.hasOwn(suites, name) ? suites[name] : [name]))
    : ["app", "components", "lib"].flatMap((directory) => discover(path.join(root, directory)));
  if (!files.length) throw new Error("No unit test files found.");
  return [
    ...new Set(
      files.map((file) => {
        if (file.startsWith("-") || !/\.test\.(?:ts|mjs)$/.test(file))
          throw new Error("Select a suite or existing .test.ts/.test.mjs files, not runner flags.");
        const absolute = path.resolve(root, file);
        if (!statSync(absolute).isFile())
          throw new Error("Unit test selection must contain files.");
        return absolute;
      }),
    ),
  ].sort();
}

function main() {
  let files;
  try {
    files = unitTestFiles(process.argv.slice(2));
  } catch {
    console.error("Select a suite or existing .test.ts/.test.mjs files, not runner flags.");
    process.exitCode = 1;
    return;
  }
  const child = spawn(
    process.execPath,
    [fileURLToPath(new URL("./unit-test-worker.mjs", import.meta.url)), ...files],
    { cwd: root, env: unitTestEnvironment(process.env), stdio: "inherit" },
  );
  const interrupt = () => child.kill("SIGINT");
  const terminate = () => child.kill("SIGTERM");
  const detach = () => {
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", terminate);
  };
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", terminate);
  child.once("error", () => {
    detach();
    console.error("Could not launch isolated unit tests.");
    process.exitCode = 1;
  });
  child.once("exit", (code, signal) => {
    detach();
    if (signal) process.kill(process.pid, signal);
    else process.exitCode = code ?? 1;
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
