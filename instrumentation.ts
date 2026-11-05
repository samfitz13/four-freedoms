import type { Instrumentation } from "next";
import { logError } from "@/lib/logger";

export function onRequestError(...args: Parameters<Instrumentation.onRequestError>) {
  const [error, , context] = args;
  logError("server.request.failed", error, context);
}
