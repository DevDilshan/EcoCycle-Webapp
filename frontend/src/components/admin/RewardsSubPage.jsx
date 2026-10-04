import { useMemo } from 'react'
import PageShell from './AdminPageShell'
import { AcToast } from './AcUi'

/**
 * Frame shared by the pages under Rewards: the console's top bar with a back
 * arrow to the overview, the page's summary tiles, then its content.
 */
export default function RewardsSubPage({ title, description, kpis, error, onDismissError, success, onDismissSuccess, children }) {
  // Problems show as an amber toast, successes as green/red ones, in one place.
  const problem = useMemo(() => (error ? { text: error, tone: 'warning' } : null), [error])

  return (
    <PageShell
      title={title}
      description={description}
      showBell
      backTo="/admin/rewards"
      backLabel="Back to Rewards"
    >
      {kpis && <div className="ac-grid ac-g3">{kpis}</div>}
      {children}
      <AcToast message={problem ?? success} onDone={problem ? onDismissError : onDismissSuccess} />
    </PageShell>
  )
}
