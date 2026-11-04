// Executes the actual adapter, Goals, and Overview against disconnected reads.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(path.join(root, "package.json"));
const esbuild = require(require.resolve("esbuild", { paths: [require.resolve("tsx")] }));
const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "fi-adapter-check-")), "check.cjs");
const mocks = `
export const calls = [];
const params = {annualSpend:60000, realReturn:0.05, monthlyContribution:2800,useManualContribution:true};
const accounts = [{id:"a",name:"Brokerage",type:"brokerage",currency:"USD"},{id:"s",name:"Money market savings",type:"savings",currency:"USD"},{id:"c",name:"Checking",type:"checking",currency:"USD"}];
const rows = [{accountId:"a",month:"2026-09-01",balance:"193800",employee:"1800",employer:"1000"},{accountId:"s",month:"2026-09-01",balance:"50000",employee:"500",employer:"0"}];
function chain(){return new Proxy({}, {get(_, key){if(key==="then") return resolve=>resolve(rows);return ()=>chain();}})}
export const db={select:()=>chain(),transaction:async fn=>{
 if(globalThis.__fiSaveError) throw Error("Synthetic failure");
 return fn({update:()=>({set:()=>({where:async()=>{}})}),insert:()=>({values:async values=>{globalThis.__fiSaved=values}})});
}};
export const financialAccounts={id:"id",householdId:"household",isArchived:"archived"};
export const financialGoals={id:"id",householdId:"household",kind:"kind",status:"status"};
export const monthlyStatements={accountId:"account",month:"month",endingBalance:"balance",employeeContribution:"employee",employerMatch:"employer",householdId:"household"};
export function listAccounts(id){calls.push(["accounts",id]);return accounts}
export function listInvestmentSnapshots(id){calls.push(["snapshots",id]);return []}
export function getBaseCurrency(id){calls.push(["currency",id]);return "USD"}
export function getFiGoalAssumptions(id){calls.push(["settings",id]);return {settings:globalThis.__fiSaved?.params??params}}
export function listFinancialGoals(){return [{id:"fi",kind:"fi_number",status:"active",params}]}
export function latestBalances(){return []}
export function cashflowByMonth(){return []}
export function budgetActuals(){return []}
export function listPaystubsForMonth(){return []}
export function listStatementMonths(){return []}
export function monthStart(d){return d.toISOString().slice(0,7)+"-01"}
export function toNumber(n){return Number(n??0)}
export function getDerivedFiInputs(){return {returnHistory:{annualNominalReturn:0.99,monthsObserved:24},trailingContributions:{average:99999}}}
export function getSavingsRateSeries(){return []}
export function getTrailingSavingsRate(){return null}
export function getUserBirthDate(){return "1991-02-15"}
export function computeMonthlyRollup(){return null}
export function requireUser(){return {id:"qa-user"}}
export function scopeForUser(){return {primaryHouseholdId:"qa-household"}}
export function revalidatePath(){}
`;
await esbuild.build({
  stdin: {
    contents: `
      export {FinancialGoalsTab} from "./app/(app)/[freedom]/_financial/goals";
      export {computeFinancialOverview} from "./lib/freedoms/financial-overview";
      export {getHouseholdFiPlan} from "./lib/freedoms/fi-plan-server";
      export {setFiGoal} from "./app/(app)/[freedom]/_financial/goals-actions";
    `,
    resolveDir: root,
    loader: "tsx",
  },
  bundle: true,
  outfile: out,
  platform: "node",
  format: "cjs",
  jsx: "automatic",
  plugins: [
    {
      name: "disconnected-reads",
      setup(build) {
        build.onResolve({ filter: /^server-only$/ }, () => ({ path: "empty", namespace: "empty" }));
        build.onLoad({ filter: /.*/, namespace: "empty" }, () => ({ contents: "" }));
        build.onResolve(
          {
            filter:
              /^@\/lib\/db\/|^@\/lib\/auth-server$|^next\/cache$|(?:financial-settings|financial-derived|financial-statements)$/,
          },
          () => ({ path: "reads", namespace: "mock" }),
        );
        build.onLoad({ filter: /.*/, namespace: "mock" }, () => ({
          contents: mocks,
          loader: "js",
        }));
        build.onResolve({ filter: /^@\// }, (args) => {
          const base = path.join(root, args.path.slice(2));
          return {
            path: [base + ".ts", base + ".tsx", base + "/index.ts"].find((p) => fs.existsSync(p)),
          };
        });
      },
    },
  ],
  logLevel: "silent",
});
const { FinancialGoalsTab, computeFinancialOverview, getHouseholdFiPlan, setFiGoal } = require(out);
const goalTree = await FinancialGoalsTab({
  householdId: "qa-household",
  baseCurrency: "USD",
  userId: "qa-user",
});
function findView(node) {
  if (!node || typeof node !== "object") return null;
  if (node.props?.view) return node.props.view;
  return [node.props?.children].flat(Infinity).map(findView).find(Boolean) ?? null;
}
const goals = findView(goalTree);
assert.ok(goals?.plan);
const overview = await computeFinancialOverview("qa-household");
const adapter = await getHouseholdFiPlan("qa-household");
assert.deepEqual(goals, adapter);
assert.deepEqual(overview.fiTrack.projection, adapter);
assert.equal(overview.fiTrack.monthsToFi, goals.plan.monthsToFi);
assert.equal(overview.fiTrack.invested, goals.allocation.balance);
assert.equal(overview.fiTrack.monthlyContribution, goals.contribution);
assert.equal(goals.plan.series[0].month, "2026-09-01");
assert.equal(goals.scenarios[0].realReturn, 0.05); // Never use the 99% retrospective estimate.
assert.equal(goals.allocation.balance, 193800); // Savings remain opt-in.
function form() {
  const result = new FormData();
  for (const [key, value] of Object.entries({
    annualSpend: "60000",
    withdrawalRate: "4",
    realReturn: "5",
    inflationRate: "3",
    downsideReduction: "2",
    returnMode: "portfolio",
    useManualContribution: "true",
    monthlyContribution: "0",
    includedAccountIds: "a",
    confirmIncludedAccounts: "true",
    "allocationMode:a": "manual",
    "allocation:a:usEquity": "60",
    "allocation:a:developedEquity": "0",
    "allocation:a:emergingEquity": "0",
    "allocation:a:bonds": "30",
    "allocation:a:cash": "10",
    "expense:a": "0.1",
    equitiesReturn: "6",
    bondsReturn: "4",
    cashReturn: "3",
    additionalFee: "0.25",
    retirementAge: "65",
    endAge: "95",
    monthlyRetirementIncome: "2000",
    incomeAge: "70",
  }))
    result.set(key, value);
  return result;
}
for (const [field, value, message] of [
  ["includedAccountIds", "another-household", "unavailable"],
  ["includedAccountIds", "c", "excluded"],
  ["confirmIncludedAccounts", "", "Confirm"],
  ["allocation:a:usEquity", "50", "100%"],
  ["endAge", "60", "Plan end"],
  ["incomeAge", "", "income start"],
]) {
  const invalid = form();
  invalid.set(field, value);
  const response = await setFiGoal(null, invalid);
  assert.equal(response.ok, false);
  assert.ok(response.error.includes(message), response.error);
}
globalThis.__fiSaveError = true;
assert.equal((await setFiGoal(null, form())).ok, false);
globalThis.__fiSaveError = false;
assert.equal((await setFiGoal(null, form())).ok, true);
assert.equal(globalThis.__fiSaved.householdId, "qa-household");
assert.equal(globalThis.__fiSaved.params.retirementMonth, "2056-03-01");
assert.equal(globalThis.__fiSaved.params.endMonth, "2086-03-01");
assert.equal(globalThis.__fiSaved.params.assumptions.additionalFee, 0.0025);
assert.deepEqual(globalThis.__fiSaved.params.includedAccountIds, ["a"]);
const withSavings = form();
withSavings.append("includedAccountIds", "s");
withSavings.set("useManualContribution", "false");
// A forged allocation or snapshot confirmation must never override bank cash.
withSavings.set("allocationMode:s", "manual");
withSavings.set("allocation:s:usEquity", "100");
withSavings.set("expense:s", "10");
withSavings.set("confirmSnapshot:s", "forged");
assert.equal((await setFiGoal(null, withSavings)).ok, true);
assert.deepEqual(globalThis.__fiSaved.params.includedAccountIds, ["a", "s"]);
assert.equal(globalThis.__fiSaved.params.manualAllocations.s, undefined);
assert.equal(globalThis.__fiSaved.params.confirmedSnapshots.s, undefined);
const savedAdapter = await getHouseholdFiPlan("qa-household");
const savedGoals = findView(
  await FinancialGoalsTab({ householdId: "qa-household", baseCurrency: "USD", userId: "qa-user" }),
);
const savedOverview = await computeFinancialOverview("qa-household");
assert.deepEqual(savedGoals, savedAdapter);
assert.deepEqual(savedOverview.fiTrack.projection, savedAdapter);
assert.equal(savedAdapter.allocation.balance, 243800);
assert.equal(savedAdapter.contribution, 3300);
assert.equal(savedAdapter.allocation.coverage.find((a) => a.id === "s").allocation.cash, 1);
const savingsOnly = form();
savingsOnly.set("includedAccountIds", "s");
assert.equal((await setFiGoal(null, savingsOnly)).ok, true);
assert.deepEqual(globalThis.__fiSaved.params.manualAllocations, {});
assert.equal((await getHouseholdFiPlan("qa-household")).allocation.weights.cash, 1);
console.log(
  JSON.stringify({
    passed: true,
    scope:
      "Actual Goals + Overview + adapter + save validation with disconnected reads/writes, not authenticated E2E",
  }),
);
