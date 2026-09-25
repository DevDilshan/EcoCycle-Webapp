import { Outlet } from 'react-router-dom'
import ResidentSidebar from './ResidentSidebar'

export default function ResidentLayout() {
  return (
    <div className="admin-layout admin-theme">
      <ResidentSidebar />
      <div className="admin-main">
        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
