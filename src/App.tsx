import { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Canvas, useLoader } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Vector3 } from 'three'
import {
  AlwaysStencilFunc,
  KeepStencilOp,
  NotEqualStencilFunc,
  ReplaceStencilOp,
} from 'three'
import type { BufferGeometry } from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import './App.css'
import DownloadPanel, { API } from './DownloadPanel'

const designs = [
  {
    label: 'Two Branch',
    file: '/models/snowflake_two_pairs.stl',
  },
  {
    label: 'Three Branch',
    file: '/models/snowflake_three_pairs.stl',
  },
  {
    label: 'Longer Branches',
    file: '/models/snowflake_longer_branches.stl',
  },
]

const fonts = [
  {
    label: 'Lato Bold',
    value: 'lato',
  },
  {
    label: 'Arial Bold',
    value: 'arial',
  },
  {
    label: 'Cambria Bold',
    value: 'cambria',
  },
]

// Font URL mapping for Three.js preview
// Millimeters of cap height per unit of Name Size in the Houdini HDA.
// Anchored on a generated STL: "LORI" measured 8.21mm at size 1.
const MM_PER_SIZE = 8.00
// Rail thickness as a fraction of the rendered text height,
// matching the HDA's transform6/transform7 sy = 0.2 on the text bbox.
const RAIL_HEIGHT_FRACTION = 0.2
const fontUrls: Record<string, string> = {
  lato: '/fonts/Lato_Bold.json',
  arial: '/fonts/Arial_Bold.json',
  cambria: '/fonts/Cambria_Bold.json',
  montserrat: '/fonts/Montserrat Subrayada_Bold.json',
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
      roughness={0.3}
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
  onLayout?: (railWidth: number, railTop: number, railBottom: number) => void
}) {
  // Use the selected font for preview
  const font = useLoader(FontLoader, fontUrls[selectedFont] || fontUrls.lato)

  const { geometry, railWidth, railTop, railBottom, clippingWidth, clippingHeight, barHeight } = useMemo(() => {
    const text = name.trim()

    // Houdini's rule: rails are at least 75% of the snowflake width.
    const minimumRailWidth = opening.ornamentWidth * 0.75

    if (!text) {
      return {
        geometry: null,
        railWidth: minimumRailWidth,
        railTop: opening.top,
        railBottom: opening.bottom,
        clippingWidth: opening.width,
        clippingHeight: 0,
        barHeight: opening.barHeight,
      }
    }

    const result = new TextGeometry(text, {
      font,
      size: 1,
      depth: opening.depth,
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
        clippingWidth: opening.width,
        clippingHeight: 0,
        barHeight: opening.barHeight,
      }
    }

    // Absolute scale in millimeters matching the HDA's font_size,
    // so each font keeps its natural cap-height/em ratio.
    const finalScale = textSize * MM_PER_SIZE

    result.scale(finalScale, finalScale, 1)

    // Measure actual dimensions after scaling.
    result.computeBoundingBox()

    const textSizeScaled = result.boundingBox!.getSize(new Vector3())
    const textWidth = textSizeScaled.x
    const textHeight = textSizeScaled.y

    // HDA rule: rail thickness = 0.2 x rendered text bbox height.
    const barHeight = textHeight * RAIL_HEIGHT_FRACTION

    // Same clearance between text and rail centers as the original opening.
    // At textSize = 1 this puts the rails exactly at opening.top/bottom.
    const verticalPadding = (opening.gap - opening.textHeight) / 2

    const railWidth = Math.max(minimumRailWidth, textWidth)

    // Position rails based on actual text height with padding
    const railTop = opening.y + textHeight / 2 + verticalPadding
    const railBottom = opening.y - textHeight / 2 - verticalPadding

    // Clip the snowflake only where the text itself lives. The rail
    // band keeps its snowflake so it intersects the rails for a
    // watertight print.
    const clippingWidth = railWidth
    const clippingHeight = textHeight

    result.center()

    return {
      geometry: result,
      railWidth,
      railTop,
      railBottom,
      clippingWidth,
      clippingHeight,
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
    onLayout?.(railWidth, railTop, railBottom)
  }, [railWidth, railTop, railBottom, onLayout])

  return (
    <group>
      {/* Writes the text footprint into the stencil buffer so the
          snowflake material can skip those pixels. Renders first via
          renderOrder and produces no color or depth output. */}
      {geometry && (
        <mesh
          position={[opening.x, opening.y, opening.z]}
          renderOrder={-1}
        >
          <boxGeometry
            args={[
              clippingWidth,
              clippingHeight,
              opening.depth,
            ]}
          />
          <meshBasicMaterial
            colorWrite={false}
            depthWrite={false}
            stencilWrite
            stencilFunc={AlwaysStencilFunc}
            stencilRef={1}
            stencilFail={KeepStencilOp}
            stencilZFail={KeepStencilOp}
            stencilZPass={ReplaceStencilOp}
          />
        </mesh>
      )}

      {geometry && (
        <>
          <mesh
            position={[opening.x, railTop, opening.z]}
          >
            <boxGeometry
              args={[
                railWidth,
                barHeight,
                opening.depth,
              ]}
            />

            <GoldMaterial />
          </mesh>

          <mesh
            position={[opening.x, railBottom, opening.z]}
          >
            <boxGeometry
              args={[
                railWidth,
                barHeight,
                opening.depth,
              ]}
            />

            <GoldMaterial />
          </mesh>
        </>
      )}

      {geometry && (
        <mesh
          geometry={geometry}
          position={[
            opening.x,
            opening.y,
            opening.z,
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
  name,
  showName,
  textSize,
  selectedFont,
  onSize,
}: {
  file: string
  name: string
  showName: boolean
  textSize: number
  selectedFont: string
  onSize?: (size: { x: number; y: number; z: number }) => void
}) {
  const source = useLoader(STLLoader, file)

  const [railDims, setRailDims] = useState<{
    width: number
    top: number
    bottom: number
  } | null>(null)

  // Same-value guard keeps the child -> parent report loop-free.
  const handleLayout = useCallback(
    (width: number, top: number, bottom: number) => {
      setRailDims((prev) =>
        prev &&
        prev.width === width &&
        prev.top === top &&
        prev.bottom === bottom
          ? prev
          : { width, top, bottom },
      )
    },
    [],
  )

  const { geometry, opening } = useMemo(() => {
    // Do not center or otherwise mutate useLoader's cached STL.
    const opening = measureOpening(source)

    // Smooth normals across shallow angles; keep edges >= 60 deg hard.
    const geometry = toCreasedNormals(source.clone(), Math.PI / 3)

    geometry.computeBoundingBox()

    return {
      geometry,
      opening,
    }
  }, [source])

  // STL coordinates are millimeters; union the snowflake bbox with the
  // rail boxes for the approximate finished size.
  useEffect(() => {
    if (!onSize) return
    const bounds = geometry.boundingBox!
    let minX = bounds.min.x
    let maxX = bounds.max.x
    let minY = bounds.min.y
    let maxY = bounds.max.y

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
  }, [geometry, opening, showName, railDims, onSize])

  useEffect(() => {
    return () => geometry.dispose()
  }, [geometry])

  return (
    <group scale={0.05}>
      <group
        position={[
          -opening.center.x,
          -opening.center.y,
          -opening.center.z,
        ]}
      >
        {/* Stencil test hides the snowflake inside the name/rail
            footprint written by the mask mesh in NameAndRails. */}
        <mesh geometry={geometry} renderOrder={1}>
          <meshStandardMaterial
            color="#c6a15b"
            metalness={0.7}
            roughness={0.3}
            stencilWrite
            stencilFunc={NotEqualStencilFunc}
            stencilRef={1}
            stencilFuncMask={0xff}
          />
        </mesh>

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
  const [selectedModel, setSelectedModel] =
    useState(designs[0].file)

  const [showName, setShowName] =
    useState(true)

  const [name, setName] =
    useState('THE SMITHS')

  const [selectedFont, setSelectedFont] =
    useState('lato')

  const [textSize, setTextSize] =
    useState(1.0)

  const [ornSize, setOrnSize] =
    useState<{ x: number; y: number; z: number } | null>(null)

  const paramsKey = JSON.stringify({
    name, selectedModel, showName, selectedFont, textSize,
  })

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
  const checkoutHandled = useRef(false)

  // Load the generated STL outside the Canvas so a load failure
  // leaves the live preview and the download link untouched.
  const handleGenerated = useCallback((url: string, preview: string) => {
    const key = paramsKey
    const id = ++generatedLoad.current
    setDownloadUrl(url)
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
  }, [name, selectedModel, showName, selectedFont, textSize])

  // Returning from Stripe Checkout is a fresh page load: verify the
  // session server-side, then restore the purchased artifact from the
  // stash written in buy().
  useEffect(() => {
    if (checkoutHandled.current) return
    checkoutHandled.current = true
    const params = new URLSearchParams(window.location.search)
    const payment = params.get('payment')
    const sessionId = params.get('session_id')
    if (!payment) return
    window.history.replaceState({}, '', window.location.pathname)
    if (payment !== 'success' || !sessionId) return
    const stash = sessionStorage.getItem('pendingPurchase')
    if (!stash) return
    fetch(`${API}/api/checkout/status?session_id=${encodeURIComponent(sessionId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(({ paid, job_id, product }:
        { paid: boolean; job_id?: string; product?: string }) => {
        const s = JSON.parse(stash)
        if (!paid || job_id !== s.job || product !== s.product) return
        setName(s.name)
        setSelectedModel(s.selectedModel)
        setShowName(s.showName)
        setSelectedFont(s.selectedFont)
        setTextSize(s.textSize)
        setDownloadUrl(s.url)
        // Only an 'stl' purchase unlocks the download. A paid 'printed'
        // order confirms separately and leaves the STL gated.
        if (product === 'stl') {
          setPaidUrl(s.url)
          setPaidSessionId(sessionId)
        } else {
          setPrintedOrdered(true)
        }
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

  return (
    <main className="app">
      <section className="controls">
        <h1>Personalized Snowflake Ornament</h1>

        <div className="control-section">
          <div className="section-heading">Design</div>

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
        </div>

        <div className="control-section">
          <div className="section-heading">Personalization</div>

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
                onChange={(event) =>
                  setName(
                    event.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9 '\-]/g, ''),
                  )
                }
              />

              <small id="name-help" className="help-text">
                24 characters max · letters, numbers, spaces, hyphens and apostrophes.
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
              </div>
            </div>
          )}
        </div>

        <DownloadPanel
          name={name}
          selectedModel={selectedModel}
          showName={showName}
          selectedFont={selectedFont}
          textSize={textSize}
          downloadUrl={downloadUrl}
          stlValid={stlValid}
          paid={downloadUrl != null && downloadUrl === paidUrl}
          paidSessionId={paidSessionId}
          paramsKey={paramsKey}
          printedOrdered={printedOrdered}
          onReady={handleGenerated}
        />

        {ornSize && (
          <small className="approx-size">
            Approx. size: {Math.round(ornSize.x)} × {Math.round(ornSize.y)} mm
            ({(ornSize.x / 25.4).toFixed(1)} × {(ornSize.y / 25.4).toFixed(1)} in)
          </small>
        )}
      </section>

      <section className="preview">
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

        <PreviewErrorBoundary
          key={selectedModel}
        >
          <Canvas
            camera={{
              position: [0, 0, 9],
              fov: 40,
            }}
            gl={{ stencil: true }}
          >
            <color
              attach="background"
              args={['#f2eee7']}
            />

            <ambientLight intensity={1.5} />

            <directionalLight
              position={[3, 4, 6]}
              intensity={3}
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
    </main>
  )
}