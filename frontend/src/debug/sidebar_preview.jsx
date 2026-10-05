import { MemoryRouter, useLocation } from 'react-router-dom'
import { AuthProvider } from '../context/AuthContext'
import Sidebar from '../components/layout/Sidebar'

function SidebarReview() {
  const { pathname } = useLocation()
  return <div className="admin-console admin-theme">
    <Sidebar readOnly />
    <main className="ac-main" style={{ padding: 32 }}>
      <p>Development preview · Navigation and hover styles only</p>
      <h1>Admin sidebar</h1><p>Selected page: {pathname}. Links stay in this preview; no records are changed.</p>
    </main>
  </div>
}

export default function SidebarPreview() {
  return <AuthProvider><MemoryRouter initialEntries={['/admin/complaints']}><SidebarReview /></MemoryRouter></AuthProvider>
}
