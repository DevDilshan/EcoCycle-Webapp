import { Link } from 'react-router-dom'
import PublicNavbar from '../components/layout/PublicNavbar'

export default function HomePage() {
  return (
    <div className="page">
      <PublicNavbar />

      <main className="hero">
        <h1>Smart Waste &amp; Recycling Pickup</h1>
        <p>Schedule pickups, track recycling, and manage waste collection — all in one platform.</p>
        <div className="hero-actions">
          <Link to="/register" className="btn-primary">Get Started</Link>
          <Link to="/login" className="btn-secondary">Sign In</Link>
        </div>
      </main>

      <section id="features" className="home-section">
        <h2>Features</h2>
        <div className="home-grid">
          <article className="home-card">
            <h3>📦 Pickup Requests</h3>
            <p>Residents request waste pickup with photos and preferred dates.</p>
          </article>
          <article className="home-card">
            <h3>🗺️ Route Management</h3>
            <p>Collectors get optimized daily routes by zone.</p>
          </article>
          <article className="home-card">
            <h3>⭐ Rewards</h3>
            <p>Earn points for recycling correctly and track your impact.</p>
          </article>
          <article className="home-card">
            <h3>✅ Admin Oversight</h3>
            <p>Municipal officers review flagged pickups and complaints.</p>
          </article>
        </div>
      </section>

      <section id="how-it-works" className="home-section home-section-alt">
        <h2>How It Works</h2>
        <ol className="home-steps">
          <li>Register and submit a pickup request with a photo.</li>
          <li>AI classifies the waste and schedules collection.</li>
          <li>A collector picks it up on their route.</li>
          <li>You earn rewards for responsible recycling.</li>
        </ol>
      </section>

      <footer className="public-footer">
        <p>© {new Date().getFullYear()} EcoCycle — SE3090 Group Project</p>
      </footer>
    </div>
  )
}
