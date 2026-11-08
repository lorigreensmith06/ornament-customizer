import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Canvas, useLoader } from '@react-three/fiber'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { toCreasedNormals }
  from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { Mesh, Vector3 } from 'three'
import type { BufferGeometry, Object3D } from 'three'

/* Small non-interactive 3D thumbnail for product cards, sharing the
   gold material + lighting of the main viewers. */

function extractGeometry(loaded: unknown, file: string): BufferGeometry {
  if (file.endsWith('.glb')) {
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
    if (!g.attributes.normal) return toCreasedNormals(g, Math.PI / 3)
    return g
  }
  return toCreasedNormals((loaded as BufferGeometry).clone(), Math.PI / 3)
}

function Model({ file }: { file: string }) {
  const loaded = useLoader(
    file.endsWith('.glb') ? GLTFLoader : STLLoader, file)
  const geometry = useMemo(() => {
    const g = extractGeometry(loaded, file)
    g.computeBoundingBox()
    const box = g.boundingBox!
    const size = box.getSize(new Vector3())
    const scale = 5 / Math.max(size.x, size.y, size.z)
    g.center()
    g.scale(scale, scale, scale)
    return g
  }, [loaded, file])
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

export default function ModelThumb({ file }: { file: string }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 8], fov: 40 }}
      dpr={[1, 1.5]}
      gl={{ stencil: true }}
    >
      <color attach="background" args={['#fbf7ef']} />
      <ambientLight intensity={1.5} />
      <directionalLight position={[3, 4, 6]} intensity={3} />
      <directionalLight position={[-3, -2, 2]} intensity={1} />
      <Suspense fallback={null}>
        <Model file={file} />
      </Suspense>
    </Canvas>
  )
}

/* Mounts children (a 3D canvas) only when scrolled near the viewport —
   keeps heavy assets off the critical path. */
export function LazyView({
  children, className,
}: {
  children: ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true)
        io.disconnect()
      }
    }, { rootMargin: '200px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div ref={ref} className={className}>
      {visible ? children : null}
    </div>
  )
}
