import { lazy, Suspense, useEffect, useRef, useState } from 'react'

const ServiceAreasMap = lazy(() => import('./ServiceAreasMap'))

export default function ServiceAreasSection() {
  const ref = useRef(null)
  const [nearby, setNearby] = useState(false)

  useEffect(() => {
    if (!('IntersectionObserver' in window)) {
      // Use an asynchronous callback to keep the fallback consistent with observation.
      const frame = requestAnimationFrame(() => setNearby(true))
      return () => cancelAnimationFrame(frame)
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      setNearby(true)
      observer.disconnect()
    }, { rootMargin: '800px' })
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  const placeholder = <div className="eco-areas-map eco-areas-map-loading" role="status"><span>Preparing the collection map…</span></div>
  return <div ref={ref}>{nearby ? <Suspense fallback={placeholder}><ServiceAreasMap /></Suspense> : placeholder}</div>
}
