import { Link } from 'react-router-dom'

export default function TopBar() {
  return (
    <header className="admin-topbar">
      <Link to="/" className="admin-topbar-home">← Back to site</Link>
    </header>
  )
}
