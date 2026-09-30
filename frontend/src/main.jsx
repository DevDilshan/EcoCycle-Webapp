import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// After index.css so the console's rules win where they overlap with the
// older .admin-theme ones that the resident pages still rely on.
import './styles/admin.css'
// The collector screens add a few pieces on top of the same console shell.
import './styles/collector.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
