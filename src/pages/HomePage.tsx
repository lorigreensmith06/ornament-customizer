import { Link } from 'react-router-dom'
import heroImg from '../assets/ornament_main_image.png'

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
              Explore Designs
            </Link>
          </div>
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
