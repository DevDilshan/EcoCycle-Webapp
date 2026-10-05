import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Award,
  Camera,
  Clock,
  Leaf,
  Mail,
  MapPin,
  Phone,
  Route,
  ScanSearch,
  Sparkles,
  Trash2,
  Truck,
  Users,
} from 'lucide-react'
import PublicNavbar from '../components/layout/PublicNavbar'
import EcoLogo from '../components/public/EcoLogo'
import ServiceAreasSection from '../components/public/ServiceAreasSection'
import { useCountUp, useEcoRevealProps } from '../hooks/useEcoReveal'
import '../styles/public.css'
import '../styles/landing.css'

import collectionTruck from '../assets/landing/collection-neighbourhood.webp'
import collectionTruckSmall from '../assets/landing/collection-neighbourhood-768.webp'
import collectionStep from '../assets/landing/collection-truck.webp'
import sortingTeam from '../assets/landing/sorting-team.webp'
import homeRecycling from '../assets/landing/home-recycling.webp'
import photoAiClassification from '../assets/landing/step-ai-classification.webp'
import photoPhoneRecycling from '../assets/landing/step-submit-landscape.webp'
import photoRouteMap from '../assets/landing/step-route-landscape.webp'
import sortingBins from '../assets/sorting-bins.jpg'

// TODO: placeholder figures from the design. Swap in real numbers before launch.
const IMPACT_STATS = [
  { icon: Users, value: '12,500+', label: 'Households served' },
  { icon: Clock, value: '8 yrs', label: 'Experience in waste services' },
  { icon: Trash2, value: '340 t', label: 'Waste recycled this year' },
  { icon: Sparkles, value: '96%', label: 'AI sorting accuracy' },
]

const COLLECTORS_ON_ROAD = '48'   // TODO: placeholder, as above

const FEATURE_POINTS = [
  {
    icon: Sparkles,
    title: 'AI waste classification',
    body:
      'Every photo is sorted in seconds, so the right truck and the right facility are chosen first time.',
  },
  {
    icon: MapPin,
    title: 'Smart route planning',
    body: 'Optimised daily routes by zone mean fewer trips, less fuel and faster pickups.',
  },
  {
    icon: Award,
    title: 'Rewards for recycling',
    body: 'Earn points whenever your waste is sorted correctly, and watch your impact grow.',
  },
]

/** One counting statistic. Needs its own component so each gets its own observer. */
function ImpactStat({ stat, delay }) {
  const [countRef, text] = useCountUp(stat.value)
  const reveal = useEcoRevealProps(delay)
  const Icon = stat.icon

  return (
    <div {...reveal} className={`eco-stat ${reveal.className}`}>
      <span className="eco-icon-tile">
        <Icon size={20} strokeWidth={2} aria-hidden="true" />
      </span>
      <div>
        <span className="eco-stat-num" ref={countRef}>{text}</span>
        <span className="eco-stat-label">{stat.label}</span>
      </div>
    </div>
  )
}

function Step({ index, icon: Icon, title, body, image, alt, imageStyle, illustration }) {
  const reveal = useEcoRevealProps(index * 110)

  return (
    <li {...reveal} className={`eco-pstep ${reveal.className}`}>
      <div className="eco-pstep-media">
        {illustration ?? <img src={image} alt={alt} style={imageStyle} loading="lazy" decoding="async" width="1200" height="800" />}
        <span className="eco-pstep-num">{index + 1}</span>
      </div>
      <div className="eco-pstep-body">
        <h3>
          <Icon size={20} strokeWidth={2} aria-hidden="true" />
          <span>{title}</span>
        </h3>
        <p>{body}</p>
      </div>
    </li>
  )
}

