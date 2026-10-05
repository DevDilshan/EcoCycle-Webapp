import mark from './eco-mark-paths.json'

/** Shared leaf-and-cycle vectors inherit the surrounding tile's ink color. */
export function EcoMark({ size = 20 }) {
  return (
    <svg
      viewBox={mark.viewBox}
      width={size}
      height={size}
      role="presentation"
      focusable="false"
      aria-hidden="true"
    >
      {mark.paths.map((path, index) => (
        <path key={index} d={path.d} transform={path.transform} fill="currentColor" />
      ))}
    </svg>
  )
}

export default function EcoLogo({ withText = true }) {
  return (
    <>
      <span className="eco-brand-mark" aria-hidden="true">
        <EcoMark size={26} />
      </span>

      {withText && (
        <span className="eco-brand-text">
          Eco<span className="eco-brand-text-alt">Cycle</span>
        </span>
      )}
    </>
  )
}
