const events = new Set([
  "app.render.failed",
  "server.request.failed",
  "auth.operation.failed",
  "unexpected.failure",
]);
type LogEvent = "app.render.failed" | "server.request.failed" | "auth.operation.failed";

const errorNames = new Set([
  "Error",
  "TypeError",
  "RangeError",
  "ReferenceError",
  "SyntaxError",
  "URIError",
  "EvalError",
  "AggregateError",
]);
const routes = new Set([
  "/api/time/calendar/callback",
  "/api/time/calendar/sync",
  "/api/auth/[...all]",
]);

// Deny by default: bodies, headers, URLs, user IDs and arbitrary context never
// reach JSON serialization. Error messages, causes and stacks can contain PII.
export function redactedLogContext(context: unknown) {
  if (!context || typeof context !== "object") return {};
  const result: { status?: number; requestId?: string; route?: string; routerKind?: string } = {};
  if ("status" in context && typeof context.status === "number") {
    if (Number.isInteger(context.status) && context.status >= 100 && context.status <= 599)
      result.status = context.status;
  }
  if ("requestId" in context && typeof context.requestId === "string") {
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(context.requestId))
      result.requestId = context.requestId;
  }
  if ("routePath" in context && typeof context.routePath === "string") {
    if (routes.has(context.routePath)) result.route = context.routePath;
  }
  if (
    "routerKind" in context &&
    (context.routerKind === "App Router" || context.routerKind === "Pages Router")
  )
    result.routerKind = context.routerKind;
  return result;
}

export function errorMetadata(error: unknown) {
  const result: { name: string; digest?: string; code?: string } = { name: "Error" };
  if (!(error instanceof Error)) return result;
  if (errorNames.has(error.name)) result.name = error.name;
  if ("digest" in error && typeof error.digest === "string" && /^[0-9]{1,32}$/.test(error.digest))
    result.digest = error.digest;
  if (
    "code" in error &&
    (error.code === "EMAIL_NOT_CONFIGURED" || error.code === "EMAIL_DELIVERY_FAILED")
  )
    result.code = error.code;
  return result;
}

export function logError(event: LogEvent, error: unknown, context: unknown = {}) {
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "error",
      event: events.has(event) ? event : "unexpected.failure",
      runtime: typeof window === "undefined" ? "server" : "browser",
      ...redactedLogContext(context),
      error: errorMetadata(error),
    }),
  );
}

export function logAuthError(level: string, _message: string, ...args: unknown[]) {
  if (level === "error")
    logError(
      "auth.operation.failed",
      args.find((arg) => arg instanceof Error),
    );
}
