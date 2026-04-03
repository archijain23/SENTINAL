import React, { useRef, useMemo, useCallback } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'

const NODE_TYPES = {
  server:  { color: '#00F5FF', size: 0.18, label: 'SERVER'   },
  gateway: { color: '#FFB700', size: 0.22, label: 'GATEWAY'  },
  client:  { color: '#9B5DE5', size: 0.12, label: 'CLIENT'   },
  firewall:{ color: '#00FF88', size: 0.20, label: 'FIREWALL' },
  attacker:{ color: '#FF3D71', size: 0.16, label: 'THREAT'   },
}

const NODES = [
  // Core infrastructure
  { id: 0, type: 'gateway',  pos: [0, 0, 0]          },
  { id: 1, type: 'firewall', pos: [-1.8, 0, 0]        },
  { id: 2, type: 'server',   pos: [1.8, 0.6, 0]       },
  { id: 3, type: 'server',   pos: [1.8, -0.6, 0]      },
  { id: 4, type: 'client',   pos: [-1.2, 1.4, 0.4]    },
  { id: 5, type: 'client',   pos: [-1.2, -1.4, 0.4]   },
  { id: 6, type: 'client',   pos: [0.8, 1.8, 0.2]     },
  // Attack sources
  { id: 7, type: 'attacker', pos: [-3.2, 0.8, 0.5]   },
  { id: 8, type: 'attacker', pos: [-3.2, -0.8, -0.3]  },
  { id: 9, type: 'attacker', pos: [-2.8, 0, 0.8]      },
]

const EDGES = [
  { from: 7, to: 1, attack: true  },
  { from: 8, to: 1, attack: true  },
  { from: 9, to: 1, attack: true  },
  { from: 1, to: 0, attack: false },
  { from: 0, to: 2, attack: false },
  { from: 0, to: 3, attack: false },
  { from: 4, to: 1, attack: false },
  { from: 5, to: 1, attack: false },
  { from: 6, to: 0, attack: false },
]

function NodeMesh({ node, time }) {
  const meshRef  = useRef()
  const glowRef  = useRef()
  const cfg      = NODE_TYPES[node.type]
  const isAttack = node.type === 'attacker'

  useFrame((state) => {
    if (!meshRef.current) return
    const t = state.clock.elapsedTime
    // Float animation per node
    meshRef.current.position.y = node.pos[1] + Math.sin(t * 0.8 + node.id) * 0.06
    // Attack nodes blink
    if (isAttack && glowRef.current) {
      glowRef.current.material.opacity = 0.3 + Math.abs(Math.sin(t * 2.5 + node.id)) * 0.5
    }
  })

  return (
    <group position={node.pos}>
      {/* Outer glow ring */}
      <mesh ref={glowRef}>
        <ringGeometry args={[cfg.size * 1.4, cfg.size * 2.0, 32]} />
        <meshBasicMaterial
          color={cfg.color}
          transparent
          opacity={0.15}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Core node */}
      <mesh ref={meshRef}>
        <octahedronGeometry args={[cfg.size, 0]} />
        <meshStandardMaterial
          color={cfg.color}
          emissive={cfg.color}
          emissiveIntensity={isAttack ? 0.8 : 0.4}
          metalness={0.6}
          roughness={0.2}
        />
      </mesh>
    </group>
  )
}

function PacketParticle({ from, to, attack, speed, offset }) {
  const ref    = useRef()
  const fromV  = useMemo(() => new THREE.Vector3(...from), [from])
  const toV    = useMemo(() => new THREE.Vector3(...to),   [to])
  const color  = attack ? '#FF3D71' : '#00F5FF'

  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = ((clock.elapsedTime * speed + offset) % 1)
    ref.current.position.lerpVectors(fromV, toV, t)
    ref.current.material.opacity = Math.sin(t * Math.PI)
  })

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.04, 8, 8]} />
      <meshBasicMaterial color={color} transparent opacity={1} />
    </mesh>
  )
}

export default function NetworkTopology() {
  const groupRef = useRef()

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    groupRef.current.rotation.y = Math.sin(clock.elapsedTime * 0.12) * 0.3
    groupRef.current.rotation.x = Math.sin(clock.elapsedTime * 0.08) * 0.08
  })

  const edgePoints = useMemo(() =>
    EDGES.map(edge => ([
      new THREE.Vector3(...NODES[edge.from].pos),
      new THREE.Vector3(...NODES[edge.to].pos),
    ])),
  [])

  return (
    <group ref={groupRef}>
      {/* Edges */}
      {EDGES.map((edge, i) => (
        <Line
          key={i}
          points={edgePoints[i]}
          color={edge.attack ? '#FF3D71' : 'rgba(0,245,255,0.3)'}
          lineWidth={edge.attack ? 1.5 : 0.8}
          transparent
          opacity={edge.attack ? 0.6 : 0.3}
          dashed={edge.attack}
          dashSize={0.15}
          gapSize={0.08}
        />
      ))}

      {/* Nodes */}
      {NODES.map(node => (
        <NodeMesh key={node.id} node={node} />
      ))}

      {/* Animated packets */}
      {EDGES.map((edge, i) => (
        <PacketParticle
          key={`packet-${i}`}
          from={NODES[edge.from].pos}
          to={NODES[edge.to].pos}
          attack={edge.attack}
          speed={edge.attack ? 0.4 : 0.3}
          offset={i * 0.3}
        />
      ))}

      {/* Ambient particle field */}
      <ParticleField />
    </group>
  )
}

function ParticleField() {
  const ref = useRef()
  const { positions, colors } = useMemo(() => {
    const count = 300
    const positions = new Float32Array(count * 3)
    const colors    = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 10
      positions[i * 3 + 1] = (Math.random() - 0.5) * 6
      positions[i * 3 + 2] = (Math.random() - 0.5) * 4
      // Mostly cyber-blue, some red for threat ambiance
      const isRed = Math.random() < 0.1
      colors[i * 3]     = isRed ? 1.0 : 0.0
      colors[i * 3 + 1] = isRed ? 0.24 : 0.96
      colors[i * 3 + 2] = isRed ? 0.44 : 1.0
    }
    return { positions, colors }
  }, [])

  useFrame(({ clock }) => {
    if (!ref.current) return
    ref.current.rotation.y = clock.elapsedTime * 0.02
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color"    args={[colors, 3]}    />
      </bufferGeometry>
      <pointsMaterial size={0.025} vertexColors transparent opacity={0.6} sizeAttenuation />
    </points>
  )
}
