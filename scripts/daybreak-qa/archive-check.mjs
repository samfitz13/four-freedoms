// Actual financial readers/actions with an in-memory ORM adapter. No database or credentials.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(path.join(root, "package.json"));
const esbuild = require(require.resolve("esbuild", { paths: [require.resolve("tsx")] }));
const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "archive-check-")), "check.cjs");
const tableNames = [
  "financialAccounts",
  "financialGoals",
  "monthlyStatements",
  "monthlySummaries",
  "cashflowTransactions",
  "budgetCategories",
  "budgetPeriods",
  "paystubs",
  "freedomSettings",
  "isoOptionGrants",
  "isoOptionExercises",
  "isoOptionValuations",
  "isoOptionAccountDetails",
  "investmentSnapshots",
  "csvImports",
];
const mocks = `
const table = name => new Proxy({_name:name}, {get(t,k){return k==="_name"?name:{table:name,key:k}}});
${tableNames.map((name) => `export const ${name}=table("${name}");`).join("\n")}
export const state = {tables:Object.fromEntries(${JSON.stringify(tableNames)}.map(n=>[n,[]])),writes:[]};
export const eq=(a,b)=>({op:"eq",a,b}), lt=(a,b)=>({op:"lt",a,b}), lte=(a,b)=>({op:"lte",a,b}), gte=(a,b)=>({op:"gte",a,b});
export const and=(...args)=>({op:"and",args:args.filter(Boolean)}), or=(...args)=>({op:"or",args});
export const inArray=(a,b)=>({op:"in",a,b}), ilike=(a,b)=>({op:"ilike",a,b});
export const asc=a=>({order:a,direction:1}), desc=a=>({order:a,direction:-1});
export const sql=(strings,...values)=>({sql:true,strings,values});
const val=(v,r)=>v?.table?r[v.table]?.[v.key]:v;
function matches(f,r){
 if(!f) return true;
 if(f.op==="and")return f.args.every(a=>matches(a,r));
 if(f.op==="or")return f.args.some(a=>matches(a,r));
 if(f.sql && f.strings.join("").includes("any"))return f.values[1].includes(val(f.values[0],r));
 const a=val(f.a,r),b=val(f.b,r);
 if(f.op==="eq")return a===b;
 if(f.op==="lt")return a<b;
 if(f.op==="lte")return a<=b;
 if(f.op==="gte")return a>=b;
 if(f.op==="in")return b.includes(a);
 throw Error("Unsupported mock filter: "+JSON.stringify(f));
}
function query(fields,distinct,write){
 let name,filter,limit=Infinity,orders=[],joins=[],grouped=false,values;
 const q={
  from(t){name=t._name;return q},
  innerJoin(t,on){joins.push([t._name,on,false]);return q},
  leftJoin(t,on){joins.push([t._name,on,true]);return q},
  where(f){filter=f;return q},orderBy(...o){orders=o;return q},limit(n){limit=n;return q},
  groupBy(){grouped=true;return q},set(v){values=v;return q},values(v){values=v;return q},
  returning(f){fields=f;return q},onConflictDoUpdate(){return q},onConflictDoNothing(){return q},
  then(resolve,reject){try{
   if(write==="insert"){state.writes.push({name,values});const rows=[values].flat();state.tables[name].push(...rows);return resolve(rows)}
   let rows=state.tables[name].map(r=>({[name]:r}));
   for(const [t,on,left]of joins)rows=rows.flatMap(r=>{const found=state.tables[t].map(j=>({...r,[t]:j})).filter(c=>matches(on,c));return found.length?found:left?[r]:[]});
   rows=rows.filter(r=>matches(filter,r));
   for(const order of [...orders].reverse()){const col=order.order??order,dir=order.direction??1;rows.sort((a,b)=>String(val(col,a)??"").localeCompare(String(val(col,b)??""))*dir)}
   if(distinct){const seen=new Set();rows=rows.filter(r=>{const key=JSON.stringify(distinct.map(c=>val(c,r)));if(seen.has(key))return false;seen.add(key);return true})}
   rows=rows.slice(0,limit);
   if(write==="update"){for(const r of rows)Object.assign(r[name],values);state.writes.push({name,values})}
   if(fields?.occurredOn?.sql){const min=state.tables[name].map(r=>r.occurredOn).sort()[0]??null;return resolve([{occurredOn:min}])}
   if(fields?.month?.sql && name==="cashflowTransactions"){
    const months=new Map();for(const r of rows){const row=r[name],m=row.occurredOn.slice(0,7)+"-01";const v=months.get(m)??{month:m,income:0,expense:0};const n=Number(row.amount);if(n>0)v.income+=n;else v.expense-=n;months.set(m,v)}return resolve([...months.values()]);
   }
   let result=rows.map(r=>fields?Object.fromEntries(Object.entries(fields).map(([k,c])=>[k,val(c,r)])):({...r[name]}));
   if(grouped)result=[...new Map(result.map(r=>[JSON.stringify(r),r])).values()];
   resolve(result);
  }catch(e){reject(e)}}
 };
 return q;
}
export const db={
 select:f=>query(f),selectDistinctOn:(d,f)=>query(f,d),
 update:t=>{const q=query(undefined,undefined,"update");return q.from(t)},
 insert:t=>{const q=query(undefined,undefined,"insert");return q.from(t)},
 transaction:async f=>f(db)
};
export function requireUser(){return {id:"qa-user"}}
export function scopeForUser(){return {primaryHouseholdId:"qa-household"}}
export function revalidatePath(){}
export function getUserBirthDate(){return "1991-02-15"}
`;
await esbuild.build({
  stdin: {
    contents: `
      export {state} from "archive-mocks";
      export * from "./lib/db/queries/financial";
      export * from "./lib/db/queries/statements";
      export * from "./lib/db/queries/investment-snapshots";
      export * from "./lib/db/queries/iso-options";
      export * from "./lib/freedoms/financial-derived";
      export {computeMonthlyRollup} from "./lib/freedoms/financial-statements";
      export {getHouseholdFiPlan} from "./lib/freedoms/fi-plan-server";
      export {archiveAccount,addIsoOptionValuation,addIsoOptionExercise} from "./app/(app)/[freedom]/_financial/accounts-actions";
      export {addTransaction,addTransfer} from "./app/(app)/[freedom]/_financial/cashflow-actions";
      export {setFiGoal,setGoalLinks} from "./app/(app)/[freedom]/_financial/goals-actions";
      export {seedNewMonth,saveMonthStatements} from "./app/(app)/[freedom]/_financial/statements-actions";
      export {importCsv} from "./app/(app)/[freedom]/import/actions";
      export {FI_PLANNING_DEFAULTS,EMPTY_ALLOCATION} from "./lib/freedoms/constants";
      import {renderToStaticMarkup} from "react-dom/server";
      import {FiPlanFields} from "./app/(app)/[freedom]/_financial/fi-plan-fields";
      export function renderFiFields(view){return renderToStaticMarkup(<FiPlanFields view={view} portfolio={true} />)}
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
      name: "archive-in-memory-adapter",
      setup(build) {
        build.onResolve({ filter: /^server-only$/ }, () => ({ path: "empty", namespace: "empty" }));
        build.onLoad({ filter: /.*/, namespace: "empty" }, () => ({ contents: "" }));
        build.onResolve(
          {
            filter:
              /^archive-mocks$|^drizzle-orm$|^next\/cache$|^@\/lib\/(?:db\/(?:client|schema|scope)|auth-server|db\/queries\/profile)$/,
          },
          () => ({ path: "mocks", namespace: "mock" }),
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
const api = require(out),
  { state } = api;
const householdId = "qa-household";
const month = new Date().toISOString().slice(0, 7) + "-01";
const last = api.shiftMonth(month, -1),
  older = api.shiftMonth(month, -2);
const account = (id, type) => ({
  id,
  householdId,
  name: id,
  type,
  subtype: null,
  currency: "USD",
  isArchived: false,
});
state.tables.financialAccounts.push(
  account("Brokerage", "brokerage"),
  account("Savings", "savings"),
  account("Options", "iso_options"),
  { ...account("Foreign", "brokerage"), householdId: "other" },
);
for (const m of [older, last])
  for (const [id, balance, contribution] of [
    ["Brokerage", 100000, 1000],
    ["Savings", 50000, 500],
  ])
    state.tables.monthlyStatements.push({
      id: id + m,
      householdId,
      accountId: id,
      month: m,
      endingBalance: String(balance),
      employeeContribution: String(contribution),
      employerMatch: "0",
      notes: null,
    });
state.tables.investmentSnapshots.push({
  id: "snapshot",
  householdId,
  accountId: "Brokerage",
  preparedOn: last,
  sourceKey: "qa",
  data: {
    version: 1,
    prepared: "Synthetic",
    priceAsOf: null,
    funds: [],
    cash: { amount: 100000, basis: "estimate", asOf: last, note: "Synthetic cash" },
    sources: [],
  },
});
state.tables.cashflowTransactions.push({
  id: "tx",
  householdId,
  accountId: "Brokerage",
  occurredOn: last,
  amount: "10000",
  kind: "cashflow",
});
const params = {
  version: 2,
  returnMode: "portfolio",
  annualSpend: 60000,
  withdrawalRate: 0.04,
  realReturn: 0.05,
  downsideReduction: 0.02,
  useManualContribution: false,
  monthlyContribution: 0,
  includedAccountIds: ["Brokerage", "Savings"],
  confirmedSnapshots: {},
  manualAllocations: {
    Brokerage: { weights: { ...api.EMPTY_ALLOCATION, usEquity: 1 }, expenseRate: 0.001 },
  },
  assumptions: api.FI_PLANNING_DEFAULTS,
  retirementMonth: null,
  endMonth: null,
  monthlyRetirementIncome: 0,
  incomeStartMonth: null,
};
state.tables.financialGoals.push({
  id: "fi",
  householdId,
  kind: "fi_number",
  status: "active",
  params,
  targetAmount: "1500000",
});
async function history() {
  return {
    netWorth: await api.netWorthBreakdownSeries(householdId),
    categories: await api.wealthCategorySeries(householdId),
    statements: await api.getStatementHistory(householdId),
    derived: await api.getDerivedFiInputs(householdId),
    savings: await api.getSavingsRateSeries(householdId),
    snapshots: await api.listInvestmentSnapshots(householdId),
    options: await api.listIsoOptionSummaries(householdId, last),
    ledger: await api.listLedger(householdId, {}, null),
  };
}
const before = await history();
const fiBefore = await api.getHouseholdFiPlan(householdId);
assert.ok(fiBefore.plan);
for (const id of ["Brokerage", "Savings", "Options"]) {
  const form = new FormData();
  form.set("id", id);
  await api.archiveAccount(form);
}
assert.equal((await api.listAccounts(householdId)).length, 0);
assert.equal((await api.listAccounts(householdId, { includeArchived: true })).length, 3);
assert.deepEqual(await history(), before, "Archiving must not rewrite or hide financial history");
const fiAfter = await api.getHouseholdFiPlan(householdId);
assert.deepEqual(fiAfter.plan, fiBefore.plan);
assert.deepEqual(fiAfter.actualSeries, fiBefore.actualSeries);
const html = api.renderFiFields(fiAfter);
assert.ok(html.includes("Brokerage (archived)") && html.includes("Savings (archived)"));
assert.ok(
  !html.includes('name="includedAccountIds"') && !html.includes('name="allocationMode:Brokerage"'),
);
const carried = await api.listStatementsForMonth(householdId, month);
assert.equal(carried.length, 2);
assert.equal(
  carried.reduce((s, r) => s + r.endingBalance, 0),
  150000,
);
assert.ok(
  carried.every(
    (r) =>
      r.isArchived &&
      r.carriedFromMonth === last &&
      r.employeeContribution === 0 &&
      r.employerMatch === 0,
  ),
);
assert.equal((await api.computeMonthlyRollup(householdId, month)).netWorth, 150000);
assert.deepEqual(await api.listStatementsForMonth(householdId, api.shiftMonth(older, -1)), []);
assert.equal(
  (await api.latestBalances(householdId)).reduce((s, r) => s + r.balance, 0),
  150000,
);
const writes = state.writes.length;
const form = (values) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, String(v));
  return f;
};
assert.equal(
  (
    await api.addTransaction(
      null,
      form({
        accountId: "Brokerage",
        occurredOn: month,
        amount: 100,
        flow: "income",
        currency: "USD",
      }),
    )
  ).ok,
  false,
);
assert.equal(
  (
    await api.addTransfer(
      null,
      form({
        fromAccountId: "Brokerage",
        toAccountId: "Savings",
        occurredOn: month,
        amount: 100,
        currency: "USD",
      }),
    )
  ).ok,
  false,
);
assert.equal(
  (await api.addIsoOptionValuation(null, form({ accountId: "Options", asOf: month, fmv: 10 }))).ok,
  false,
);
state.tables.isoOptionGrants.push({ id: "closed-grant", householdId, accountId: "Options" });
assert.equal(
  (
    await api.addIsoOptionExercise(
      null,
      form({ grantId: "closed-grant", exerciseDate: month, shares: 1 }),
    )
  ).ok,
  false,
);
await api.seedNewMonth(form({ month }));
await api.saveMonthStatements(
  null,
  form({ month, "bal[Brokerage]": 999999, "ctb[Brokerage]": 999999 }),
);
assert.equal(state.writes.length, writes, "Archived accounts must not receive new input");
assert.equal(
  state.tables.monthlyStatements.length,
  4,
  "Carrying balances must not insert statements",
);
for (const override of [false, true]) {
  const upload = form({ kind: "transactions", ...(override ? { accountId: "Brokerage" } : {}) });
  upload.set(
    "file",
    new File(
      [`date,amount,account,description\n${last},100,Brokerage,Synthetic\n`],
      "synthetic.csv",
      { type: "text/csv" },
    ),
  );
  const result = await api.importCsv(null, upload);
  assert.equal(result.inserted, 0);
  assert.ok(result.errors.length > 0);
  assert.equal(
    state.tables.cashflowTransactions.length,
    1,
    "CSV imports must not write to archived accounts",
  );
}
assert.equal((await api.listAccounts("other", { includeArchived: true })).length, 1);
const saveForm = form({
  annualSpend: 60000,
  withdrawalRate: 4,
  realReturn: 5,
  inflationRate: 3,
  downsideReduction: 2,
  returnMode: "portfolio",
  confirmIncludedAccounts: true,
  equitiesReturn: 6,
  bondsReturn: 4,
  cashReturn: 3,
  "allocationMode:Brokerage": "manual",
  "allocation:Brokerage:usEquity": 0,
  "expense:Brokerage": 10,
});
assert.equal((await api.setFiGoal(null, saveForm)).ok, true);
const saved = state.tables.financialGoals.find(
  (g) => g.kind === "fi_number" && g.status === "active",
);
assert.deepEqual(saved.params.includedAccountIds, params.includedAccountIds);
assert.deepEqual(
  saved.params.manualAllocations,
  params.manualAllocations,
  "Archived allocation must not accept forged edits",
);
assert.equal((await api.getHouseholdFiPlan(householdId)).allocation.balance, 150000);
state.tables.financialAccounts.push({
  ...account("Unselected closed savings", "savings"),
  isArchived: true,
});
saveForm.set("includedAccountIds", "Unselected closed savings");
assert.equal(
  (await api.setFiGoal(null, saveForm)).ok,
  false,
  "Archived accounts cannot be newly selected",
);
state.tables.financialGoals.push({
  id: "linked",
  householdId,
  kind: "net_worth_target",
  status: "active",
  params: { linkedAccountIds: ["Brokerage"] },
});
assert.equal((await api.setGoalLinks(null, form({ id: "linked", linkMode: "accounts" }))).ok, true);
assert.deepEqual(
  state.tables.financialGoals.find((g) => g.id === "linked").params.linkedAccountIds,
  ["Brokerage"],
);
state.tables.financialAccounts.push(account("Active", "checking"));
assert.equal(
  (
    await api.addTransaction(
      null,
      form({
        accountId: "Active",
        occurredOn: month,
        amount: 100,
        flow: "income",
        currency: "USD",
      }),
    )
  ).ok,
  true,
);
console.log(
  JSON.stringify({
    passed: true,
    scope:
      "Archive action, history, balances, snapshots, ISO summaries, ledger and input guards with disconnected ORM; not authenticated E2E",
  }),
);
