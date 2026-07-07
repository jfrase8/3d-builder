import { Canvas } from '@react-three/fiber'
import { Blocks } from './Blocks'
import { Ghost } from './Ghost'
import { GridFloor } from './GridFloor'
import { CameraRig } from './CameraRig'

export function Scene() {
  return (
    <Canvas shadows camera={{ position: [20, 20, 20], fov: 50, near: 0.1, far: 1000 }}>
      <color attach="background" args={['#0b0e14']} />
      <hemisphereLight args={['#cfe0ff', '#20263a', 0.9]} />
      <directionalLight
        position={[15, 30, 10]}
        intensity={1.1}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <CameraRig />
      <GridFloor />
      <Blocks />
      <Ghost />
    </Canvas>
  )
}
