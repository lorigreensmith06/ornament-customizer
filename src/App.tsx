import { Component, Fragment, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Canvas, useLoader } from '@react-three/fiber'
import { OrbitControls, RoundedBox } from '@react-three/drei'
import { Vector3 } from 'three'
import { ACESFilmicToneMapping, Plane } from 'three'
import type { BufferGeometry } from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useRouteMeta } from './seo'
import FreeStlOffer from './components/FreeStlOffer'
import AnnouncementBar from './components/AnnouncementBar'
import './App.css'
import DownloadPanel, { API } from './DownloadPanel'
import CartPanel, { type CartItem } from './CartPanel'
import Header from './components/Header'
import { recordOrder } from './orders'
import AboutPage from './pages/AboutPage'
import ExplorePage from './pages/ExplorePage'
import AlphabetPage from './pages/AlphabetPage'
import HomePage from './pages/HomePage'
import OrdersPage from './pages/OrdersPage'
import PrivacyPage from './pages/PrivacyPage'
import ReturnsPage from './pages/ReturnsPage'
import TermsPage from './pages/TermsPage'
import Footer from './components/Footer'
import CookieConsent from './components/CookieConsent'
import { initAnalytics, trackPageView } from './analytics'

const designs = [
  {
    label: 'Two Branch',
    id: 'two_pairs',
    file: '/models/snowflake_two_pairs.stl',
  },
  {
    label: 'Three Branch',
    id: 'three_pairs',
    file: '/models/snowflake_three_pairs.stl',
  },
  {
    label: 'Longer Branches',
    id: 'longer_branches',
    file: '/models/snowflake_longer_branches.stl',
  },
]

const outerDecorations = [
  { label: 'None', value: 'none' },
  { label: 'Diamonds', value: 'diamonds' },
  { label: 'Gems', value: 'hexagons' },
  { label: 'Beads', value: 'spheres' },
]

const innerDecorations = [
  { label: 'None', value: 'none' },
  { label: 'Gems', value: 'hexagons' },
  { label: 'Beads', value: 'spheres' },
]

// Decoration preview STLs share the base snowflake's mm coordinate
// frame; 'none' resolves to no extra layer. Inner decorations are
// style-specific, outer are shared across styles.
function decorationFiles(designId: string, outer: string, inner: string) {
  const files: string[] = []
  if (outer !== 'none') files.push(`/models/snowflake_outer_${outer}.stl`)
  if (inner !== 'none') files.push(`/models/snowflake_inner_${designId}_${inner}.stl`)
  return files
}

const fonts = [
  {
    label: 'Lato Bold',
    value: 'lato',
  },
  {
    label: 'DejaVu Sans Bold',
    value: 'dejavu',
  },
  {
    label: 'Caladea Bold',
    value: 'caladea',
  },
]

// Font URL mapping for Three.js preview
// Millimeters of cap height per unit of Name Size in the Houdini HDA.
// Anchored on generated STLs: Lato/DejaVu match at 8.00; Caladea's
// JSON metrics run ~3% narrow vs the installed TTF (rail_w 63.05 vs
// preview 61.26 at size 1), so it gets its own factor.
const MM_PER_SIZE: Record<string, number> = {
  lato: 8.00,
  dejavu: 8.00,
  caladea: 8.23,
  // Legacy IDs inherit their replacement font's factor.
  arial: 8.00,
  cambria: 8.23,
  montserrat: 8.00,
}
// Rail thickness as a fraction of the rendered text height,
// matching the HDA's transform6/transform7 sy = 0.2 on the text bbox.
const RAIL_HEIGHT_FRACTION = 0.2

// Measured in the Houdini output: the whole assembly is clipped at
// the back plane (z = 0), so the centered ±0.05-unit text extrusion
// ends up 5.55 mm deep with its back flush against the ornament.
const TEXT_DEPTH_MM = 5.5547
// Rails: transform_trim_and_embed_support_bars sz = 0.5, clipped the
// same way — 0..2.777 mm, back flush.
const RAIL_DEPTH_MM = 2.7774

// Z position that puts a centered-depth box/extrusion's back face
// essentially flush with the ornament's back surface. The tiny inset
// avoids coplanar z-fighting with the ornament's own back plane.
const flushBackZ = (opening: Opening, depth: number) =>
  opening.z - opening.depth / 2 + depth / 2 - 0.02
const fontUrls: Record<string, string> = {
  lato: '/fonts/Lato_Bold.json',
  dejavu: '/fonts/DejaVuSans_Bold.json',
  caladea: '/fonts/Caladea_Bold.json',
  // Legacy IDs from saved carts resolve to the same fonts the
  // backend generates for them.
  arial: '/fonts/DejaVuSans_Bold.json',
  cambria: '/fonts/Caladea_Bold.json',
  montserrat: '/fonts/Lato_Bold.json',
}

