import { Link } from 'react-router-dom'

const designs = [
  {
    label: 'Two Branch',
    file: '/models/snowflake_two_pairs.stl',
    blurb: 'Classic six-armed snowflake with two pairs of branches.',
  },
  {
    label: 'Three Branch',
    file: '/models/snowflake_three_pairs.stl',
    blurb: 'A fuller silhouette with three pairs of branches.',
  },
  {
    label: 'Longer Branches',
    file: '/models/snowflake_longer_branches.stl',
    blurb: 'Elegant, elongated arms for a delicate look.',
  },
]

export default function ExplorePage() {
  return (
    <div className="page">
      <h1 className="page-title">Explore designs</h1>
      <p className="page-sub">
        Every ornament is personalized in 3D. Pick a silhouette to get
        started — add a name, choose a font, and watch it update live.
      </p>
      <div className="design-grid">
        {designs.map((design) => (
          <Link
            key={design.file}
            className="design-card"
            to={`/?design=${encodeURIComponent(design.file)}`}
          >
            <span className="design-thumb" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.4" strokeLinecap="round">
                <path d="M12 2v20M12 2l-2 3M12 2l2 3M12 22l-2-3M12 22l2-3" />
                <path d="M3.3 7l17.4 10M3.3 7l.9 3.5M3.3 7l3.5-.9M20.7 17l-.9-3.5M20.7 17l-3.5.9" />
                <path d="M20.7 7L3.3 17M20.7 7l-3.5-.9M20.7 7l-.9 3.5M3.3 17l3.5.9M3.3 17l.9-3.5" />
              </svg>
            </span>
            <span className="design-name">{design.label}</span>
            <span className="design-blurb">{design.blurb}</span>
            <span className="design-cta">Customize →</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
