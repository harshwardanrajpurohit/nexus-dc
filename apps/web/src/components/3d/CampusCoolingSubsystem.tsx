import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../../store'

export default function CampusCoolingSubsystem() {
  const { fetchAndSetSelectedAsset } = useStore()
  const fansGroupRef = useRef<THREE.Group>(null)

  // Rotate cooling tower fan impellers
  useFrame((_, delta) => {
    if (fansGroupRef.current) {
      fansGroupRef.current.children.forEach((cell) => {
        cell.rotation.y += delta * 8.0
      })
    }
  })

  return (
    <group>
      {/* ========================================================================= */}
      {/* 1. 30,000-TON CENTRAL COOLING PLANT (Lower Right, [340, 0, 180])          */}
      {/* ========================================================================= */}
      <group
        position={[340, 0, 180]}
        onClick={(e) => {
          e.stopPropagation()
          fetchAndSetSelectedAsset('CAMPUS-COOLING-PLANT')
        }}
      >
        {/* Main Plant Building Shell */}
        <group position={[0, 7.0, 0]}>
          {/* Concrete Base */}
          <mesh position={[0, -4.9, 0]} castShadow receiveShadow>
            <boxGeometry args={[130, 4.2, 85]} />
            <meshPhysicalMaterial color="#334155" roughness={0.9} metalness={0.1} />
          </mesh>
          {/* Corrugated Upper */}
          <mesh position={[0, 2.1, 0]} castShadow receiveShadow>
            <boxGeometry args={[129.8, 9.8, 84.8]} />
            <meshPhysicalMaterial color="#1e293b" roughness={0.6} metalness={0.5} clearcoat={0.1} />
          </mesh>
          {/* Roof Parapet */}
          <mesh position={[0, 7.6, 0]} castShadow>
            <boxGeometry args={[130, 1.2, 85]} />
            <meshPhysicalMaterial color="#334155" roughness={0.9} />
          </mesh>
          {/* Roof Membrane */}
          <mesh position={[0, 7.0, 0]} receiveShadow>
            <boxGeometry args={[128, 0.2, 83]} />
            <meshPhysicalMaterial color="#94a3b8" roughness={0.95} metalness={0.0} />
          </mesh>
        </group>
        {/* Louver Bands on sides */}
        {[-30, 0, 30].map((lx, li) => (
          <mesh key={`chiller-louver-${li}`} position={[lx, 7.0, 42.6]}>
            <boxGeometry args={[20, 8, 0.4]} />
            <meshPhysicalMaterial color="#0f172a" roughness={0.8} />
          </mesh>
        ))}
        {/* Thick supply/return pipe penetrations heading into ground */}
        {[-45, 45].map((px, pi) => (
          <group key={`chiller-pipe-${pi}`} position={[px, 3, 43]}>
            <mesh rotation={[Math.PI/2, 0, 0]}>
              <cylinderGeometry args={[1.5, 1.5, 6, 16]} />
              <meshPhysicalMaterial color="#94a3b8" metalness={0.9} roughness={0.4} />
            </mesh>
          </group>
        ))}
        {/* Subtle Sign (non-luminous in Realism mode unless engineering mode is on... we don't have engineering mode explicitly here, so we will keep it dim) */}
        <mesh position={[0, 12.0, 42.8]}>
          <planeGeometry args={[95, 2.5]} />
          <meshPhysicalMaterial color="#0ea5e9" emissive="#0ea5e9" emissiveIntensity={0.2} roughness={0.2} />
        </mesh>
      </group>

      {/* ========================================================================= */}
      {/* 2. 18-CELL COOLING TOWERS & FILTERED WATER STORAGE (Far Right, [470, 0, 180]) */}
      {/* ========================================================================= */}
      <group
        position={[470, 0, 180]}
        onClick={(e) => {
          e.stopPropagation()
          fetchAndSetSelectedAsset('CAMPUS-WATER-INFRASTRUCTURE')
        }}
      >
        {/* 2x Huge Circular Filtered Water Storage Tanks */}
        {[-32, 32].map((tZ, ti) => (
          <group key={`tank-${ti}`} position={[35, 10, tZ]}>
            <mesh castShadow receiveShadow>
              <cylinderGeometry args={[16, 16, 20, 32]} />
              <meshPhysicalMaterial color="#e2e8f0" metalness={0.6} roughness={0.3} clearcoat={0.5} />
            </mesh>
            {/* Top Dome Ring */}
            <mesh position={[0, 10.2, 0]}>
              <cylinderGeometry args={[15, 16, 0.5, 32]} />
              <meshPhysicalMaterial color="#334155" metalness={0.8} roughness={0.5} />
            </mesh>
            {/* Tank Structural Ribs */}
            {[0, -5, 5].map((ry, ri) => (
              <mesh key={`rib-${ri}`} position={[0, ry, 0]}>
                <cylinderGeometry args={[16.2, 16.2, 0.3, 32]} />
                <meshPhysicalMaterial color="#cbd5e1" metalness={0.7} roughness={0.3} />
              </mesh>
            ))}
          </group>
        ))}

        {/* 18-Cell Industrial Cooling Tower Lineup (2 Rows of 9 Cells) */}
        <group position={[-25, 0, 0]}>
          {Array.from({ length: 18 }).map((_, i) => {
            const cellX = (i % 2 - 0.5) * 22
            const cellZ = (Math.floor(i / 2) - 4) * 14
            return (
              <group key={`cell-${i}`} position={[cellX, 7, cellZ]}>
                {/* Concrete Housekeeping Pad */}
                <mesh position={[0, -7.2, 0]} receiveShadow>
                  <boxGeometry args={[19, 0.4, 13]} />
                  <meshPhysicalMaterial color="#475569" roughness={0.9} />
                </mesh>
                {/* Louvered Box Body */}
                <mesh castShadow receiveShadow>
                  <boxGeometry args={[18, 14, 12]} />
                  <meshPhysicalMaterial color="#334155" metalness={0.6} roughness={0.4} clearcoat={0.1} />
                </mesh>
                {/* Physical Louvers (Side Intakes) */}
                <mesh position={[0, 0, 6.1]}>
                  <boxGeometry args={[16, 12, 0.2]} />
                  <meshPhysicalMaterial color="#0f172a" roughness={0.8} />
                </mesh>
                <mesh position={[0, 0, -6.1]}>
                  <boxGeometry args={[16, 12, 0.2]} />
                  <meshPhysicalMaterial color="#0f172a" roughness={0.8} />
                </mesh>
                {/* Top Fan Cowling */}
                <mesh position={[0, 7.5, 0]}>
                  <cylinderGeometry args={[4.2, 4.8, 1.8, 20]} />
                  <meshPhysicalMaterial color="#1e293b" metalness={0.9} roughness={0.4} />
                </mesh>
              </group>
            )
          })}
        </group>

        {/* Rotating Fan Blades Container */}
        <group ref={fansGroupRef} position={[-25, 14.8, 0]}>
          {Array.from({ length: 18 }).map((_, i) => {
            const cellX = (i % 2 - 0.5) * 22
            const cellZ = (Math.floor(i / 2) - 4) * 14
            return (
              <mesh key={`fan-blade-${i}`} position={[cellX, 0, cellZ]}>
                <boxGeometry args={[7.8, 0.12, 1.2]} />
                <meshPhysicalMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
              </mesh>
            )
          })}
        </group>
      </group>
    </group>
  )
}
