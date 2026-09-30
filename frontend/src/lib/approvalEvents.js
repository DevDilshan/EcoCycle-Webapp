export const APPROVALS_UPDATED_EVENT = 'ecocycle-approvals-updated'

/** Tell the admin sidebar (and Approvals page) to refresh pending counts. */
export function notifyApprovalsUpdated(pendingCount) {
  window.dispatchEvent(
    new CustomEvent(APPROVALS_UPDATED_EVENT, {
      detail: typeof pendingCount === 'number' ? { pendingCount } : {},
    }),
  )
}
