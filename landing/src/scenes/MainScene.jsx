/** MainScene — Stage 1 skeleton
 * Root Three.js/R3F Canvas with lighting setup.
 * 3D models mounted here in Stage 2.
 */
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';

export default function MainScene({ children }) {
  return (
    <Canvas
      camera={{ position: [0, 5, 20], fov: 60 }}
      gl={{ antialias: true, alpha: true }}
      style={{ position: 'absolute', inset: 0 }}
    >
      {/* Ambient + directional lighting */}
      <ambientLight intensity={0.2} />
      <directionalLight position={[10, 20, 10]} intensity={0.8} color="#4fc3f7" />
      <pointLight position={[-10, -10, -10]} intensity={0.4} color="#00ff88" />

      {/* Starfield background */}
      <Stars radius={120} depth={60} count={3000} factor={3} saturation={0} fade speed={0.8} />

      {/* Camera controls — will be replaced by scroll-driven in Stage 3 */}
      <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.3} />

      {children}
    </Canvas>
  );
}
