import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

export default function AdminLayout() {
  return (
    <div className="admin-layout">
      <Sidebar />
      <div className="admin-main">
        <TopBar />
        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
