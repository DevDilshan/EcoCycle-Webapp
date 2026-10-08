/** Notifier LLM draft for the household (from GET /api/approvals/{id}). */
export function notifierResidentDraft(detail) {
  return detail?.agentInsight?.residentNotification?.trim() || ''
}
