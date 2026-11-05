import assert from "node:assert/strict";
import { test } from "node:test";
import { qualitySummary, timingReport, timingSummary } from "./ci-reporting.mjs";

test("quality summary counts measured hotspots, open debt and failures separately", () => {
  const summary = qualitySummary({
    sourceFiles: 42,
    metrics: [{ kind: "complexity" }, { kind: "lines" }, { kind: "complexity" }],
    debts: [{ status: "open" }, { status: "closed" }],
    errors: ["synthetic failure"],
  });
  assert.match(summary, /Functions above complexity 20 \| 2/);
  assert.match(summary, /Source files above 500 lines \| 1/);
  assert.match(summary, /Open debt entries \| 1/);
  assert.match(summary, /Gate errors \| 1/);
  assert.match(summary, /not compliance/);
});

test("timings retain durations and outcomes but exclude assertion secrets and output", () => {
  const report = timingReport(
    [
      {
        status: "fail",
        data: {
          name: "synthetic | failure\n<details>",
          file: "/fixture/lib/probe.test.ts",
          nesting: 0,
          details: { duration_ms: 12.5, error: "private-assertion-value" },
          output: "private-console-value",
        },
      },
    ],
    "/fixture",
    40,
  );
  assert.equal(report.tests[0].file, "lib/probe.test.ts");
  assert.equal(report.tests[0].durationMs, 12.5);
  assert.equal(report.tests[0].status, "fail");
  assert.ok(!JSON.stringify(report).includes("private-"));
  const summary = timingSummary(report);
  assert.ok(!summary.includes("<details>"));
  assert.ok(!summary.includes("synthetic | failure"));
  assert.match(summary, /12.50/);
});

test("timing summary sorts slow tests and limits display without dropping artifact data", () => {
  const report = {
    durationMs: 2000,
    tests: Array.from({ length: 12 }, (_, index) => ({
      name: `test-${index}`,
      file: "lib/probe.test.ts",
      durationMs: index,
      status: "pass",
    })),
  };
  const summary = timingSummary(report);
  assert.ok(summary.indexOf("test-11") < summary.indexOf("test-10"));
  assert.ok(!summary.includes("| test-0 |"));
  assert.equal(report.tests.length, 12);
  assert.match(summary, /2.00s/);
  assert.match(summary, /do not sum/);
});
