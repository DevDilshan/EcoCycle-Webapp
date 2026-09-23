export default function AdminCard({ title, subtitle, children, className = '', actions }) {
  return (
    <section className={`admin-card ${className}`.trim()}>
      {(title || subtitle || actions) && (
        <div className="admin-card-header">
          <div>
            {title && <h2>{title}</h2>}
            {subtitle && <p className="admin-card-subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="admin-card-actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}
