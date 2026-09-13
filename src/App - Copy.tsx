import { Suspense, useEffect, useState } from 'react'
import { Canvas, useLoader } from '@react-three/fiber'
import { Center, OrbitControls } from '@react-three/drei'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import './App.css'

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

function Ornament({ file }: { file: string }) {
  const geometry = useLoader(STLLoader, file)

  useEffect(() => {
    geometry.computeVertexNormals()
    geometry.center()
  }, [geometry])

  return (
    <Center>
      <mesh geometry={geometry} scale={0.05}>
        <meshStandardMaterial
          color="#c6a15b"
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>
    </Center>
  )
}

export default function App() {
  const [selectedModel, setSelectedModel] = useState(designs[0].file)

  return (
    <main className="app">
      <section className="controls">
        <h1>Personalized Snowflake Ornament</h1>

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

        <label htmlFor="name">Name</label>
        <input id="name" defaultValue="The Smiths" />

        <button disabled>Download STL</button>
      </section>

      <section className="preview">
        <Canvas camera={{ position: [0, 0, 9], fov: 40 }}>
          <color attach="background" args={['#f2eee7']} />

          <ambientLight intensity={1.5} />
          <directionalLight position={[3, 4, 6]} intensity={3} />
          <directionalLight position={[-3, -2, 2]} intensity={1} />

          <Suspense fallback={null}>
            <Ornament key={selectedModel} file={selectedModel} />
          </Suspense>

          <OrbitControls enablePan={false} />
        </Canvas>
      </section>
    </main>
  )
}