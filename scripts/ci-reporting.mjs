import path from "node:path";

function cell(value) {
  return String(value).replace(/[|\r\n`<>]/g, " ");
}

export function qualitySummary(report) {
  const complex = report.metrics.filter((metric) => metric.kind === "complexity");
  const large = report.metrics.filter((metric) => metric.kind === "lines");
  const open = report.debts.filter((entry) => entry.status === "open");
  return [
    "## Maintainability",
    "",
    "| Metric | Current |",
    "| --- | ---: |",
    `| Authored source files analyzed | ${report.sourceFiles ?? 0} |`,
    `| Functions above complexity 20 | ${complex.length} |`,
    `| Source files above 500 lines | ${large.length} |`,
    `| Open debt entries | ${open.length} |`,
    `| Gate errors | ${report.errors.length} |`,
    "",
    "Existing hotspots remain debt, not compliance with the default limits.",
    "Download the maintainability-report artifact for owners, plans and measured budgets.",
    "",
  ].join("\n");
}

export function timingReport(events, root, durationMs) {
  return {
    version: 1,
    durationMs,
    tests: events.map(({ status, data }) => ({
      name: data.name,
      file: data.file ? path.relative(root, data.file).split(path.sep).join("/") : null,
      nesting: data.nesting,
      status,
      durationMs: data.details?.duration_ms ?? 0,
    })),
  };
}

export function timingSummary(report) {
  const slowest = [...report.tests].sort((a, b) => b.durationMs - a.durationMs).slice(0, 10);
  return [
    "## Unit test timings",
    "",
    `Elapsed: ${(report.durationMs / 1000).toFixed(2)}s. Recorded ${report.tests.length} test/file results.`,
    "Nested/file timings can overlap; do not sum them as wall-clock time.",
    "",
    "| Test | File | Status | Duration (ms) |",
    "| --- | --- | --- | ---: |",
    ...slowest.map(
      (test) =>
        `| ${cell(test.name)} | ${cell(test.file ?? "runner")} | ${test.status} | ${test.durationMs.toFixed(2)} |`,
    ),
    "",
    "Download test-timings to compare the same tests across workflow runs. No automatic slowdown threshold is applied.",
    "",
  ].join("\n");
}
