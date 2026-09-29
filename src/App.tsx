import { Component, Suspense, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Canvas, useLoader } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Vector3 } from 'three'
import type { BufferGeometry } from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import fontUrl from './helvetiker_bold.typeface.json?url'
import './App.css'
import DownloadPanel from './DownloadPanel'

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
  {
    label: 'Montserrat Subrayada Bold',
    value: 'montserrat',
  },
]

// All dimensions below use the STL's original coordinates, before display scale.
// These exports face +Z and have a horizontal opening crossing Y = 0.
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

  // Vertex gaps alone can occur inside triangles.
  // Reject a solid crossing Y = 0.
  const indices = geometry.index
  const count = indices ? indices.count : positions.count

  for (let i = 0; i < count; i += 3) {
    const ys = [0, 1, 2].map((offset) =>
      positions.getY(
        indices ? indices.getX(i + offset) : i + offset,
      ),
    )

    if (Math.min(...ys) < 0 && Math.max(...ys) > 0) {
      throw new Error(
        'This model needs a horizontal opening crossing Y = 0.',
      )
    }
  }

  const gap = top - bottom

  if (!Number.isFinite(gap) || gap <= 0) {
    throw new Error(
      'Could not find the name opening in this model.',
    )
  }

  const tolerance = Math.max(gap * 0.0001, 0.00001)

  let left = Infinity
  let right = -Infinity

  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i)

    if (
      Math.abs(y - top) < tolerance ||
      Math.abs(y - bottom) < tolerance
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

  const depth = bounds.max.z - bounds.min.z

  if (depth <= 0) {
    throw new Error('The STL has no depth.')
  }

  const barHeight = gap * 0.18

  return {
    center,
    top,
    bottom,
    gap,
    barHeight,
    width: right - left + barHeight,
    textWidth: right - left - barHeight,
    textHeight: gap - barHeight + gap * 0.025,
    x: (left + right) / 2,
    y: (top + bottom) / 2,
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
}: {
  name: string
  opening: Opening
  textSize: number
}) {
  // Temporary preview font.
  // We'll replace this with the selected font in the next step.
  const font = useLoader(FontLoader, fontUrl)

  const { geometry, railWidth } = useMemo(() => {
    const text = name.trim()

    if (!text) {
      return {
        geometry: null,
        railWidth: opening.width,
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
        railWidth: opening.width,
      }
    }

    // Base scale fits the lettering vertically inside the opening.
    // textSize lets the user scale it from 0.75x to 2x.
    const baseScale = opening.textHeight / size.y
    const finalScale = baseScale * textSize

    result.scale(finalScale, finalScale, 1)

    // Measure actual width after scaling.
    result.computeBoundingBox()

    const textWidth =
      result.boundingBox!.getSize(new Vector3()).x

    const sidePadding = opening.barHeight

    // Keep rails at least as wide as the snowflake opening.
    // Longer names can make the rails wider.
    const railWidth = Math.max(
      opening.width,
      textWidth + sidePadding * 2,
    )

    result.center()

    return {
      geometry: result,
      railWidth,
    }
  }, [font, name, opening, textSize])

  useEffect(() => {
    return () => {
      geometry?.dispose()
    }
  }, [geometry])

  return (
    <group>
      {[opening.top, opening.bottom].map((y) => (
        <mesh
          key={y}
          position={[opening.x, y, opening.z]}
        >
          <boxGeometry
            args={[
              railWidth,
              opening.barHeight,
              opening.depth,
            ]}
          />

          <GoldMaterial />
        </mesh>
      ))}

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
}: {
  file: string
  name: string
  showName: boolean
  textSize: number
}) {
  const source = useLoader(STLLoader, file)

  const { geometry, opening } = useMemo(() => {
    // Do not center or otherwise mutate useLoader's cached STL.
    const opening = measureOpening(source)

    const geometry = source.clone()
    geometry.computeVertexNormals()

    return {
      geometry,
      opening,
    }
  }, [source])

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
        <mesh geometry={geometry}>
          <GoldMaterial />
        </mesh>

        {showName && (
          <Suspense fallback={null}>
            <NameAndRails
              name={name}
              opening={opening}
              textSize={textSize}
            />
          </Suspense>
        )}
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
          name={showName ? name : ''}
          selectedModel={selectedModel}
        />
      </section>

      <section className="preview">
        <PreviewErrorBoundary
          key={selectedModel}
        >
          <Canvas
            camera={{
              position: [0, 0, 9],
              fov: 40,
            }}
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
              <Ornament
                file={selectedModel}
                name={name}
                showName={showName}
                textSize={textSize}
              />
            </Suspense>

            <OrbitControls
              enablePan={false}
            />
          </Canvas>
        </PreviewErrorBoundary>
      </section>
    </main>
  )
}