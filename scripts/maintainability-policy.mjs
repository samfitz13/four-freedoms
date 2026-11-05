const limits = Object.freeze({
  complexity: 20,
  lines: 500,
  sourceBytes: 128 * 1024,
  assetBytes: 5 * 1024 * 1024,
});

export function maintainabilityLimits() {
  return limits;
}

export function isSourcePath(file) {
  return (
    /\.(?:[cm]?js|jsx|tsx?)$/.test(file) &&
    (!file.includes("/") || /^(?:app|components|lib|scripts|\.devcontainer)\//.test(file))
  );
}

export function metricKey(metric) {
  return `${metric.kind}:${metric.path}:${metric.symbol ?? ""}`;
}

function entryErrors(entry) {
  const errors = [];
  if (!/^DEBT-\d{3}$/.test(entry.id ?? "")) errors.push("invalid debt ID");
  if (!/^[a-z\d][a-z\d-]{0,38}$/i.test(entry.owner ?? "")) errors.push("missing GitHub owner");
  if (!/^P[0-3]$/.test(entry.priority ?? "")) errors.push("invalid priority");
  if (!["open", "closed"].includes(entry.status)) errors.push("invalid status");
  if (!["complexity", "lines", "maintenance"].includes(entry.kind)) errors.push("invalid kind");
  for (const field of ["summary", "plan"]) {
    if (typeof entry[field] !== "string" || entry[field].trim().length < 20)
      errors.push(`missing actionable ${field}`);
  }
  if (
    typeof entry.path !== "string" ||
    entry.path.startsWith("/") ||
    entry.path.includes("\\") ||
    entry.path.split("/").includes("..") ||
    !isSourcePath(entry.path)
  )
    errors.push("invalid repository source path");
  return errors;
}

export function validateDebtRegister(register) {
  if (register?.version !== 1 || !Array.isArray(register.entries))
    return ["Debt register must have version 1 and an entries array."];
  const errors = [];
  const ids = new Set();
  const keys = new Set();
  for (const entry of register.entries) {
    if (!entry || typeof entry !== "object") {
      errors.push("Debt entries must be objects.");
      continue;
    }
    for (const issue of entryErrors(entry)) errors.push(`${entry.id ?? "Debt entry"}: ${issue}.`);
    if (ids.has(entry.id)) errors.push(`Duplicate debt ID: ${entry.id}.`);
    ids.add(entry.id);
    if (entry.status !== "open" || entry.kind === "maintenance") continue;
    if (!Number.isInteger(entry.budget) || entry.budget <= limits[entry.kind])
      errors.push(`${entry.id}: budget must describe a measured legacy violation.`);
    if (entry.kind === "complexity" && !entry.symbol)
      errors.push(`${entry.id}: complexity debt requires a function label.`);
    const key = metricKey(entry);
    if (keys.has(key)) errors.push(`${entry.id}: duplicate active metric budget.`);
    keys.add(key);
  }
  return errors;
}

export function checkMetricBudgets(metrics, entries) {
  const errors = [];
  const budgets = new Map(
    entries
      .filter((entry) => entry.status === "open" && entry.kind !== "maintenance")
      .map((entry) => [metricKey(entry), entry]),
  );
  const seen = new Set();
  for (const metric of metrics) {
    const key = metricKey(metric);
    if (seen.has(key)) {
      errors.push(`${metric.path}: ambiguous repeated function label; name or simplify it.`);
      continue;
    }
    seen.add(key);
    const debt = budgets.get(key);
    if (!debt) {
      errors.push(
        `${metric.path}:${metric.line ?? 1}: new ${metric.kind} violation (${metric.value} > ${limits[metric.kind]}). Refactor it.`,
      );
    } else if (metric.value > debt.budget) {
      errors.push(`${debt.id}: ${metric.kind} grew from ${debt.budget} to ${metric.value}.`);
    } else if (metric.value < debt.budget) {
      errors.push(`${debt.id}: improvement detected; lower its budget to ${metric.value}.`);
    }
  }
  for (const [key, entry] of budgets) {
    if (!seen.has(key))
      errors.push(`${entry.id}: metric is gone or within the limit; close the debt entry.`);
  }
  return errors;
}

export function checkDebtChanges(current, previous) {
  if (!previous) return [];
  const errors = [];
  const prior = new Map(previous.entries.map((entry) => [metricKey(entry), entry]));
  for (const entry of current.entries) {
    if (entry.status !== "open" || entry.kind === "maintenance") continue;
    const old = prior.get(metricKey(entry));
    if (!old || old.status !== "open")
      errors.push(`${entry.id}: new/reopened legacy budget is not allowed; refactor the hotspot.`);
    else if (entry.budget > old.budget)
      errors.push(`${entry.id}: cannot increase the base branch budget of ${old.budget}.`);
  }
  return errors;
}

export function debtMarkerRule(entries) {
  const openIds = new Set(entries.filter((entry) => entry.status === "open").map((e) => e.id));
  return {
    meta: {
      type: "problem",
      schema: [],
      messages: {
        malformed: "Debt markers require MARKER(DEBT-000): an actionable explanation.",
        untracked: "Debt marker references an unknown or closed register entry.",
      },
    },
    create(context) {
      return {
        Program() {
          for (const comment of context.sourceCode.getAllComments()) {
            for (const marker of comment.value.matchAll(/\b(?:TODO|FIXME|HACK|XXX)\b/gi)) {
              const rest = comment.value.slice(marker.index);
              const match = /^(?:TODO|FIXME|HACK|XXX)\((DEBT-\d{3})\):[ \t]+(\S[^\n]*)/i.exec(rest);
              const messageId =
                !match || match[2].trim().length < 12
                  ? "malformed"
                  : !openIds.has(match[1])
                    ? "untracked"
                    : null;
              if (messageId) context.report({ loc: comment.loc, messageId });
            }
          }
        },
      };
    },
  };
}
