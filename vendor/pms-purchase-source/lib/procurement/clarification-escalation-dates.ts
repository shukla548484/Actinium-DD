/** Business days equivalent — vessel should respond within this window. */
export const CLARIFICATION_RESPONSE_DAYS = 3;

export function clarificationResponseDueAt(requestedAt: Date): Date {
  const due = new Date(requestedAt);
  due.setDate(due.getDate() + CLARIFICATION_RESPONSE_DAYS);
  return due;
}

export function isClarificationOverdue(requestedAt: Date, now = new Date()): boolean {
  return now.getTime() > clarificationResponseDueAt(requestedAt).getTime();
}
