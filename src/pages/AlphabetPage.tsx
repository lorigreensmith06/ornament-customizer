import { useEffect, useState } from 'react'
import { API } from '../DownloadPanel'
import AlphabetPreview from '../components/AlphabetPreview'

type AlphabetItem = {
  key: string       // preview file + garman_<key> job id suffix
  glyph: string     // shown on the grid tile
  name: string      // order/checkout label
}

// Customer-facing product names; job ids stay garman_*.
const LETTERS: AlphabetItem[] =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((L) => ({
    key: L.toLowerCase(), glyph: L,
    name: `Funky Versals — Letter ${L}`,
  }))

const AMPERSAND: AlphabetItem =
  { key: 'ampersand', glyph: '&', name: 'Funky Versals — Ampersand' }

const DECOR: AlphabetItem[] = [
  { key: 'decor_a', glyph: '❋', name: 'Funky Versals — Decorative A' },
  { key: 'decor_b', glyph: '❆', name: 'Funky Versals — Decorative B' },
]

/* Pre-designed Garman alphabet ornaments. Same two-panel layout as the
   snowflake customizer: scrollable controls sidebar, large 3D preview.
   No customization — the STL job already exists on the backend
   (garman_<key>). Both STL and printed purchases go through the shared
   cart so multiple letters/products can be bought in one checkout. */
export default function AlphabetPage({
  onAddToCart,
}: {
  onAddToCart: (
    jobId: string, name: string, previewUrl: string,
    product: 'stl' | 'printed') => void
}) {
  const [selected, setSelected] = useState<AlphabetItem>(LETTERS[0])
  const [dims, setDims] =
    useState<{ x: number; y: number; z: number } | null>(null)

  const jobId = `garman_${selected.key}`

  // Authoritative dims from the job record (master STL bounds), mm.
  useEffect(() => {
    setDims(null)
    fetch(`${API}/api/jobs/${jobId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.dims) setDims(j.dims) })
      .catch(() => {})
  }, [jobId])
  const previewUrl = `/models/alphabet/${selected.key}.glb`
  // Post-checkout /create preview loads via STLLoader — use the
  // backend's decimated preview endpoint (masters stay protected).
  const cartPreviewUrl = `${API}/api/jobs/${jobId}/preview`

  function tile(item: AlphabetItem) {
    return (
      <button
        key={item.key}
        type="button"
        className={
          `alphabet-tile${selected.key === item.key ? ' selected' : ''}`}
        aria-label={item.name}
        aria-pressed={selected.key === item.key}
        onClick={() => setSelected(item)}
      >
        {item.glyph}
      </button>
    )
  }

  return (
    <div className="app-main">
      <section className="controls">
        <h1>Alphabet ornaments</h1>

        <div className="control-section">
          <div className="section-heading">
            <span className="step-num">1</span>Choose a letter
          </div>
          <div className="alphabet-grid">
            {[...LETTERS, AMPERSAND].map(tile)}
          </div>
          <div className="alphabet-decor-title">Decorative pieces</div>
          <div className="alphabet-grid alphabet-grid-decor">
            {DECOR.map(tile)}
          </div>
        </div>

        <div className="control-section" id="alphabet-buy">
          <div className="section-heading">
            <span className="step-num">2</span>Purchase
          </div>
          <h2 className="alphabet-name">{selected.name}</h2>
          <p className="alphabet-desc">
            A pre-designed ornament, ready to print — no customization
            needed. Printed in metallic bronze PLA with free U.S.
            shipping. Add several letters to your cart and check out
            once.
          </p>
          {dims && (
            <p className="orn-dims">
              ≈ {Math.round(dims.x)} × {Math.round(dims.y)} ×{' '}
              {Math.round(dims.z)} mm&ensp;(
              {(dims.x / 25.4).toFixed(1)} × {(dims.y / 25.4).toFixed(1)} ×{' '}
              {(dims.z / 25.4).toFixed(1)} in)
            </p>
          )}
          <div className="alphabet-actions">
            <button type="button" className="btn"
              onClick={() =>
                onAddToCart(jobId, selected.name, cartPreviewUrl, 'stl')}>
              Add STL to Cart — $3
            </button>
            <button type="button" className="btn secondary"
              onClick={() =>
                onAddToCart(jobId, selected.name, cartPreviewUrl, 'printed')}>
              Printed Ornament — $15
            </button>
          </div>
        </div>
      </section>

      <section className="preview" data-clarity-mask="true">
        <AlphabetPreview file={previewUrl} />
        <p className="viewport-hint">Drag to rotate</p>
      </section>
    </div>
  )
}
