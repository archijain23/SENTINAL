/**
 * MainScene.jsx
 * Pure Three.js scene — zero @react-three/drei imports.
 * Uses only @react-three/fiber primitives (Canvas, useFrame, useThree)
 * so there is NO reconciler leakage path.
 *
 * Visual elements:
 *  - Starfield: BufferGeometry points (replaces Drei <Stars>)
 *  - Cyber grid floor: wireframe PlaneGeometry
 *  - Ambient + directional + two point lights
 *  - Lazy NetworkTopology / DefenseShield / ThreatScanner via R3F Suspense
 */
import { Suspense, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import NetworkTopology from '../components/NetworkTopology';
import DefenseShield from '../components/DefenseShield';
import ThreatScanner from '../components/ThreatScanner';

// ─── Star field (pure BufferGeometry — no Drei) ───────────────────────────────
function StarField({ count = 1400 }) {
  const ref = useRef();

  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      const r     = 40 + Math.random() * 60;
      pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
      // mostly white, occasional cyan tint
      const tint = Math.random() > 0.8;
      col[i * 3]     = tint ? 0.6 : 0.9;
      col[i * 3 + 1] = tint ? 1.0 : 0.9;
      col[i * 3 + 2] = tint ? 1.0 : 0.9;
    }
    return [pos, col];
  }, [count]);

  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.elapsedTime * 0.015;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.12}
        vertexColors
        transparent
        opacity={0.7}
        sizeAttenuation
      />
    </points>
  );
}

// ─── Animated cyber-grid floor ────────────────────────────────────────────────
function CyberGrid() {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.material.opacity = 0.055 + Math.sin(clock.elapsedTime * 0.5) * 0.018;
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.6, 0]}>
      <planeGeometry args={[22, 22, 22, 22]} />
      <meshBasicMaterial color="#00F5FF" wireframe transparent opacity={0.055} />
    </mesh>
  );
}

// ─── Lights ───────────────────────────────────────────────────────────────────
function SceneLights() {
  const movingRef = useRef();
  useFrame(({ clock }) => {
    if (!movingRef.current) return;
    const t = clock.elapsedTime * 0.3;
    movingRef.current.position.set(Math.sin(t) * 4, 3, Math.cos(t) * 4);
  });
  return (
    <>
      <ambientLight intensity={0.04} color="#0B1F2E" />
      <directionalLight position={[5, 8, 5]} intensity={0.35} color="#00F5FF" />
      <pointLight ref={movingRef} intensity={1.2} color="#00F5FF" distance={14} decay={2} />
      <pointLight position={[-4, -2, -2]} intensity={0.4} color="#FF3D71" distance={9} decay={2} />
    </>
  );
}

// ─── Subtle mouse parallax camera ─────────────────────────────────────────────
function CameraParallax() {
  useFrame(({ camera, mouse }) => {
    camera.position.x += (mouse.x * 0.4 - camera.position.x) * 0.025;
    camera.position.y += (mouse.y * 0.25 + 1 - camera.position.y) * 0.025;
  });
  return null;
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function MainScene({
  showTopology = true,
  showShield   = false,
  showScanner  = false,
}) {
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Canvas
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
        }}
        camera={{ position: [0, 1, 6], fov: 55, near: 0.1, far: 200 }}
        style={{ position: 'absolute', inset: 0, background: 'transparent' }}
        aria-hidden="true"
        dpr={[1, 1.5]}
      >
        <SceneLights />
        <CyberGrid />
        <StarField count={1400} />
        <CameraParallax />

        <Suspense fallback={null}>
          {showTopology && <NetworkTopology />}
          {showShield   && <DefenseShield position={[0, 0, 0]} />}
          {showScanner  && <ThreatScanner position={[0, 0, 0]} />}
        </Suspense>
      </Canvas>
    </div>
  );
}
