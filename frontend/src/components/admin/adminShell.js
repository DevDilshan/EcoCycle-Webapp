import { createContext, useContext } from 'react'

/**
 * Lets PageShell's menu button open the sidebar that AdminLayout owns. The
 * button sits in the top bar and the sidebar is its sibling, so the state has
 * to live in the layout above both.
 */
export const AdminShellContext = createContext({ openNav: () => {} })

export function useAdminShell() {
  return useContext(AdminShellContext)
}
