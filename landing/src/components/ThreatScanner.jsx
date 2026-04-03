import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const BLIPS = [
  { angle: 0.8,  radius: 0.7, severity: 'high'   },
  { angle: 2.1,  radius: 1.1, severity: 'medium'  },
  { angle: 3.5,  radius: 0.9, severity: 'low'     },
  { angle: 4.8,  radius: 1.3, severity: 'high'    },
  { angle: 5.6,  radius: 0.5, severity: 'medium'  },
]

const SEVERITY_COLORS = {
  high:   '#FF3D71',
  medium: '#FFB700',
  low:    '#00F5FF',
}

// Pure Three.js ring line — no Drei dependency
function RingLine({ radius, opacity }) {
  const geo = useMemo(() => {
    const pts = []
    const segments = 64
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2
      pts.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0))
    }
    const g = new THREE.BufferGeometry().setFromPoints(pts)
    return g
  }, [radius])

  return (
    <line_ geometry={geo}>
      <lineBasicMaterial color="#00F5FF" transparent opacity={opacity} />
    </line_>
  )
}

// Pure Three.js dashed line segment — no Drei dependency
function DashedLine({ points, opacity }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints(points)
    g.computeBoundingSphere()
    return g
  }, [points])

  return (
    <line_ geometry={geo}>
      <lineDashedMaterial
        color="#00F5FF"
        transparent
        opacity={opacity}
        dashSize={0.1}
        gapSize={0.05}
        scale={1}
      />
    </line_>
  )
}

// Solid line segment
function SolidLine({ points, color, opacity }) {
  const geo = useMemo(() => {
    return new THREE.BufferGeometry().setFromPoints(points)
  }, [points])

  return (
    <line_ geometry={geo}>
      <lineBasicMaterial color={color} transparent opacity={opacity} />
    </line_>
  )
}

export default function ThreatScanner({ position = [0, 0, 0] }) {
  const sweepRef  = useRef()
  const blipRefs  = useRef([])

  const ringRadii = [0.5, 0.9, 1.3, 1.7]

  // Crosshair points
  const crosshairs = useMemo(() => [
    [new THREE.Vector3(-1.8, 0, 0), new THREE.Vector3(1.8, 0, 0)],
    [new THREE.Vector3(0, -1.8, 0), new THREE.Vector3(0, 1.8, 0)],
  ], [])

  // Sweep arm points
  const sweepPoints = useMemo(() => [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(1.75, 0, 0),
  ], [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const angle = t * 1.2

    if (sweepRef.current) {
      sweepRef.current.rotation.z = -angle
    }

    BLIPS.forEach((blip, i) => {
      const el = blipRefs.current[i]
      if (!el) return
      const normalizedAngle = ((angle % (Math.PI * 2)) - blip.angle + Math.PI * 2) % (Math.PI * 2)
      const proximity = Math.min(normalizedAngle, Math.PI * 2 - normalizedAngle)
      const intensity  = Math.max(0, 1 - proximity / 0.6)
      el.material.opacity = 0.15 + intensity * 0.85
      const scale = 1 + intensity * 0.5
      el.scale.setScalar(scale)
    })
  })

  return (
    <group position={position} rotation={[Math.PI * 0.5, 0, 0]}>
      {/* Radar rings */}
      {ringRadii.map((r, i) => (
        <RingLine key={r} radius={r} opacity={0.15 + i * 0.05} />
      ))}

      {/* Crosshairs */}
      {crosshairs.map((pts, i) => (
        <DashedLine key={i} points={pts} opacity={0.1} />
      ))}

      {/* Sweep arm */}
      <group ref={sweepRef}>
        <SolidLine points={sweepPoints} color="#00F5FF" opacity={0.9} />
        <mesh>
          <cylinderGeometry args={[0, 1.75, 0.01, 32, 1, false, 0, Math.PI * 0.3]} />
          <meshBasicMaterial
            color="#00F5FF"
            transparent
            opacity={0.06}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* Threat blips */}
      {BLIPS.map((blip, i) => {
        const x = Math.cos(blip.angle) * blip.radius
        const y = Math.sin(blip.angle) * blip.radius
        return (
          <mesh
            key={i}
            ref={el => { blipRefs.current[i] = el }}
            position={[x, y, 0]}
          >
            <circleGeometry args={[0.06, 16]} />
            <meshBasicMaterial
              color={SEVERITY_COLORS[blip.severity]}
              transparent
              opacity={0.2}
            />
          </mesh>
        )
      })}

      {/* Center hub */}
      <mesh>
        <circleGeometry args={[0.08, 16]} />
        <meshBasicMaterial color="#00F5FF" transparent opacity={0.8} />
      </mesh>
    </group>
  )
}
