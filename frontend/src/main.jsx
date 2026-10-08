import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// After index.css so the console's rules win where they overlap with the
// older .admin-theme ones still left in it.
import './styles/admin.css'
// The collector and resident screens each add a few pieces on top of the same
// console shell, so both load after the shell they build on.
import './styles/collector.css'
import './styles/resident.css'
import App from './App.jsx'

const root = createRoot(document.getElementById('root'))
// Standalone, read-only map review. This entry is removed from production builds.
if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('preview') === 'map') {
  import('./debug/map_preview.jsx').then(({ default: MapPreview }) => root.render(<StrictMode><MapPreview /></StrictMode>))
} else if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('preview') === 'sidebar') {
  import('./debug/sidebar_preview.jsx').then(({ default: SidebarPreview }) => root.render(<StrictMode><SidebarPreview /></StrictMode>))
} else if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('preview') === 'redeem') {
  import('./debug/redeem_preview.jsx').then(({ default: RedeemPreview }) => root.render(<StrictMode><RedeemPreview /></StrictMode>))
} else {
  root.render(<StrictMode><App /></StrictMode>)
}
