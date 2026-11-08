import { Component, Suspense, useMemo } from 'react'
import type { ReactNode } from 'react'
import { Canvas, useLoader } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { toCreasedNormals }
  from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { Mesh, Vector3 } from 'three'
import type { BufferGeometry, Object3D } from 'three'

/* 3D preview for pre-designed letter ornaments. GLB only — the
   decimated/public STL fallbacks were removed so no downloadable
   print file is ever in the frontend. A load failure shows a
   placeholder instead of crashing the page. */

class LoadBoundary extends Component<
  { children: ReactNode; resetKey: string; fallback: ReactNode },
  { err: boolean }> {
  state = { err: false }
  static getDerivedStateFromError() { return { err: true } }
  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.err)
      this.setState({ err: false })
  }
  render() {
    return this.state.err ? this.props.fallback : this.props.children
  }
}

function extractGeometry(loaded: unknown): BufferGeometry {
  let geo: BufferGeometry | null = null
  let mesh: Mesh | null = null
  ;(loaded as { scene: Object3D }).scene.traverse((o) => {
    if (!mesh && (o as Mesh).isMesh) {
      mesh = o as Mesh
      geo = mesh.geometry as BufferGeometry
    }
  })
  if (!geo || !mesh) throw new Error('No mesh in GLB')
  const g = (geo as BufferGeometry).clone()
  g.applyMatrix4((mesh as Mesh).matrixWorld)
  // GLBs without baked normals get the same creased shading as the
  // snowflake customizer.
  if (!g.attributes.normal) return toCreasedNormals(g, Math.PI / 3)
  return g
}

function LetterModel({
  file, zoom = 1,
}: {
  file: string
  zoom?: number
}) {
  const loaded = useLoader(GLTFLoader, file)
  const geometry = useMemo(() => {
    const g = extractGeometry(loaded)
    g.computeBoundingBox()
    const box = g.boundingBox!
    const size = box.getSize(new Vector3())
    const scale = (5 / Math.max(size.x, size.y, size.z)) * zoom
    g.center()
    g.scale(scale, scale, scale)
    return g
  }, [loaded, file, zoom])
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color="#c6a15b"
        metalness={0.7}
        roughness={0.3}
      />
    </mesh>
  )
}

export default function AlphabetPreview({
  file, zoom,
}: {
  file: string        // /models/alphabet/<key>.glb
  zoom?: number       // model scale factor, default 1
}) {
  return (
    <div className="alphabet-viewer">
      <LoadBoundary
        resetKey={file}
        fallback={
          <div className="alphabet-preview-fallback">
            Preview unavailable right now.
          </div>
        }
      >
        <Canvas
          camera={{ position: [0, 0, 8], fov: 40 }}
          gl={{ stencil: true }}
          className="alphabet-preview-canvas"
        >
          <color attach="background" args={['#f2eee7']} />
          <ambientLight intensity={1.5} />
          <directionalLight position={[3, 4, 6]} intensity={3} />
          <directionalLight position={[-3, -2, 2]} intensity={1} />
          <Suspense fallback={null}>
            <LetterModel file={file} zoom={zoom} />
          </Suspense>
          <OrbitControls enablePan={false} />
        </Canvas>
      </LoadBoundary>
    </div>
  )
}
