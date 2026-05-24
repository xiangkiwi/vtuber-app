import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useVrm } from '../hooks/useVrm.js'
import { useRef } from 'react'

function VrmUpdater({ vrmRef, faceResultRef, applyFace }) {
  useFrame((_, delta) => {
    if (!vrmRef.current) return
    if (faceResultRef.current && applyFace) {
      applyFace(vrmRef.current, faceResultRef.current)
    }
    vrmRef.current.update(delta)
  })
  return null
}

function VrmLoader({ url, faceResultRef, applyFace }) {
  const { scene } = useThree()
  const vrmRef = useVrm(url, scene)
  return <VrmUpdater vrmRef={vrmRef} faceResultRef={faceResultRef} applyFace={applyFace} />
}

export default function Scene({ vrmUrl, isLiveMode, faceResultRef, applyFace }) {
  return (
    <Canvas
      gl={{ alpha: true, antialias: true }}
      style={{
        width: '100%',
        height: '100%',
        background: isLiveMode ? '#00ff00' : 'transparent',
      }}
      camera={{
        position: [0, 1.4, 1.2],
        fov: 30,
        near: 0.1,
        far: 20,
      }}
      onCreated={({ camera }) => {
        camera.lookAt(0, 1.3, 0)
      }}
    >
      <OrbitControls
        enabled={true}
        target={[0, 1.3, 0]}
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={0.5}
        maxDistance={5}
      />
      <ambientLight intensity={0.8} />
      <directionalLight position={[1, 2, 2]} intensity={1.2} />
      <directionalLight position={[-1, 0, 1]} intensity={0.4} />
      <VrmLoader url={vrmUrl} faceResultRef={faceResultRef} applyFace={applyFace} />
    </Canvas>
  )
}