// All dimensions below use the STL's original coordinates, before display scale.
// A model may already contain a horizontal opening crossing Y = 0
// (measured), or be a complete snowflake (opening synthesized).
function measureOpening(geometry: BufferGeometry) {
  geometry.computeBoundingBox()

  const bounds = geometry.boundingBox!
  const center = bounds.getCenter(new Vector3())
  const positions = geometry.getAttribute('position')

  let bottom = -Infinity
  let top = Infinity

  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i)

    if (y < 0) {
      bottom = Math.max(bottom, y)
    } else {
      top = Math.min(top, y)
    }
  }

  // A triangle crossing Y = 0 means the snowflake is solid.
  const indices = geometry.index
  const count = indices ? indices.count : positions.count

  let solid = false

  for (let i = 0; i < count; i += 3) {
    const ys = [0, 1, 2].map((offset) =>
      positions.getY(
        indices ? indices.getX(i + offset) : i + offset,
      ),
    )

    if (Math.min(...ys) < 0 && Math.max(...ys) > 0) {
      solid = true
      break
    }
  }

  const height = bounds.max.y - bounds.min.y
  const depth = bounds.max.z - bounds.min.z

  if (depth <= 0) {
    throw new Error('The STL has no depth.')
  }

  let gap = top - bottom
  let left = Infinity
  let right = -Infinity
  let y = 0

  if (solid || !Number.isFinite(gap) || gap <= height * 0.001) {
    // Complete snowflake: synthesize the opening at the centerline,
    // matching the proportions of the previous opening.
    gap = height * 0.1215
    bottom = -gap / 2
    top = gap / 2
    const cut = (bounds.max.x - bounds.min.x) * 0.7363
    left = center.x - cut / 2
    right = center.x + cut / 2
  } else {
    const tolerance = Math.max(gap * 0.0001, 0.00001)

    for (let i = 0; i < positions.count; i++) {
      const py = positions.getY(i)

      if (
        Math.abs(py - top) < tolerance ||
        Math.abs(py - bottom) < tolerance
      ) {
        left = Math.min(left, positions.getX(i))
        right = Math.max(right, positions.getX(i))
      }
    }

    if (!Number.isFinite(left) || right <= left) {
      throw new Error(
        'Could not measure the cut edges of this model.',
      )
    }

    y = (top + bottom) / 2
  }

  const barHeight = gap * 0.123

  return {
    center,
    top,
    bottom,
    gap,
    barHeight,
    ornamentWidth: bounds.max.x - bounds.min.x,
    width: right - left + barHeight,
    textWidth: right - left - barHeight,
    textHeight: gap - barHeight + gap * 0.025,
    x: (left + right) / 2,
    y,
    z: (bounds.min.z + bounds.max.z) / 2,
    depth,
  }
}

type Opening = ReturnType<typeof measureOpening>

function GoldMaterial() {
  return (
    <meshStandardMaterial
      color="#c6a15b"
      metalness={0.7}
      roughness={0.4}
    />
  )
}

