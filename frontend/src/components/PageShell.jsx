export default function PageShell({ title, description }) {
  return (
    <div className="page-shell">
      <h1>{title}</h1>
      {description && <p className="page-shell-desc">{description}</p>}
    </div>
  )
}
