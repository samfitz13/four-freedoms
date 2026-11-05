import assert from "node:assert/strict";
import { test } from "node:test";
import { parse } from "csv-parse/sync";

test("CSV parser upgrade preserves header callbacks, quoted fields, BOM and empty rows", () => {
  const records = parse('\uFEFFDate,Description,Amount\n2026-01-02,"Fixture, quoted",12.34\n\n', {
    columns: (headers: string[]) => headers.map((header) => header.toLowerCase()),
    bom: true,
    skip_empty_lines: true,
    trim: true,
  });
  assert.deepEqual(records, [
    { date: "2026-01-02", description: "Fixture, quoted", amount: "12.34" },
  ]);
});

test("duplicate prototype headers become own data properties, never object prototypes", () => {
  const records = parse("__proto__,__proto__,description\nfirst,second,fixture\n", {
    columns: true,
    group_columns_by_name: true,
  });
  assert.equal(records.length, 1);
  const record = records[0];
  assert.ok(record && typeof record === "object");
  assert.equal(Object.getPrototypeOf(record), Object.prototype);
  assert.deepEqual(Object.getOwnPropertyDescriptor(record, "__proto__")?.value, [
    "first",
    "second",
  ]);
  assert.equal("description" in record ? record.description : undefined, "fixture");
  assert.equal(Object.hasOwn(record, "__proto__"), true);
});
