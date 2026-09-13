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
    if (y < 0) bottom = Math.max(bottom, y)
    else top = Math.min(top, y)
  }
  // Vertex gaps alone can occur inside triangles. Reject a solid crossing Y=0.
  const indices = geometry.index
  const count = indices ? indices.count : positions.count
  for (let i = 0; i < count; i += 3) {
    const ys = [0, 1, 2].map((offset) =>
      positions.getY(indices ? indices.getX(i + offset) : i + offset),
    )
    if (Math.min(...ys) < 0 && Math.max(...ys) > 0) {
      throw new Error('This model needs a horizontal opening crossing Y = 0.')
    }
  }
  const gap = top - bottom
  if (!Number.isFinite(gap) || gap <= 0) {
    throw new Error('Could not find the name opening in this model.')
  }
  const tolerance = Math.max(gap * 0.0001, 0.00001)
  let left = Infinity
  let right = -Infinity
  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i)
    if (Math.abs(y - top) < tolerance || Math.abs(y - bottom) < tolerance) {
      left = Math.min(left, positions.getX(i))
      right = Math.max(right, positions.getX(i))
    }
  }
  if (!Number.isFinite(left) || right <= left) {
    throw new Error('Could not measure the cut edges of this model.')
  }
  const depth = bounds.max.z - bounds.min.z
  if (depth <= 0) throw new Error('The STL has no depth.')
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
  return <meshStandardMaterial color="#c6a15b" metalness={0.7} roughness={0.3} />
}

function NameAndRails({
  name,
  opening,
}: {
  name: string
  opening: Opening
}) {
  const font = useLoader(FontLoader, fontUrl)

  const { geometry, railWidth } = useMemo(() => {
    const text = name.trim()

    if (!text) {
      return { geometry: null, railWidth: opening.width }
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
      return { geometry: null, railWidth: opening.width }
    }

    // Use the same X and Y scale to preserve letter proportions.
    const textScale = opening.textHeight / size.y
    result.scale(textScale, textScale, 1)

    // Measure the actual width after scaling.
    result.computeBoundingBox()
    const textWidth = result.boundingBox!.getSize(new Vector3()).x

    // Extra bar length beyond each end of the name.
    const sidePadding = opening.barHeight

    // Keep bars at least as wide as the original snowflake opening.
    const railWidth = Math.max(
      opening.width,
      textWidth + sidePadding * 2,
    )

    result.center()

    return { geometry: result, railWidth }
  }, [font, name, opening])

  useEffect(() => {
    return () => {
      geometry?.dispose()
    }
  }, [geometry])

  return (
    <group>
      {[opening.top, opening.bottom].map((y) => (
        <mesh key={y} position={[opening.x, y, opening.z]}>
          <boxGeometry
            args={[railWidth, opening.barHeight, opening.depth]}
          />
          <GoldMaterial />
        </mesh>
      ))}

      {geometry && (
        <mesh
          geometry={geometry}
          position={[opening.x, opening.y, opening.z]}
        >
          <GoldMaterial />
        </mesh>
      )}
    </group>
  )
}

function Ornament({ file, name }: { file: string; name: string }) {
  const source = useLoader(STLLoader, file)
  const { geometry, opening } = useMemo(() => {
    // Do not center or otherwise mutate useLoader's cached STL.
    const opening = measureOpening(source)
    const geometry = source.clone()
    geometry.computeVertexNormals()
    return { geometry, opening }
  }, [source])
  useEffect(() => () => geometry.dispose(), [geometry])

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

        <Suspense fallback={null}>
          <NameAndRails name={name} opening={opening} />
        </Suspense>
      </group>
    </group>
  )
}

class PreviewErrorBoundary extends Component<
  { children: ReactNode },
  { message: string | null }
> {
  state: { message: string | null } = { message: null }
  static getDerivedStateFromError(error: Error) {
    return { message: error.message }
  }
  render() {
    if (this.state.message) {
      return (
        <p role="alert" style={{ padding: '2rem' }}>
          Could not show this design: {this.state.message} Choose another design
          or check the model file, then reload.
        </p>
      )
    }
    return this.props.children
  }
}

export default function App() {
  const [selectedModel, setSelectedModel] = useState(designs[0].file)
  const [name, setName] = useState('THE SMITHS')

  return (
    <main className="app">
      <section className="controls">
        <h1>Personalized Snowflake Ornament</h1>
        <label htmlFor="design">Snowflake design</label>
        <select id="design" value={selectedModel}
          onChange={(event) => setSelectedModel(event.target.value)}>
          {designs.map((design) => (
            <option key={design.file} value={design.file}>{design.label}</option>
          ))}
        </select>

        <label htmlFor="name">Name</label>
        <input id="name" value={name} maxLength={24} aria-describedby="name-help"
          onChange={(event) => setName(
            event.target.value.toUpperCase().replace(/[^A-Z0-9 '\-]/g, ''),
          )} />
        <small id="name-help" style={{ display: 'block', marginTop: '0.5rem' }}>
          Up to 24 characters: A–Z, numbers, spaces, hyphens and apostrophes.
          Lettering is uppercase; shorter names keep their natural proportions.
        </small>
        <DownloadPanel name={name} selectedModel={selectedModel} />
      </section>

      <section className="preview">
        <PreviewErrorBoundary key={selectedModel}>
          <Canvas camera={{ position: [0, 0, 9], fov: 40 }}>
            <color attach="background" args={['#f2eee7']} />
            <ambientLight intensity={1.5} />
            <directionalLight position={[3, 4, 6]} intensity={3} />
            <directionalLight position={[-3, -2, 2]} intensity={1} />
            <Suspense fallback={null}>
              <Ornament file={selectedModel} name={name} />
            </Suspense>
            <OrbitControls enablePan={false} />
          </Canvas>
        </PreviewErrorBoundary>
      </section>
    </main>
  )
}