function NameAndRails({
  name,
  opening,
  textSize,
  selectedFont,
  onLayout,
}: {
  name: string
  opening: Opening
  textSize: number
  selectedFont: string
  onLayout?: (
    railWidth: number,
    railTop: number,
    railBottom: number,
    barHeight: number,
  ) => void
}) {
  // Use the selected font for preview
  const font = useLoader(FontLoader, fontUrls[selectedFont] || fontUrls.lato)

  const { geometry, railWidth, railTop, railBottom, barHeight } = useMemo(() => {
    const text = name.trim()

    // Houdini's rule: rails are at least 75% of the snowflake width.
    const minimumRailWidth = opening.ornamentWidth * 0.75

    if (!text) {
      return {
        geometry: null,
        railWidth: minimumRailWidth,
        railTop: opening.top,
        railBottom: opening.bottom,
        barHeight: opening.barHeight,
      }
    }

    const result = new TextGeometry(text, {
      font,
      size: 1,
      depth: TEXT_DEPTH_MM,
      curveSegments: 12,
      bevelEnabled: false,
    })

    result.computeBoundingBox()

    const size = result.boundingBox!.getSize(new Vector3())

    if (size.x <= 0 || size.y <= 0) {
      result.dispose()

      return {
        geometry: null,
        railWidth: minimumRailWidth,
        railTop: opening.top,
        railBottom: opening.bottom,
        barHeight: opening.barHeight,
      }
    }

    // Absolute scale in millimeters matching the HDA's font_size,
    // so each font keeps its natural cap-height/em ratio.
    const finalScale = textSize * (MM_PER_SIZE[selectedFont] ?? 8.00)

    result.scale(finalScale, finalScale, 1)

    // Measure actual dimensions after scaling.
    result.computeBoundingBox()

    const textSizeScaled = result.boundingBox!.getSize(new Vector3())
    const textWidth = textSizeScaled.x
    const textHeight = textSizeScaled.y

    // HDA rule: rail thickness = 0.2 x rendered text bbox height.
    const barHeight = textHeight * RAIL_HEIGHT_FRACTION

    // Small overlap so letter tops/bottoms visibly intersect the rails,
    // matching the generated STL where text and rails are boole'd
    // together. At textSize = 1 this keeps rails near opening.top/bottom.
    const verticalPadding = barHeight / 4

    const railWidth = Math.max(minimumRailWidth, textWidth)

    // Rails follow the capital-letter band (baseline to cap height,
    // measured from an "H" in the same font), not the whole string's
    // bounds: a descender such as Q's tail would otherwise push the
    // bottom rail away from every other letter.
    const capProbe = new TextGeometry('H', {
      font,
      size: 1,
      depth: 1,
      curveSegments: 1,
      bevelEnabled: false,
    })

    capProbe.computeBoundingBox()

    const capBottom = capProbe.boundingBox!.min.y * finalScale
    const capTop = capProbe.boundingBox!.max.y * finalScale

    capProbe.dispose()

    const hasCapBand = capTop > capBottom
    const bandBottom = hasCapBand ? capBottom : result.boundingBox!.min.y
    const bandTop = hasCapBand ? capTop : result.boundingBox!.max.y
    const bandHeight = bandTop - bandBottom

    const railTop = opening.y + bandHeight / 2 + verticalPadding
    const railBottom = opening.y - bandHeight / 2 - verticalPadding

    // Center horizontally and in depth on the text's own bounds, and
    // vertically on the capital band the rails were placed from.
    const boundsCenter = result.boundingBox!.getCenter(new Vector3())

    result.translate(
      -boundsCenter.x,
      -(bandTop + bandBottom) / 2,
      -boundsCenter.z,
    )

    return {
      geometry: result,
      railWidth,
      railTop,
      railBottom,
      barHeight,
    }
  }, [font, name, opening, textSize, selectedFont])

  useEffect(() => {
    return () => {
      geometry?.dispose()
    }
  }, [geometry])

  // Report the rail footprint so the ornament can report its overall size.
  useEffect(() => {
    onLayout?.(railWidth, railTop, railBottom, barHeight)
  }, [railWidth, railTop, railBottom, barHeight, onLayout])

  return (
    <group>
      {geometry && (
        <>
          <RoundedBox
            args={[railWidth, barHeight, RAIL_DEPTH_MM]}
            radius={barHeight / 4}
            smoothness={8}
            position={[opening.x, railTop, flushBackZ(opening, RAIL_DEPTH_MM)]}
          >
            <GoldMaterial />
          </RoundedBox>

          <RoundedBox
            args={[railWidth, barHeight, RAIL_DEPTH_MM]}
            radius={barHeight / 4}
            smoothness={8}
            position={[opening.x, railBottom, flushBackZ(opening, RAIL_DEPTH_MM)]}
          >
            <GoldMaterial />
          </RoundedBox>
        </>
      )}

      {geometry && (
        <mesh
          geometry={geometry}
          position={[
            opening.x,
            opening.y,
            // Text extrudes forward from the ornament's back plane
            // (z = 0); the centered geometry starts at back + depth/2.
            opening.z - opening.depth / 2 + TEXT_DEPTH_MM / 2,
          ]}
        >
          <GoldMaterial />
        </mesh>
      )}
    </group>
  )
}

