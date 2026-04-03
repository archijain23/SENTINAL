import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export default function DefenseShield({ position = [0, 0, 0] }) {
  const outerRef  = useRef()
  const innerRef  = useRef()
  const ripple1Ref = useRef()
  const ripple2Ref = useRef()
  const hexRef    = useRef()

  // Shield geometry — icosahedron approximates a dome
  const shieldGeo = useMemo(() => {
    return new THREE.IcosahedronGeometry(1.2, 1)
  }, [])

  // Hex grid geometry for holographic overlay
  const hexPoints = useMemo(() => {
    const pts = []
    const rings = 3
    for (let q = -rings; q <= rings; q++) {
      for (let r = -rings; r <= rings; r++) {
        if (Math.abs(q + r) > rings) continue
        const x = q * 0.3 + r * 0.15
        const y = r * 0.26
        pts.push(x, y, 0)
      }
    }
    return new Float32Array(pts)
  }, [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime

    if (outerRef.current) {
      outerRef.current.rotation.y = t * 0.15
      outerRef.current.rotation.z = Math.sin(t * 0.4) * 0.05
      const pulse = 1 + Math.sin(t * 1.5) * 0.02
      outerRef.current.scale.setScalar(pulse)
      outerRef.current.material.opacity = 0.08 + Math.sin(t * 0.8) * 0.02
    }

    if (innerRef.current) {
      innerRef.current.rotation.y = -t * 0.2
      innerRef.current.material.emissiveIntensity = 0.3 + Math.sin(t * 1.2) * 0.15
    }

    // Impact ripple animations
    if (ripple1Ref.current) {
      const scale = 1 + ((t * 0.5) % 1) * 1.5
      ripple1Ref.current.scale.setScalar(scale)
      ripple1Ref.current.material.opacity = Math.max(0, 0.4 - ((t * 0.5) % 1) * 0.4)
    }
    if (ripple2Ref.current) {
      const scale = 1 + (((t * 0.5) + 0.5) % 1) * 1.5
      ripple2Ref.current.scale.setScalar(scale)
      ripple2Ref.current.material.opacity = Math.max(0, 0.4 - (((t * 0.5) + 0.5) % 1) * 0.4)
    }
  })

  return (
    <group position={position}>
      {/* Outer wireframe shell */}
      <mesh ref={outerRef} geometry={shieldGeo}>
        <meshBasicMaterial
          color="#00F5FF"
          wireframe
          transparent
          opacity={0.1}
        />
      </mesh>

      {/* Inner solid shield with fresnel-like glow */}
      <mesh ref={innerRef} geometry={shieldGeo}>
        <meshStandardMaterial
          color="#00F5FF"
          emissive="#00F5FF"
          emissiveIntensity={0.3}
          transparent
          opacity={0.06}
          side={THREE.FrontSide}
          metalness={0.9}
          roughness={0.1}
        />
      </mesh>

      {/* Impact ripple rings */}
      <mesh ref={ripple1Ref}>
        <ringGeometry args={[1.15, 1.25, 64]} />
        <meshBasicMaterial
          color="#00F5FF"
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh ref={ripple2Ref}>
        <ringGeometry args={[1.15, 1.25, 64]} />
        <meshBasicMaterial
          color="#00F5FF"
          transparent
          opacity={0.2}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Hexagonal grid overlay */}
      <points ref={hexRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[hexPoints, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color="#00F5FF"
          size={0.04}
          transparent
          opacity={0.4}
          sizeAttenuation
        />
      </points>

      {/* Core shield face mark */}
      <mesh position={[0, 0, 0]}>
        <icosahedronGeometry args={[0.15, 0]} />
        <meshStandardMaterial
          color="#00F5FF"
          emissive="#00F5FF"
          emissiveIntensity={1.5}
          metalness={0.8}
          roughness={0.1}
        />
      </mesh>
    </group>
  )
}
