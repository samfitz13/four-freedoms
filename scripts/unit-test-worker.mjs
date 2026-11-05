import { run } from "node:test";
import { tap } from "node:test/reporters";

// The API accepts exact file paths; CLI globs can silently omit [freedom] routes.
const tests = run({
  files: process.argv.slice(2),
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
tests.compose(tap).pipe(process.stdout);
