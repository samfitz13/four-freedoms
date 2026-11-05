// Shared disconnected Next.js adapters for route regression suites.
export function redirect(destination) {
  throw Object.assign(new Error("Redirect"), { destination });
}
export class NextResponse extends Response {}
