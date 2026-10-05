import { useEffect, useRef, useState } from 'react'

/**
 * Scroll-reveal and count-up helpers for the public pages.
 *
 * The design's `.eco-reveal` starts invisible and is shown by adding
 * `.is-visible`. That means a failure to observe would leave content permanently
 * hidden, so every path here falls back to visible: reduced-motion, a missing
 * IntersectionObserver, and server-side rendering all resolve immediately.
 */
function prefersReducedMotion() {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

function canObserve() {
  return typeof window !== 'undefined' && typeof IntersectionObserver !== 'undefined'
}

/**
 * Reveals an element the first time it scrolls into view.
 * Returns `[ref, visible]`; `visible` never returns to false, because
 * re-animating on the way back up makes scrolling feel jumpy.
 */
export function useEcoReveal({ threshold = 0.15, rootMargin = '0px 0px -10% 0px' } = {}) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(() => prefersReducedMotion() || !canObserve())

  useEffect(() => {
    if (visible) return
    const node = ref.current
    if (!node) {
      // Nothing to observe: show it rather than hide it forever.
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setVisible(true)
        observer.disconnect()
      },
      { threshold, rootMargin },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [visible, threshold, rootMargin])

  return [ref, visible]
}

/**
 * Props for a `.eco-reveal` element, with an optional stagger.
 * Spread onto the element: `<div {...ecoReveal(120)}>`.
 */
export function useEcoRevealProps(delay = 0, extraClass = '') {
  const [ref, visible] = useEcoReveal()
  const classes = ['eco-reveal', extraClass, visible ? 'is-visible' : '']
    .filter(Boolean)
    .join(' ')

  return {
    ref,
    className: classes,
    style: delay ? { '--eco-delay': `${delay}ms` } : undefined,
  }
}

/**
 * Counts a number up from zero once it scrolls into view.
 *
 * The design's figures are written as display strings ("12,500+", "8 yrs",
 * "340 t", "96%"), so this animates the digits and keeps whatever sits around
 * them. Under reduced motion it renders the final value straight away.
 */
export function useCountUp(display, { duration = 1400 } = {}) {
  const [ref, visible] = useEcoReveal({ threshold: 0.4 })
  const [value, setValue] = useState(null)

  // Read once: whether to animate cannot change mid-count, and reading it in
  // the initialiser keeps it out of the effect.
  const [animates] = useState(
    () => !prefersReducedMotion() && typeof requestAnimationFrame !== 'undefined',
  )

  const digits = String(display).replace(/[^\d]/g, '')
  const target = digits ? Number(digits) : null

  useEffect(() => {
    if (!visible || target === null || !animates) return

    let frame = 0
    const started = performance.now()

    // setValue is called from the animation frame callback, never synchronously
    // in the effect body, so this does not cascade renders.
    const step = (now) => {
      const progress = Math.max(0, Math.min(1, (now - started) / duration))
      // Ease-out so it decelerates into the final number.
      const eased = 1 - (1 - progress) ** 3
      setValue(Math.round(target * eased))
      if (progress < 1) frame = requestAnimationFrame(step)
    }

    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [visible, target, duration, animates])

  // The design's own string is the final value, so it is also the right thing
  // to show when not animating, before the count starts, or when there is no
  // number in it. Content is never blank or wrong.
  const text =
    !animates || target === null || value === null
      ? String(display)
      : String(display).replace(digits, value.toLocaleString())

  return [ref, text, visible]
}
