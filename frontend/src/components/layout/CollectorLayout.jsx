import { Outlet } from 'react-router-dom'
import CollectorSidebar from './CollectorSidebar'
import CollectorTopBar from './CollectorTopBar'

export default function CollectorLayout() {
  return (
    <div className="admin-layout">
      <CollectorSidebar />
      <div className="admin-main">
        <CollectorTopBar />
        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
