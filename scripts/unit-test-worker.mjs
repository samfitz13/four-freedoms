import { run } from "node:test";
import { tap } from "node:test/reporters";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { timingReport, timingSummary } from "./ci-reporting.mjs";

const args = process.argv.slice(2);
const timings = args[0] === "--timings";
if (timings) args.shift();
const started = performance.now();
const events = [];

// The API accepts exact file paths; CLI globs can silently omit [freedom] routes.
const tests = run({
  files: args,
  isolation: "process",
  concurrency: 2,
  timeout: 30000,
  execArgv: ["--import", "tsx"],
});
tests.on("test:fail", () => {
  process.exitCode = 1;
});
tests.on("error", () => {
  console.error("The isolated unit test runner failed.");
  process.exitCode = 1;
});
if (timings) {
  for (const status of ["pass", "fail"]) {
    tests.on(`test:${status}`, (data) => events.push({ status, data }));
  }
  tests.once("end", () => {
    try {
      const root = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
      const report = timingReport(events, root, performance.now() - started);
      const directory = path.join(root, "reports/tests");
      mkdirSync(directory, { recursive: true });
      writeFileSync(path.join(directory, "timings.json"), JSON.stringify(report, null, 2) + "\n");
      if (process.env.GITHUB_STEP_SUMMARY)
        appendFileSync(process.env.GITHUB_STEP_SUMMARY, timingSummary(report));
    } catch {
      console.error("Could not write unit test timing report.");
      process.exitCode = 1;
    }
  });
}
tests.compose(tap).pipe(process.stdout);
