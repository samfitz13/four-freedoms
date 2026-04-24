export class NotAMemberError extends Error {
  constructor(public readonly householdId: string) {
    super(`Not a member of household ${householdId}`);
    this.name = "NotAMemberError";
  }
}
