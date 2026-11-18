import { Link } from 'react-router-dom'
import ModelThumb, { LazyView } from '../components/ModelThumb'
import { ornamentDesigns } from '../data/designs'

export default function ExplorePage() {
  return (
    <div className="page">
      <h1 className="page-title">Shop Ornaments</h1>
      <p className="page-sub">
        Two collections to browse — personalize a snowflake with your
        own name, or pick a ready-made letter from Funky Versals.
      </p>

      <h2 className="collection-heading">Personalized Snowflake Ornaments</h2>
      <p className="collection-sub">
        Customize your own ornament — add a name, choose a font, and
        watch the 3D preview update live.
      </p>
      <div className="design-grid">
        {ornamentDesigns.map((design) => (
          <Link
            key={design.file}
            className="design-card"
            to={`/create?design=${encodeURIComponent(design.file)}`}
          >
            <LazyView className="design-thumb design-thumb-3d">
              <ModelThumb file={design.file} />
            </LazyView>
            <span className="design-name">{design.label}</span>
            <span className="design-blurb">{design.blurb}</span>
            <span className="design-cta">Customize a Snowflake →</span>
          </Link>
        ))}
      </div>

      <h2 className="collection-heading">Funky Versals Alphabet Ornaments</h2>
      <p className="collection-sub">
        Ornate pre-designed letters A–Z, an ampersand, and decorative
        pieces — $3 STL download or $15 printed ornament.
      </p>
      <div className="design-grid">
        <Link className="design-card" to="/alphabet">
          <LazyView className="design-thumb design-thumb-3d">
            <ModelThumb file="/models/alphabet/a.glb" />
          </LazyView>
          <span className="design-name">Funky Versals — Letters &amp; Decor</span>
          <span className="design-blurb">
            Sculpted alphabet ornaments, ready to print — no
            customization needed.
          </span>
          <span className="design-cta">Browse Funky Versals →</span>
        </Link>
      </div>
    </div>
  )
}
