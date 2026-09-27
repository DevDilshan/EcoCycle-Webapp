import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Award,
  Camera,
  CheckCheck,
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
import ServiceAreasMap from '../components/public/ServiceAreasMap'
import { useCountUp, useEcoRevealProps } from '../hooks/useEcoReveal'
import '../styles/public.css'

// TODO: replace all three of these before launch.
//   seedling-in-hand.jpg  - carries a dreamstime stock watermark
//   e-waste-bin.jpg       - shows another company's branding (Recycling Hub)
//   collection-truck.jpg  - shows Waste Management's "Think Green" branding
import collectionTruck from '../assets/collection-truck.jpg'
import stepClassify from '../assets/step-classify.jpg'
import stepRouted from '../assets/step-routed.jpg'
import stepSubmit from '../assets/step-submit.jpg'
import eWasteBin from '../assets/e-waste-bin.jpg'
import seedlingInHand from '../assets/seedling-in-hand.jpg'
import sortingBins from '../assets/sorting-bins.jpg'

// TODO: placeholder figures from the design. Swap in real numbers before launch.
const IMPACT_STATS = [
  { icon: Users, value: '12,500+', label: 'Households served' },
  { icon: Clock, value: '8 yrs', label: 'Experience in waste services' },
  { icon: Trash2, value: '340 t', label: 'Waste recycled this year' },
  { icon: Sparkles, value: '96%', label: 'AI sorting accuracy' },
]

const COLLECTORS_ON_ROAD = '48'   // TODO: placeholder, as above

const HERO_NOTES = ['Free for residents', 'Pickups within 48 hours', 'Earn reward points']

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
        {illustration ?? <img src={image} alt={alt} style={imageStyle} />}
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
    <div className="eco">
      <PublicNavbar />

      <main>
        {/* ---------------------------------------------------------- hero */}
        <section className="eco-phero" id="top">
          <img className="eco-phero-img" src={seedlingInHand} alt="" />

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
                Snap a photo. We sort it, route it, and collect it.
              </p>

              <div className="eco-hero-ctas eco-fade-up" style={{ '--eco-delay': '650ms' }}>
                <Link className="eco-btn eco-btn-primary eco-btn-lg" to="/register">
                  <span>Request a pickup</span>
                  <ArrowRight size={18} strokeWidth={2} aria-hidden="true" />
                </Link>
                <a className="eco-btn eco-btn-outline-light eco-btn-lg" href="#service-areas">
                  <MapPin size={18} strokeWidth={2} aria-hidden="true" />
                  <span>See where we collect</span>
                </a>
              </div>

              <ul className="eco-hero-note eco-fade-up" style={{ '--eco-delay': '850ms' }}>
                {HERO_NOTES.map((note) => (
                  <li key={note}>
                    <CheckCheck size={16} strokeWidth={2} aria-hidden="true" />
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <svg className="eco-wave" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0,64 C240,120 480,120 720,80 C960,40 1200,20 1440,56 L1440,120 L0,120 Z" />
          </svg>
        </section>

        {/* -------------------------------------------------- how it works */}
        <section id="how" className="eco-pstep-wrap">
          <div className="eco-container">
            <ol className="eco-psteps">
              <Step
                index={0}
                icon={Camera}
                title="Submit"
                body="Snap a photo of your waste and pick a pickup time that suits you."
                image={stepSubmit}
                alt="Recycling symbol formed from plastic bottles and packaging"
                imageStyle={{ objectPosition: '50% 50%' }}
              />
              <Step
                index={1}
                icon={ScanSearch}
                title="AI classifies"
                body="Our model sorts it into recyclable, organic, e-waste or hazardous in seconds."
                image={stepClassify}
                alt="A discarded phone with a seedling growing through it"
                imageStyle={{ objectPosition: '50% 45%' }}
              />
              <Step
                index={2}
                icon={Route}
                title="Routed"
                body="Your request joins the right collector for your area, automatically."
                image={stepRouted}
                alt="A city map with collection stops pinned along a route"
                imageStyle={{ objectPosition: '50% 50%' }}
              />
              <Step
                index={3}
                icon={Truck}
                title="Collected"
                body="A collector picks it up and you earn points for recycling right."
                image={collectionTruck}
                alt="A green collection truck being loaded at the kerb"
                imageStyle={{ objectPosition: '30% 50%' }}
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
          </div>
        </section>

        {/* ----------------------------------------------------- why EcoCycle */}
        <section id="features" className="eco-section eco-section-tight">
          <div className="eco-container eco-split">
            <div {...collage} className={`eco-collage ${collage.className}`}>
              <img
                className="eco-collage-main"
                src={collectionTruck}
                alt="A collector loading a green bin into a truck"
              />
              <img
                className="eco-collage-sub"
                src={sortingBins}
                alt="Colour-coded recycling bins"
              />
              <div className="eco-collage-badge">
                <span ref={badgeRef}>{badgeText}</span>
                <div><small><span>collectors on the road every day</span></small></div>
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
                EcoCycle trucks are on the road in these neighbourhoods. Tap a truck to see
                the area.
              </p>
            </div>

            <div {...areasMap} className={areasMap.className}>
              <ServiceAreasMap />
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------- CTA band */}
        <section className="eco-section" style={{ paddingTop: '24px', paddingBottom: '72px' }}>
          <div className="eco-container">
            <div {...cta} className={`eco-pcta ${cta.className}`}>
              <img src={eWasteBin} alt="" />
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
        </section>
      </main>

      {/* --------------------------------------------------------- footer */}
      <svg className="eco-footer-wave" viewBox="0 0 1440 90" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0,40 C320,90 640,0 960,30 C1180,52 1320,40 1440,20 L1440,90 L0,90 Z" />
      </svg>

      <footer id="footer" className="eco-footer eco-footer-dark">
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