function Ornament({
  file,
  decorFiles,
  name,
  showName,
  textSize,
  selectedFont,
  onSize,
}: {
  file: string
  decorFiles: string[]
  name: string
  showName: boolean
  textSize: number
  selectedFont: string
  onSize?: (size: { x: number; y: number; z: number }) => void
}) {
  const sources = useLoader(STLLoader, [file, ...decorFiles])
  const source = sources[0]

  const [railDims, setRailDims] = useState<{
    width: number
    top: number
    bottom: number
    bar: number
  } | null>(null)

  // Same-value guard keeps the child -> parent report loop-free.
  const handleLayout = useCallback(
    (width: number, top: number, bottom: number, bar: number) => {
      setRailDims((prev) =>
        prev &&
        prev.width === width &&
        prev.top === top &&
        prev.bottom === bottom &&
        prev.bar === bar
          ? prev
          : { width, top, bottom, bar },
      )
    },
    [],
  )

  const { geometry, decorGeometries, opening } = useMemo(() => {
    // Do not center or otherwise mutate useLoader's cached STL.
    const opening = measureOpening(source)

    // Smooth normals across shallow angles; keep edges >= 60 deg hard.
    const geometry = toCreasedNormals(source.clone(), Math.PI / 3)

    geometry.computeBoundingBox()

    const decorGeometries = sources.slice(1).map((decor) => {
      const g = toCreasedNormals(decor.clone(), Math.PI / 3)
      g.computeBoundingBox()
      return g
    })

    return {
      geometry,
      decorGeometries,
      opening,
    }
  }, [sources, source])

  // STL coordinates are millimeters; union the snowflake bbox with the
  // rail boxes for the approximate finished size.
  useEffect(() => {
    if (!onSize) return
    const bounds = geometry.boundingBox!
    let minX = bounds.min.x
    let maxX = bounds.max.x
    let minY = bounds.min.y
    let maxY = bounds.max.y

    for (const decor of decorGeometries) {
      const b = decor.boundingBox!
      minX = Math.min(minX, b.min.x)
      maxX = Math.max(maxX, b.max.x)
      minY = Math.min(minY, b.min.y)
      maxY = Math.max(maxY, b.max.y)
    }

    if (showName && railDims) {
      const halfWidth = railDims.width / 2
      const halfBar = opening.barHeight / 2
      minX = Math.min(minX, opening.x - halfWidth)
      maxX = Math.max(maxX, opening.x + halfWidth)
      minY = Math.min(minY, railDims.bottom - halfBar)
      maxY = Math.max(maxY, railDims.top + halfBar)
    }

    onSize({
      x: maxX - minX,
      y: maxY - minY,
      z: bounds.max.z - bounds.min.z,
    })
  }, [geometry, decorGeometries, opening, showName, railDims, onSize])

  useEffect(() => {
    return () => {
      geometry.dispose()
      for (const decor of decorGeometries) decor.dispose()
    }
  }, [geometry, decorGeometries])

  // Clear the base snowflake and decorators inside the rectangular
  // rail region behind the name. Infinite planes only intersect, so
  // the kept region is a union rendered as four instances: above the
  // top rail, below the bottom rail, and the left/right strips beside
  // the rails inside the band. Every boundary sits a quarter of the
  // rail thickness inside the rail so clipped ends stay hidden.
  const { basePlanes, decorPlanes } = useMemo(() => {
    if (!railDims || !showName) {
      return { basePlanes: null, decorPlanes: null }
    }
    // The ornament group renders at scale 0.05 and is re-centered on
    // the opening, so convert the rail bounds into world space.
    const world = (v: number) => 0.05 * (v - opening.center.y)
    const worldX = (v: number) => 0.05 * (v - opening.center.x)
    const overlap = railDims.bar / 4
    const topBand = world(railDims.top - overlap)
    const bottomBand = world(railDims.bottom + overlap)
    // Rail endpoints, pulled a half-bar inward so straddling
    // geometry is cut deeper inside the rail end and concealed
    // (beads protrude past the rail's front face, so a quarter-bar
    // was not enough to hide their sliced edges).
    const overlapX = railDims.bar / 2
    const leftEdge =
      worldX(opening.x) + 0.05 * (overlapX - railDims.width / 2)
    const rightEdge =
      worldX(opening.x) + 0.05 * (railDims.width / 2 - overlapX)
    const regions = (top: number, bottom: number): Plane[][] => [
      [new Plane(new Vector3(0, 1, 0), -top)], // above top rail
      [new Plane(new Vector3(0, -1, 0), bottom)], // below bottom rail
      [
        new Plane(new Vector3(-1, 0, 0), leftEdge),
        new Plane(new Vector3(0, -1, 0), top),
        new Plane(new Vector3(0, 1, 0), -bottom),
      ], // strip left of the rails
      [
        new Plane(new Vector3(1, 0, 0), -rightEdge),
        new Plane(new Vector3(0, -1, 0), top),
        new Plane(new Vector3(0, 1, 0), -bottom),
      ], // strip right of the rails
    ]
    return {
      basePlanes: regions(topBand, bottomBand),
      // Decorators are clipped in Y across the full width, so beads
      // intersecting the rails are cut at the same in-rail boundary
      // even when they extend past the rail endpoints.
      decorPlanes: [
        [new Plane(new Vector3(0, 1, 0), -topBand)],
        [new Plane(new Vector3(0, -1, 0), bottomBand)],
      ],
    }
  }, [railDims, showName, opening])

  const goldProps = {
    color: '#c6a15b' as const,
    metalness: 0.7,
    roughness: 0.4,
  }

  return (
    <group scale={0.05}>
      <group
        position={[
          -opening.center.x,
          -opening.center.y,
          -opening.center.z,
        ]}
      >
        {/* One instance per kept region; the regions partition the
            model exactly so there is no overlap or z-fighting. */}
        {basePlanes ? (
          basePlanes.map((planes, i) => (
            <mesh key={i} geometry={geometry}>
              <meshStandardMaterial
                {...goldProps}
                clippingPlanes={planes}
              />
            </mesh>
          ))
        ) : (
          <mesh geometry={geometry}>
            <meshStandardMaterial {...goldProps} />
          </mesh>
        )}

        {decorGeometries.map((decor, index) =>
          decorPlanes ? (
            <Fragment key={index}>
              {decorPlanes.map((planes, i) => (
                <mesh key={i} geometry={decor}>
                  <meshStandardMaterial
                    {...goldProps}
                    clippingPlanes={planes}
                  />
                </mesh>
              ))}
            </Fragment>
          ) : (
            <mesh key={index} geometry={decor}>
              <meshStandardMaterial {...goldProps} />
            </mesh>
          ),
        )}

        {showName && (
          <Suspense fallback={null}>
            <NameAndRails
              name={name}
              opening={opening}
              textSize={textSize}
              selectedFont={selectedFont}
              onLayout={handleLayout}
            />
          </Suspense>
        )}
      </group>
    </group>
  )
}

function GeneratedOrnament({
  geometry,
  onSize,
}: {
  geometry: BufferGeometry
  onSize?: (size: { x: number; y: number; z: number }) => void
}) {
  const { processed, center } = useMemo(() => {
    const g = toCreasedNormals(geometry, Math.PI / 3)
    g.computeBoundingBox()
    return { processed: g, center: g.boundingBox!.getCenter(new Vector3()) }
  }, [geometry])

  useEffect(() => {
    return () => processed.dispose()
  }, [processed])

  // The generated STL is exact geometry, so this reports real dimensions.
  useEffect(() => {
    const b = processed.boundingBox!
    onSize?.({
      x: b.max.x - b.min.x,
      y: b.max.y - b.min.y,
      z: b.max.z - b.min.z,
    })
  }, [processed, onSize])

  return (
    <group scale={0.05}>
      <group position={[-center.x, -center.y, -center.z]}>
        <mesh geometry={processed}>
          <GoldMaterial />
        </mesh>
      </group>
    </group>
  )
}

