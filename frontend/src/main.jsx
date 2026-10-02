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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
