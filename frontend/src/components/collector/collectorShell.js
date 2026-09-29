import { createContext, useContext } from 'react'

/**
 * Today's round, shared by the layout and both collector pages.
 *
 * CollectorLayout fetches it once and hands it down, so the sidebar badge, the
 * shift card, Overview and Today's route all read the same numbers -- and
 * marking a stop complete on either page updates the badge with it.
 */
export const CollectorRouteContext = createContext(null)

export function useCollectorData() {
  const value = useContext(CollectorRouteContext)
  if (!value) {
    throw new Error('useCollectorData must be used inside CollectorLayout')
  }
  return value
}