class PreviewErrorBoundary extends Component<
  { children: ReactNode },
  { message: string | null }
> {
  state: { message: string | null } = {
    message: null,
  }

  static getDerivedStateFromError(error: Error) {
    return {
      message: error.message,
    }
  }

  render() {
    if (this.state.message) {
      return (
        <p
          role="alert"
          style={{ padding: '2rem' }}
        >
          Could not show this design: {this.state.message}
          {' '}
          Choose another design or check the model file,
          then reload.
        </p>
      )
    }

    return this.props.children
  }
}

export default function App() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()

  // Analytics: init is a no-op until consent is granted; each route
  // change reports one page_view (config disables GA's auto first hit).
  useEffect(() => {
    initAnalytics()
    trackPageView()
  }, [pathname])
  const requestedDesign = searchParams.get('design')
  const [selectedModel, setSelectedModel] =
    useState(designs[1].file)

  const [showName, setShowName] =
    useState(true)

  const [name, setName] =
    useState('THE SMITHS')

  const [selectedFont, setSelectedFont] =
    useState('lato')

  const [textSize, setTextSize] =
    useState(1.0)

  const [outerDecor, setOuterDecor] =
    useState('diamonds')

  const [innerDecor, setInnerDecor] =
    useState('none')

  useEffect(() => {
    if (requestedDesign
        && designs.some((design) => design.file === requestedDesign)) {
      setSelectedModel(requestedDesign)
    }
  }, [requestedDesign])
  const [ornSize, setOrnSize] =
    useState<{ x: number; y: number; z: number } | null>(null)

  const paramsKey = JSON.stringify({
    name, selectedModel, showName, selectedFont, textSize,
    outerDecor, innerDecor,
  })

  const selectedDesign = designs.find((d) => d.file === selectedModel)
    ?? designs[0]
  const decorFiles = decorationFiles(selectedDesign.id, outerDecor, innerDecor)

  const [generatedGeom, setGeneratedGeom] =
    useState<BufferGeometry | null>(null)

  const [downloadUrl, setDownloadUrl] =
    useState<string | null>(null)

  const [generatedKey, setGeneratedKey] =
    useState<string | null>(null)

  const [viewGenerated, setViewGenerated] =
    useState(false)

  const generatedLoad = useRef(0)
  const controlsRef = useRef<OrbitControlsImpl | null>(null)

  // Download stays locked until Stripe confirms payment for this artifact.
  const [paidUrl, setPaidUrl] =
    useState<string | null>(null)
  const [paidSessionId, setPaidSessionId] =
    useState<string | null>(null)
  const [printedOrdered, setPrintedOrdered] =
    useState(false)
  const [order, setOrder] =
    useState<{ id: string; key: string; status: string;
               items: { id: number; product: string; name: string;
                        quantity: number; status: string;
                        label: string }[] } | null>(null)
  const [orderVisible, setOrderVisible] = useState(false)
  const [orderAccess, setOrderAccess] =
    useState<{ order_id: string; key: string } | null>(null)

  // Order detail requires the access key in a header — never a URL
  // parameter — so tokens don't land in logs or browser history.
  async function loadOrder(orderId: string, key: string) {
    try {
      const res = await fetch(`${API}/api/orders/${orderId}`, {
        headers: { 'X-Order-Key': key },
      })
      if (!res.ok) throw new Error('not found')
      const data = await res.json()
      setOrder({ id: orderId, key, status: data.status,
                 items: data.items })
      setOrderVisible(true)
      setOrderAccess({ order_id: orderId, key })
      localStorage.setItem('lastOrder',
        JSON.stringify({ order_id: orderId, key, dismissed: false }))
      recordOrder(orderId, key)
    } catch {
      localStorage.removeItem('lastOrder')
      setOrderAccess(null)
      setOrder(null)
      setOrderVisible(false)
    }
  }

  // Dismissal hides the confirmation but keeps the entitlement: the
  // access key stays in localStorage so the order can be re-shown.
  function dismissOrder() {
    setOrderVisible(false)
    if (orderAccess) {
      localStorage.setItem('lastOrder', JSON.stringify(
        { ...orderAccess, dismissed: true }))
    }
  }
  const checkoutHandled = useRef(false)

  const [generatedJobId, setGeneratedJobId] =
    useState<string | null>(null)
  const [generatedPreview, setGeneratedPreview] =
    useState<string | null>(null)
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('ornamentCart') ?? '[]')
    } catch {
      return []
    }
  })
  const [cartOpen, setCartOpen] = useState(false)

  // Persist the cart and extend backend retention for its STL folders.
  useEffect(() => {
    localStorage.setItem('ornamentCart', JSON.stringify(cart))
    if (cart.length) {
      fetch(`${API}/api/cart/pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_ids: cart.map((i) => i.jobId) }),
      }).catch(() => {})
    }
  }, [cart])

  function addToCart(product: 'stl' | 'printed') {
    if (!stlValid || !generatedJobId || !downloadUrl || !generatedPreview) {
      return
    }
    setCart((prev) => {
      const existing = prev.find(
        (i) => i.jobId === generatedJobId && i.product === product)
      if (existing) {
        return product === 'printed'
          ? prev.map((i) => (i === existing
              ? { ...i, quantity: Math.min(50, i.quantity + 1) }
              : i))
          : prev
      }
      return [...prev, {
        id: crypto.randomUUID(),
        jobId: generatedJobId,
        product,
        name, selectedModel, showName, selectedFont, textSize,
        outerDecor, innerDecor,
        downloadUrl, previewUrl: generatedPreview,
        quantity: 1, addedAt: Date.now(),
      }]
    })
  }

  // Alphabet ornaments enter the shared cart with the predesigned job
  // id; cart_pins + checkout treat them like any job. STL items are
  // deduped by job id (a file is a one-unit product); printed pieces
  // support quantity.
  function addAlphabetToCart(
    jobId: string, name: string, previewUrl: string,
    product: 'stl' | 'printed') {
    setCart((prev) => {
      const existing = prev.find(
        (i) => i.jobId === jobId && i.product === product)
      if (existing) {
        return product === 'printed'
          ? prev.map((i) => (i === existing
              ? { ...i, quantity: Math.min(50, i.quantity + 1) }
              : i))
          : prev
      }
      return [...prev, {
        id: crypto.randomUUID(),
        jobId,
        product,
        name, selectedModel: '/models/snowflake_two_pairs.stl',
        showName: true,
        selectedFont: 'lato', textSize: 1,
        downloadUrl: `${API}/api/jobs/${jobId}/download`,
        previewUrl,
        quantity: 1, addedAt: Date.now(),
      }]
    })
    setCartOpen(true)
  }

  async function checkoutCart(items: CartItem[], digitalAck: boolean) {
    const response = await fetch(`${API}/api/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        digital_ack: digitalAck,
        items: items.map((i) => ({
          job_id: i.jobId, product: i.product, quantity: i.quantity,
          params: {
            name: i.showName ? i.name : '', design: i.selectedModel,
            font: i.selectedFont, fontSize: i.textSize,
            showName: i.showName,
            outerDecoration: i.outerDecor, innerDecoration: i.innerDecor,
          },
        })),
      }),
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(typeof data.detail === 'string'
        ? data.detail : 'Checkout failed.')
    }
    if (items.length === 1) {
      // Single-item carts reuse the legacy return path so an STL
      // purchase still unlocks its download.
      const item = items[0]
      sessionStorage.setItem('pendingPurchase', JSON.stringify({
        name: item.name, selectedModel: item.selectedModel,
        showName: item.showName, selectedFont: item.selectedFont,
        textSize: item.textSize, url: item.downloadUrl,
        preview: item.previewUrl, job: item.jobId, product: item.product,
        outerDecor: item.outerDecor, innerDecor: item.innerDecor,
        key: JSON.stringify({
          name: item.name, selectedModel: item.selectedModel,
          showName: item.showName, selectedFont: item.selectedFont,
          textSize: item.textSize,
          outerDecor: item.outerDecor, innerDecor: item.innerDecor,
        }),
      }))
    } else {
      sessionStorage.setItem('pendingPurchase', JSON.stringify({
        product: 'cart', order_id: data.order_id,
      }))
    }
    window.location.href = data.url
  }

  // Load the generated STL outside the Canvas so a load failure
  // leaves the live preview and the download link untouched.
  const handleGenerated = useCallback(
    (url: string, preview: string, jobId?: string) => {
    const key = paramsKey
    const id = ++generatedLoad.current
    setDownloadUrl(url)
    setGeneratedPreview(preview)
    setGeneratedJobId(jobId ?? null)
    new STLLoader().load(
      preview,
      (g) => {
        if (generatedLoad.current === id) {
          setGeneratedGeom(g)
          setGeneratedKey(key)
          setViewGenerated(true)
          controlsRef.current?.reset()
        }
      },
      undefined,
      () => {},
    )
  }, [paramsKey])

  // Any parameter change returns the viewport to the live preview.
  // The last generated STL stays cached for comparison.
  useEffect(() => {
    generatedLoad.current++
    setViewGenerated(false)
  }, [name, selectedModel, showName, selectedFont, textSize,
      outerDecor, innerDecor])

  // Returning from Stripe Checkout is a fresh page load: verify the
  // session server-side, then restore the purchased artifact from the
  // stash written in buy().
  useEffect(() => {
    if (checkoutHandled.current) return
    checkoutHandled.current = true
    const params = new URLSearchParams(window.location.search)
    const payment = params.get('payment')
    const sessionId = params.get('session_id')
    if (!payment) {
      // Same-browser convenience: restore the last paid order's
      // downloads after a refresh.
      const last = localStorage.getItem('lastOrder')
      if (last) {
        try {
          const { order_id, key, dismissed } = JSON.parse(last)
          setOrderAccess({ order_id, key })
          if (!dismissed) loadOrder(order_id, key)
        } catch { /* ignore */ }
      }
      return
    }
    // Stripe returns to '/' (the backend success URL); params are
    // already captured above, so strip them and show the customizer
    // where the confirmation/downloads live.
    navigate('/create', { replace: true })
    if (payment !== 'success' || !sessionId) return
    const stash = sessionStorage.getItem('pendingPurchase')
    if (!stash) return
    fetch(`${API}/api/checkout/status?session_id=${encodeURIComponent(sessionId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(({ paid, job_id, product, order_id, access_token }:
        { paid: boolean; job_id?: string; product?: string;
          order_id?: string; access_token?: string }) => {
        const s = JSON.parse(stash)
        if (!paid) return
        if (product === 'cart') {
          if (!order_id || s.order_id !== order_id || !access_token) {
            return
          }
          setCart([])
          loadOrder(order_id, access_token)
          sessionStorage.removeItem('pendingPurchase')
          return
        }
        if (job_id !== s.job || product !== s.product) return
        // Persist order access for My Orders without changing the
        // Create page's single-item flow (the confirm card stays
        // dismissed; the legacy unlock below is untouched).
        if (order_id && access_token) {
          setOrderAccess({ order_id, key: access_token })
          localStorage.setItem('lastOrder', JSON.stringify(
            { order_id, key: access_token, dismissed: true }))
          recordOrder(order_id, access_token)
        }
        setName(s.name)
        setSelectedModel(s.selectedModel)
        setShowName(s.showName)
        setSelectedFont(s.selectedFont)
        setTextSize(s.textSize)
        setOuterDecor(s.outerDecor ?? 'none')
        setInnerDecor(s.innerDecor ?? 'none')
        setDownloadUrl(s.url)
        // Only an 'stl' purchase unlocks the download. A paid 'printed'
        // order confirms separately and leaves the STL gated.
        if (product === 'stl') {
          setPaidUrl(s.url)
          setPaidSessionId(sessionId)
        } else {
          setPrintedOrdered(true)
        }
        // The purchased item leaves the cart.
        setCart((c) => c.filter(
          (i) => !(i.jobId === s.job && i.product === product)))
        sessionStorage.removeItem('pendingPurchase')
        new STLLoader().load(
          s.preview,
          (g) => {
            setGeneratedGeom(g)
            setGeneratedKey(s.key)
            setViewGenerated(true)
            controlsRef.current?.reset()
          },
          undefined,
          () => {},
        )
      })
      .catch(() => {})
  }, [])

  const showingGenerated = generatedGeom != null && viewGenerated
  const changesPending = generatedGeom != null && generatedKey !== paramsKey
  // downloadUrl stays cached across param changes; the artifact only
  // matches the current customization when generatedKey === paramsKey.
  const stlValid = downloadUrl != null && generatedGeom != null
    && generatedKey === paramsKey

  useEffect(() => {
    return () => generatedGeom?.dispose()
  }, [generatedGeom])

  useRouteMeta()

  return (
    <main className="app">
      <AnnouncementBar />
      <Header cartCount={cart.length} onCartOpen={() => setCartOpen(true)} />
      <div className="page-scroll">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/create" element={
          <div className="app-main">
            <section className="controls">
        <h1>Personalize your ornament</h1>

        <div className="control-section">
          <div className="section-heading">
            <span className="step-num">1</span>Design
          </div>

          <label htmlFor="design">Snowflake design</label>
          <select
            id="design"
            value={selectedModel}
            onChange={(event) => setSelectedModel(event.target.value)}
          >
            {designs.map((design) => (
              <option key={design.file} value={design.file}>
                {design.label}
              </option>
            ))}
          </select>

          <label htmlFor="outer-decor">Branch Tips</label>
          <select
            id="outer-decor"
            value={outerDecor}
            onChange={(event) => setOuterDecor(event.target.value)}
          >
            {outerDecorations.map((decor) => (
              <option key={decor.value} value={decor.value}>
                {decor.label}
              </option>
            ))}
          </select>

          <label htmlFor="inner-decor">Branch Accents</label>
          <select
            id="inner-decor"
            value={innerDecor}
            onChange={(event) => setInnerDecor(event.target.value)}
          >
            {innerDecorations.map((decor) => (
              <option key={decor.value} value={decor.value}>
                {decor.label}
              </option>
            ))}
          </select>
        </div>

        <div className="control-section">
          <div className="section-heading">
            <span className="step-num">2</span>Personalize
          </div>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={showName}
              onChange={(event) => setShowName(event.target.checked)}
            />
            <span>Add name</span>
          </label>

          {showName && (
            <div className="personalization-options">
              <label htmlFor="name">Name</label>
              <input
                id="name"
                value={name}
                maxLength={24}
                aria-describedby="name-help"
                data-clarity-mask="true"
                onChange={(event) =>
                  setName(
                    event.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9 '\-]/g, ''),
                  )
                }
              />

              <small id="name-help" className="help-text">
                24 characters max · letters, numbers, and spaces only.
              </small>

              {name !== '' && !/[A-Z0-9]/.test(name) && (
                <small className="field-error" role="alert">
                  Please enter at least one letter or number.
                </small>
              )}

              <label htmlFor="font">Font</label>
              <select
                id="font"
                value={selectedFont}
                onChange={(event) => setSelectedFont(event.target.value)}
              >
                {fonts.map((font) => (
                  <option key={font.value} value={font.value}>
                    {font.label}
                  </option>
                ))}
              </select>

              <label htmlFor="text-size">Name size</label>

              <div className="size-control">
                <input
                  id="text-size"
                  type="range"
                  min="0.75"
                  max="2"
                  step="0.05"
                  value={textSize}
                  onChange={(event) =>
                    setTextSize(Number(event.target.value))
                  }
                />

                <div className="size-labels">
                  <span>0.75</span>
                  <span className="current-value">{textSize.toFixed(2)}</span>
                  <span>2.0</span>
                </div>

                {ornSize && (
                  <p className="orn-dims">
                    ≈ {Math.round(ornSize.x)} × {Math.round(ornSize.y)} ×{' '}
                    {Math.round(ornSize.z)} mm&ensp;(
                    {(ornSize.x / 25.4).toFixed(1)} ×{' '}
                    {(ornSize.y / 25.4).toFixed(1)} ×{' '}
                    {(ornSize.z / 25.4).toFixed(1)} in)
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="control-section">
          <div className="section-heading">
            <span className="step-num">3</span>Create
          </div>
          <DownloadPanel
          name={name}
          selectedModel={selectedModel}
          showName={showName}
          selectedFont={selectedFont}
          textSize={textSize}
          outerDecoration={outerDecor}
          innerDecoration={innerDecor}
          downloadUrl={downloadUrl}
          stlValid={stlValid}
          paid={downloadUrl != null && downloadUrl === paidUrl}
          paidSessionId={paidSessionId}
          paramsKey={paramsKey}
          printedOrdered={printedOrdered}
          order={orderVisible ? order : null}
          hasOrderAccess={orderAccess != null}
          onDismissOrder={dismissOrder}
          onReady={handleGenerated}
          onAddToCart={addToCart}
          generatedJobId={generatedJobId}
          previewUrl={generatedPreview}
          />
          <FreeStlOffer
            jobId={generatedJobId}
            stlValid={stlValid}
          />
        </div>
      </section>

      <section className="preview" data-clarity-mask="true">
        <div className="view-toggle" role="group" aria-label="Viewport mode">
          <button
            type="button"
            className={showingGenerated ? '' : 'active'}
            onClick={() => setViewGenerated(false)}
          >
            Live Preview
          </button>
          <button
            type="button"
            className={showingGenerated ? 'active' : ''}
            disabled={!generatedGeom}
            title={generatedGeom ? undefined : 'Generate an STL first'}
            onClick={() => setViewGenerated(true)}
          >
            Generated STL
          </button>
        </div>

        <p className="view-note">
          {showingGenerated
            ? 'Last generated STL — this is the geometry that will be downloaded.'
            : changesPending
              ? 'Changes not generated yet.'
              : 'Updates as you customize.'}
        </p>

        <p className="viewport-hint">Drag to rotate • Scroll to zoom</p>

        {ornSize && (
          <span className="size-chip">
            {Math.round(ornSize.x)} × {Math.round(ornSize.y)} mm
            ({(ornSize.x / 25.4).toFixed(1)} × {(ornSize.y / 25.4).toFixed(1)} in)
          </span>
        )}

        <PreviewErrorBoundary
          key={selectedModel}
        >
          <Canvas
            camera={{
              position: [0, 0, 9],
              fov: 40,
            }}
            gl={{
              localClippingEnabled: true,
              // Compress metallic specular highlights so facets facing
              // the key light don't clip to white.
              toneMapping: ACESFilmicToneMapping,
            }}
          >
            <color
              attach="background"
              args={['#f2eee7']}
            />

            <ambientLight intensity={1.5} />

            <directionalLight
              position={[3, 4, 6]}
              intensity={2}
            />

            <directionalLight
              position={[-3, -2, 2]}
              intensity={1}
            />

            <Suspense fallback={null}>
              {showingGenerated ? (
                <GeneratedOrnament
                  geometry={generatedGeom}
                  onSize={setOrnSize}
                />
              ) : (
                <Ornament
                  file={selectedModel}
                  decorFiles={decorFiles}
                  name={name}
                  showName={showName}
                  textSize={textSize}
                  selectedFont={selectedFont}
                  onSize={setOrnSize}
                />
              )}
            </Suspense>

            <OrbitControls
              ref={controlsRef}
              enablePan={false}
            />
          </Canvas>
        </PreviewErrorBoundary>
          </section>
          </div>
        } />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/alphabet" element={
          <AlphabetPage onAddToCart={addAlphabetToCart} />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/returns" element={<Navigate to="/refunds" replace />} />
        <Route path="/refunds" element={<ReturnsPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {/* The studio fills the viewport; the footer only appears on
          content pages, at the end of the scroll flow. */}
      {pathname !== '/create' && <Footer />}
      </div>
      <CookieConsent />
      <CartPanel
        items={cart}
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        onQuantity={(id, q) => setCart((c) => c.map(
          (i) => (i.id === id ? { ...i, quantity: q } : i)))}
        onRemove={(id) => setCart((c) => c.filter((i) => i.id !== id))}
        onCheckout={checkoutCart}
      />
    </main>
  )
}