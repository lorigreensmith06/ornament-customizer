import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import heroImg from '../assets/ornament_main_image.png'
import { galleryPhotos } from '../data/gallery'
import { ornamentDesigns } from '../data/designs'
import AlphabetPreview from '../components/AlphabetPreview'
import ModelThumb, { LazyView } from '../components/ModelThumb'

const features = [
  {
    title: 'Personalize',
    text: 'Add a name or message and choose your design.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    ),
  },
  {
    title: 'Choose Your Option',
    text: 'Download the STL for $3 or have it 3D printed for $15 (shipping included).',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true">
        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
        <path d="m3.3 7 8.7 5 8.7-5" />
        <path d="M12 22V12" />
      </svg>
    ),
  },
  {
    title: 'Enjoy or Gift',
    text: 'A beautiful, personalized ornament for your tree or a thoughtful gift.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true">
        <rect x="3" y="8" width="18" height="4" rx="1" />
        <path d="M12 8v13" />
        <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
        <path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5" />
      </svg>
    ),
  },
]

export default function HomePage() {
  const galleryTrack = useRef<HTMLDivElement>(null)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(galleryPhotos.length <= 1)
  const [autoAdvance, setAutoAdvance] = useState(
    () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  const updateGalleryControls = useCallback(() => {
    const track = galleryTrack.current
    if (!track) return
    setAtStart(track.scrollLeft <= 1)
    setAtEnd(track.scrollWidth - track.clientWidth - track.scrollLeft <= 1)
  }, [])

  useEffect(() => {
    const track = galleryTrack.current
    if (!track) return
    const observer = new ResizeObserver(updateGalleryControls)
    observer.observe(track)
    return () => observer.disconnect()
  }, [updateGalleryControls])

  const moveGallery = useCallback((direction: -1 | 1, wrap = false) => {
    const track = galleryTrack.current
    const first = track?.children[0]
    const second = track?.children[1]
    if (!track || !first || !second) return
    if (wrap && track.scrollWidth - track.clientWidth - track.scrollLeft <= 1) {
      track.scrollTo({ left: 0 })
      return
    }
    const step = second.getBoundingClientRect().left - first.getBoundingClientRect().left
    track.scrollBy({ left: step * direction })
  }, [])

  useEffect(() => {
    if (!autoAdvance) return
    const timer = window.setInterval(() => {
      const track = galleryTrack.current
      if (!track || document.hidden || track.matches(':focus-within')) return
      if (window.matchMedia('(hover: hover)').matches && track.matches(':hover')) return
      const bounds = track.getBoundingClientRect()
      if (bounds.bottom <= 0 || bounds.top >= window.innerHeight) return
      moveGallery(1, true)
    }, 5000)
    return () => window.clearInterval(timer)
  }, [autoAdvance, moveGallery])

  return (
    <div className="home">
      <section className="hero">
        <img
          className="hero-img"
          src={heroImg}
          alt="Personalized gold snowflake ornament reading THE SMITHS, hanging on a lit Christmas tree"
        />
        <div className="hero-content">
          <h1 className="hero-title">Make Christmas Personal</h1>
          <p className="hero-lead">
            Create a one-of-a-kind ornament with your name or a special
            message.
          </p>
          <p className="hero-sub">
            Design it yourself, then download the STL or have it printed
            and delivered.
          </p>
          <div className="hero-actions">
            <Link className="hero-cta" to="/create">
              Create Your Ornament →
            </Link>
            <Link className="hero-cta-outline" to="/explore">
              Shop Ornaments
            </Link>
          </div>
        </div>
      </section>

      <section className="designs-feature" aria-label="Snowflake designs">
        <h2 className="collection-heading">Personalized Snowflakes</h2>
        <p className="collection-sub">
          Pick a snowflake base, add a name, and make it yours.
        </p>
        <div className="design-grid">
          {ornamentDesigns
            .map((design) => (
              <Link
                key={design.file}
                className="design-card"
                to={`/create?design=${encodeURIComponent(design.file)}`}
              >
                <LazyView className="design-thumb-3d">
                  <ModelThumb file={design.file}
                    flipNormals={design.flipNormals} />
                </LazyView>
                <span className="design-name">{design.label}</span>
                <span className="design-blurb">{design.blurb}</span>
                <span className="design-cta">Customize →</span>
              </Link>
            ))}
        </div>
      </section>

      <section className="collection-feature">
        <div className="collection-feature-text">
          <p className="collection-kicker">New collection</p>
          <h2 className="collection-title">Introducing Funky Versals</h2>
          <p className="collection-desc">
            Ornate alphabet ornaments, sculpted and ready to print —
            letters A–Z plus decorative pieces. Download the STL for $3
            or have it printed in metallic bronze PLA for $15, with free
            U.S. shipping.
          </p>
          <Link className="hero-cta" to="/alphabet">
            Shop Alphabet Ornaments →
          </Link>
        </div>
        <LazyView className="collection-feature-preview">
          <AlphabetPreview
            file="/models/alphabet/a.glb"
            zoom={1.1}
          />
        </LazyView>
      </section>

      <section className="gallery" aria-label="Customer ornaments">
        <div className="gallery-inner">
        <h2 className="gallery-title">From Design to Reality</h2>
        <p className="gallery-sub">
          Real 3D-printed ornaments, created with Ornament Creator.
        </p>
        <div
          className="gallery-track"
          id="printed-ornament-photos"
          role="group"
          aria-label="Printed ornament photos"
          tabIndex={0}
          onScroll={updateGalleryControls}
          ref={galleryTrack}
        >
          {galleryPhotos.map((photo) => {
            const img = (
              <img src={photo.image} alt={photo.alt} loading="lazy" />
            )
            return (
              <figure className="gallery-item" key={photo.image}>
                {photo.link ? (
                  <a className="gallery-link" href={photo.link}>{img}</a>
                ) : (
                  img
                )}
                {photo.caption && (
                  <figcaption>{photo.caption}</figcaption>
                )}
              </figure>
            )
          })}
        </div>
        <div className="gallery-controls">
          <button type="button" aria-label="Previous ornament photo"
            aria-controls="printed-ornament-photos" disabled={atStart}
            onClick={() => moveGallery(-1)}>
            <span aria-hidden="true">←</span>
          </button>
          <button type="button" aria-label="Next ornament photo"
            aria-controls="printed-ornament-photos" disabled={atEnd}
            onClick={() => moveGallery(1)}>
            <span aria-hidden="true">→</span>
          </button>
          <button type="button" className="gallery-autoplay"
            aria-label={autoAdvance ? 'Pause automatic scrolling' : 'Start automatic scrolling'}
            aria-controls="printed-ornament-photos"
            onClick={() => setAutoAdvance((enabled) => !enabled)}>
            {autoAdvance ? 'Pause' : 'Auto-scroll'}
          </button>
        </div>
        <Link className="hero-cta" to="/create">
          Create Your Own Ornament →
        </Link>
        </div>
      </section>

      <section className="features" aria-label="How it works">
        {features.map((f) => (
          <div className="feature" key={f.title}>
            <span className="feature-icon">{f.icon}</span>
            <h2 className="feature-title">{f.title}</h2>
            <p className="feature-text">{f.text}</p>
          </div>
        ))}
      </section>
    </div>
  )
}