export default function HomePage() {
  const impactHead = useEcoRevealProps()
  const collage = useEcoRevealProps(0, 'eco-reveal-left')
  const whyCopy = useEcoRevealProps(120, 'eco-reveal-right')
  const areasHead = useEcoRevealProps()
  const areasMap = useEcoRevealProps()
  const cta = useEcoRevealProps()
  const [badgeRef, badgeText] = useCountUp(COLLECTORS_ON_ROAD)

  return (
    <div className="eco eco-landing">
      <a href="#main-content" className="eco-skip-link">Skip to content</a>
      <PublicNavbar />

      <main id="main-content">
        {/* ---------------------------------------------------------- hero */}
        <section className="eco-phero" id="top">
          <div className="eco-container eco-phero-inner">
            <div className="eco-phero-copy">
              <p className="eco-eyebrow eco-fade-up">
                <Leaf size={14} strokeWidth={2} aria-hidden="true" />
                <span>Smart waste &amp; recycling pickup</span>
              </p>

              <h1 className="eco-fade-up" style={{ '--eco-delay': '150ms' }}>
                Give your waste a <em>second life.</em>
              </h1>

              <p className="eco-hero-sub eco-fade-up" style={{ '--eco-delay': '450ms' }}>
                Snap a photo. Schedule a collection. Earn rewards for giving your
                recyclables a second life.
              </p>

              <div className="eco-hero-ctas eco-fade-up" style={{ '--eco-delay': '650ms' }}>
                <Link className="eco-btn eco-btn-primary eco-btn-lg" to="/register">
                  <span>Request a pickup</span>
                  <ArrowRight size={18} strokeWidth={2} aria-hidden="true" />
                </Link>
                <a className="eco-hero-link" href="#service-areas">
                  <MapPin size={17} strokeWidth={2} aria-hidden="true" />
                  <span>See where we collect</span>
                </a>
              </div>

            </div>
            <div className="eco-hero-photo eco-fade-up" style={{ '--eco-delay': '180ms' }}>
              <img src={collectionTruck} srcSet={`${collectionTruckSmall} 768w, ${collectionTruck} 1536w`} sizes="(max-width: 767px) calc(100vw - 44px), (max-width: 1328px) 45vw, 594px" alt="A resident hands sorted recycling to a collector on a leafy neighbourhood street" width="1536" height="1024" fetchPriority="high" />
            </div>
          </div>
          <svg className="eco-hero-curve" viewBox="0 0 1440 80" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0,30 C300,100 580,78 860,36 C1080,4 1270,12 1440,44 L1440,80 L0,80 Z" />
          </svg>
        </section>

        {/* -------------------------------------------------- how it works */}
        <section id="how" className="eco-pstep-wrap">
          <div className="eco-container">
            <div className="eco-how-heading">
              <h2 className="eco-h2">A little effort. A cleaner neighbourhood.</h2>
              <p className="eco-lead">From your first photo to a collection at your door.</p>
            </div>
            <ol className="eco-psteps">
              <Step
                index={0}
                icon={Camera}
                title="Submit"
                body="Snap a photo of your waste and pick a pickup time that suits you."
                image={photoPhoneRecycling}
                alt="A camera phone beside glass bottles, cardboard and a recycling bin"
                imageStyle={{ objectPosition: '50% 45%' }}
              />
              <Step
                index={1}
                icon={ScanSearch}
                title="AI classifies"
                body="Our model sorts it into recyclable, organic, e-waste or hazardous in seconds."
                image={photoAiClassification}
                alt="AI classification concept: a camera scanning glass, plastic and cardboard"
                imageStyle={{ objectPosition: '50% 50%' }}
              />
              <Step
                index={2}
                icon={Route}
                title="Routed"
                body="Your request joins the right collector for your area, automatically."
                image={photoRouteMap}
                alt="Green collection pins connected along a route on a paper map"
                imageStyle={{ objectPosition: '50% 50%' }}
              />
              <Step
                index={3}
                icon={Truck}
                title="Collected"
                body="A collector picks it up and you earn points for recycling right."
                image={collectionStep}
                alt="Collection workers loading sorted recyclables into a green truck"
                imageStyle={{ objectPosition: '50% 50%' }}
              />
            </ol>
          </div>
        </section>

        {/* ------------------------------------------------------ our impact */}
        <section className="eco-section eco-section-tight">
          <div className="eco-container">
            <div
              {...impactHead}
              className={`eco-section-head ${impactHead.className}`}
              style={{ ...impactHead.style, marginBottom: '40px' }}
            >
              <p className="eco-eyebrow"><span>Our impact</span></p>
              <h2 className="eco-h2">Trusted by neighbourhoods across the city</h2>
            </div>

            <div className="eco-stats">
              {IMPACT_STATS.map((stat, index) => (
                <ImpactStat key={stat.label} stat={stat} delay={index * 90} />
              ))}
            </div>
            <p className="eco-sample-note">Illustrative impact figures, shown for this project preview.</p>
          </div>
        </section>

        {/* ----------------------------------------------------- why EcoCycle */}
        <section id="features" className="eco-section eco-section-tight">
          <div className="eco-container eco-split">
            <div {...collage} className={`eco-collage ${collage.className}`}>
              <img
                className="eco-collage-main"
                src={sortingTeam}
                alt="Recycling team members separating bottles and cardboard at a sorting station"
                loading="lazy"
                decoding="async"
                width="640"
                height="720"
              />
              <img
                className="eco-collage-sub"
                src={sortingBins}
                alt="Colour-coded recycling bins"
                loading="lazy"
                decoding="async"
                width="320"
                height="380"
              />
              <div className="eco-collage-badge">
                <span ref={badgeRef}>{badgeText}</span>
                <div><small><span>collectors on the road every day</span></small><small>Illustrative figure</small></div>
              </div>
            </div>

            <div {...whyCopy} className={whyCopy.className}>
              <p className="eco-eyebrow"><span>Why EcoCycle</span></p>
              <h2 className="eco-h2 eco-h2-left">
                Built for residents, collectors and councils
              </h2>
              <p className="eco-lead">
                One platform that connects everyone in the waste collection loop, from the
                first photo to the recycling plant.
              </p>

              <ul className="eco-points">
                {FEATURE_POINTS.map(({ icon: Icon, title, body }) => (
                  <li key={title}>
                    <span className="eco-icon-tile">
                      <Icon size={20} strokeWidth={2} aria-hidden="true" />
                    </span>
                    <div>
                      <h3>{title}</h3>
                      <p>{body}</p>
                    </div>
                  </li>
                ))}
              </ul>

              <Link className="eco-btn eco-btn-primary eco-btn-lg" to="/register">
                <span>Join EcoCycle</span>
                <ArrowRight size={18} strokeWidth={2} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        {/* -------------------------------------------------- where we collect */}
        <section id="service-areas" className="eco-section eco-section-tight">
          <div className="eco-container">
            <div {...areasHead} className={`eco-section-head ${areasHead.className}`}>
              <p className="eco-eyebrow">
                <Truck size={14} strokeWidth={2} aria-hidden="true" />
                <span>Service areas</span>
              </p>
              <h2 className="eco-h2">Where we collect</h2>
              <p className="eco-lead">
                Find your neighbourhood and explore our collection areas.
              </p>
            </div>

            <div {...areasMap} className={areasMap.className}>
              <ServiceAreasSection />
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------- CTA band */}
        <section className="eco-section" style={{ paddingTop: '24px', paddingBottom: '72px' }}>
          <div className="eco-container">
            <div {...cta} className={`eco-pcta ${cta.className}`}>
              <div className="eco-pcta-media">
                <img src={homeRecycling} alt="A resident preparing a box of sorted bottles and paper at home" loading="lazy" decoding="async" width="1200" height="800" />
              </div>
              <div className="eco-pcta-content">
                <div className="eco-pcta-copy">
                  <p className="eco-pcta-eyebrow">
                    <Leaf size={14} strokeWidth={2} aria-hidden="true" />
                    <span>Free to join</span>
                  </p>
                  <h2>Your first pickup is a photo away</h2>
                  <p>Set up an account in under a minute, then just point and shoot.</p>
                </div>
                <div className="eco-pcta-actions">
                  <Link className="eco-btn eco-btn-secondary eco-btn-lg" to="/register">
                    <span>Create free account</span>
                    <ArrowRight size={18} strokeWidth={2} aria-hidden="true" />
                  </Link>
                  <Link className="eco-pcta-link" to="/login">I already have one</Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* --------------------------------------------------------- footer */}
      <footer id="footer" className="eco-footer">
        <div className="eco-container">
          <div className="eco-footer-grid">
            <div>
              <a href="#top" className="eco-brand">
                <EcoLogo />
              </a>
              <p>
                Smart waste and recycling pickup for cleaner, greener neighbourhoods.
              </p>
            </div>

            <div>
              <h4><span>Product</span></h4>
              <ul>
                <li><a href="#how">How it works</a></li>
                <li><a href="#features">Features</a></li>
                <li><a href="#service-areas">Where we collect</a></li>
              </ul>
            </div>

            <div>
              <h4><span>Account</span></h4>
              <ul>
                <li><Link to="/login">Log in</Link></li>
                <li><Link to="/register">Register</Link></li>
                <li><a href="#footer">Support</a></li>
              </ul>
            </div>

            <div>
              <h4><span>Contact</span></h4>
              <ul className="eco-footer-contact">
                <li>
                  <Phone size={16} strokeWidth={2} aria-hidden="true" />
                  <span>+94 11 234 5678</span>
                </li>
                <li>
                  <Mail size={16} strokeWidth={2} aria-hidden="true" />
                  <span>hello@ecocycle.lk</span>
                </li>
                <li>
                  <MapPin size={16} strokeWidth={2} aria-hidden="true" />
                  <span>Colombo, Sri Lanka</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="eco-footer-bottom">
            <span>© {new Date().getFullYear()} EcoCycle</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
