/**
 * EcoCycle wordmark.
 *
 * The mark is a leaf held inside an open ring — growth inside a loop — rather
 * than the standard recycling triangle, which is a generic symbol every waste
 * company uses and belongs to no one. The ring is deliberately broken at the
 * top so it reads as a shape rather than a letter O, and the leaf's vein gives
 * it a second line so it still holds together at 20px.
 */
/**
 * The mark on its own, for places that supply their own tile: the icon inside
 * the auth cards and the admin console's sidebar.
 */
export function EcoMark({ size = 20 }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      role="presentation"
      focusable="false"
      aria-hidden="true"
    >
      {/* open ring */}
      <path
        d="M24.5 8.2a11 11 0 1 1-8.7-4.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      {/* leaf */}
      <path
        d="M22.4 9.6c0 5.6-3.9 9.4-9.6 9.4a11 11 0 0 1-2.3-.2c-.3-5.2 3.9-9.5 9.3-9.5a15 15 0 0 1 2.6.3Z"
        fill="currentColor"
      />
      {/* vein */}
      <path
        d="M10.6 21.4c1.9-3.3 4.8-6 8.3-7.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  )
}

export default function EcoLogo({ withText = true }) {
  return (
    <>
      <span className="eco-brand-mark" aria-hidden="true">
        <EcoMark size={20} />
      </span>

      {withText && (
        <span className="eco-brand-text">
          Eco<span className="eco-brand-text-alt">Cycle</span>
        </span>
      )}
    </>
  )
}
