import assert from "node:assert/strict";
import test from "node:test";
import { atlasSnapshot, summarizeSnapshot } from "./atlas";

function fixture() {
  return {
    prepared: "January 15, 2025",
    cash: 12.34,
    outsideCash: 999999,
    funds: ["IUSV", "IUSG", "VEA", "VWO", "VTWO", "MUB"].map((symbol) => ({
      symbol,
      name: `Example ${symbol}`,
      short: "Example",
      shares: 2,
      price: 10.5,
      average: 11,
      expense: 0.04,
      count: 100,
      date: "Dec 31, 2024",
      source: 1,
      index: "Example index",
      role: "Example role",
      upside: "Example upside",
      risk: "Example risk",
      note: "Example note",
      holdings: [["Example company", 5]],
      color: "ignored",
      ink: "ignored",
    })),
    sources: [
      { id: 1, title: "Example issuer", date: "Dec 31, 2024", url: "https://example.com/facts" },
    ],
  };
}

test("keeps six holdings and sources, but strips visual styling and separate money market", () => {
  const data = atlasSnapshot(fixture(), "2025-01-10");
  assert.equal(data.funds.length, 6);
  assert.equal(data.sources.length, 1);
  assert.equal(data.priceAsOf, null);
  assert.equal(data.cash.asOf, "2025-01-10");
  assert.equal(data.cash.basis, "reconstructed");
  assert.equal("color" in data.funds[0]!, false);
  assert.equal("outsideCash" in data, false);
  assert.equal(summarizeSnapshot(data).totalCents, 13834);
});

test("cash and gain use cents and MUB is bonds, not cash", () => {
  const result = summarizeSnapshot(atlasSnapshot(fixture(), "2025-01-10"));
  assert.equal(result.holdingsCents, 12600);
  assert.equal(result.cashCents, 1234);
  assert.equal(result.stocksCents, 10500);
  assert.equal(result.bondsCents, 2100);
  assert.equal(result.gainCents, -600);
  assert.equal(result.stocksCents + result.bondsCents + result.cashCents, result.totalCents);
});

test("changing the separate money market has no effect on the imported snapshot", () => {
  const original = fixture();
  assert.deepEqual(
    atlasSnapshot(original, "2025-01-10"),
    atlasSnapshot({ ...original, outsideCash: 0 }, "2025-01-10"),
  );
});

test("duplicate or incomplete holdings fail", () => {
  const duplicate = fixture();
  duplicate.funds[1]!.symbol = "IUSV";
  assert.throws(() => atlasSnapshot(duplicate, "2025-01-10"));
  assert.throws(() => atlasSnapshot({ ...fixture(), funds: [] }, "2025-01-10"));
});

test("unknown assets are rejected instead of silently classified as stocks", () => {
  const data = fixture();
  data.funds[0]!.symbol = "UNKNOWN";
  assert.throws(() => atlasSnapshot(data, "2025-01-10"));
});

test("invalid cash, shares, prices, and calendar dates fail", () => {
  for (const cash of [-1, NaN, Infinity])
    assert.throws(() => atlasSnapshot({ ...fixture(), cash }, "2025-01-10"));
  for (const key of ["shares", "price", "average"] as const) {
    const data = fixture();
    data.funds[0]![key] = -1;
    assert.throws(() => atlasSnapshot(data, "2025-01-10"));
  }
  assert.throws(() => atlasSnapshot(fixture(), "2025-02-30"));
});

test("source references must resolve and unsafe URLs fail", () => {
  const missing = fixture();
  missing.funds[0]!.source = 2;
  assert.throws(() => atlasSnapshot(missing, "2025-01-10"));
  const duplicate = fixture();
  duplicate.sources.push(duplicate.sources[0]!);
  assert.throws(() => atlasSnapshot(duplicate, "2025-01-10"));
  const unsafe = fixture();
  unsafe.sources[0]!.url = "javascript:alert(1)";
  assert.throws(() => atlasSnapshot(unsafe, "2025-01-10"));
});

test("partial fractional-share values round once per position", () => {
  const input = fixture();
  input.funds[0]!.shares = 1.125;
  input.funds[0]!.price = 10.01;
  assert.equal(
    summarizeSnapshot(atlasSnapshot(input, "2025-01-10")).positions[0]!.valueCents,
    1126,
  );
});
