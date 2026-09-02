import { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Grid } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../../store'
import type { SelectedAssetInfo } from '../../store'

export default function DataHallInteriors() {
  const {
    fetchAndSetSelectedAsset,
    telemetry,
    scenario,
    cutaway,
    openRackId,
    extendedTrayRackId,
    setSelectedAsset,
  } = useStore()
  const { underfloorRaised, showOverheadTrays } = cutaway

  const rackMeshRef = useRef<THREE.InstancedMesh>(null)
  const serverBladeMeshRef = useRef<THREE.InstancedMesh>(null)
  const ledMeshRef = useRef<THREE.InstancedMesh>(null)
  const torSwitchMeshRef = useRef<THREE.InstancedMesh>(null)

  // Layout Racks across Building A (Compute) and Building B (AI GPU)
  const racksData = useMemo(() => {
    const list: {
      matrix: THREE.Matrix4;
      position: THREE.Vector3;
      id: string;
      name: string;
      building: 'A' | 'B';
      row: number;
      col: number;
      isGpu: boolean;
    }[] = []

    // 1. Building A (Compute Hall): 8 long rows, 14 racks per row = 112 racks visible in cutaway
    const buildingACenter = new THREE.Vector3(-180, 1.0, 120)
    for (let r = 0; r < 8; r++) {
      const rowZ = buildingACenter.z + (r - 3.5) * 11

      for (let c = 0; c < 14; c++) {
        const rackX = buildingACenter.x + (c - 6.5) * 6.5
        const pos = new THREE.Vector3(rackX, 4.4, rowZ)
        const mat = new THREE.Matrix4().setPosition(pos)

        list.push({
          matrix: mat,
          position: pos,
          id: `CAMPUS-GIGA-01-BLD3-H3-ROW-CPU${r + 1}-RK${c + 1}`,
          name: `OCP Enterprise Compute Rack R${r + 1}-K${c + 1}`,
          building: 'A',
          row: r + 1,
          col: c + 1,
          isGpu: false,
        })
      }
    }

    // 2. Building B (AI GPU Hall): 8 long rows, 14 racks per row = 112 GB200 racks visible in cutaway
    const buildingBCenter = new THREE.Vector3(180, 1.0, 120)
    for (let r = 0; r < 8; r++) {
      const rowZ = buildingBCenter.z + (r - 3.5) * 11

      for (let c = 0; c < 14; c++) {
        const rackX = buildingBCenter.x + (c - 6.5) * 6.5
        const pos = new THREE.Vector3(rackX, 4.4, rowZ)
        const mat = new THREE.Matrix4().setPosition(pos)

        list.push({
          matrix: mat,
          position: pos,
          id: `CAMPUS-GIGA-01-BLD1-H1-ROW-GPU${r + 1}-RK${c + 1}`,
          name: `GB200 NVL72 Liquid GPU Rack R${r + 1}-K${c + 1}`,
          building: 'B',
          row: r + 1,
          col: c + 1,
          isGpu: true,
        })
      }
    }

    return list
  }, [])

  const totalRacks = racksData.length

  // Update instance matrices on mount
  useEffect(() => {
    if (rackMeshRef.current && serverBladeMeshRef.current && ledMeshRef.current && torSwitchMeshRef.current) {
      racksData.forEach((item, idx) => {
        rackMeshRef.current!.setMatrixAt(idx, item.matrix)

        const bladePos = item.position.clone().add(new THREE.Vector3(0, -0.2, 0.1))
        const bladeMat = new THREE.Matrix4().setPosition(bladePos)
        serverBladeMeshRef.current!.setMatrixAt(idx, bladeMat)

        const torPos = item.position.clone().add(new THREE.Vector3(0, 3.2, 0.15))
        const torMat = new THREE.Matrix4().setPosition(torPos)
        torSwitchMeshRef.current!.setMatrixAt(idx, torMat)

        const ledPos = item.position.clone().add(new THREE.Vector3(-1.7, 0, 1.35))
        const ledMat = new THREE.Matrix4().setPosition(ledPos)
        ledMeshRef.current!.setMatrixAt(idx, ledMat)
      })

      rackMeshRef.current.instanceMatrix.needsUpdate = true
      serverBladeMeshRef.current.instanceMatrix.needsUpdate = true
      torSwitchMeshRef.current.instanceMatrix.needsUpdate = true
      ledMeshRef.current.instanceMatrix.needsUpdate = true
    }
  }, [racksData])

  // Handle Rack Click Selection (Fetch from Backend API)
  const handleRackClick = (event: any) => {
    event.stopPropagation()
    const instanceId = event.instanceId
    if (instanceId !== undefined && racksData[instanceId]) {
      const rk = racksData[instanceId]
      fetchAndSetSelectedAsset(rk.id)
    }
  }

  // Animate status LEDs with realistic server activity
  useFrame(({ clock }) => {
    if (ledMeshRef.current) {
      const t = clock.getElapsedTime()
      const color = new THREE.Color()

      for (let i = 0; i < totalRacks; i++) {
        const item = racksData[i]
        // Check real backend status (via scenario and telemetry global faults)
        const isFaultRow = telemetry.cdu_status === 'CRITICAL ALARM' && telemetry.cdu_fault_row === item.row && item.isGpu
        const isFaulty = isFaultRow

        if (isFaulty) {
          const blink = Math.sin(t * 12 + i) > 0
          color.set(blink ? '#ef4444' : '#7f1d1d')
        } else if (item.isGpu) {
          const blink = Math.sin(t * 5 + i * 0.4) > 0.1
          color.set(blink ? '#00e5ff' : '#0284c7')
        } else {
          const blink = Math.sin(t * 3 + i * 0.6) > -0.2
          color.set(blink ? '#22c55e' : '#eab308')
        }
        ledMeshRef.current.setColorAt(i, color)
      }
      ledMeshRef.current.instanceColor!.needsUpdate = true
    }
  })

  const activeOpenRack = racksData.find((r) => r.id === openRackId)
  const activeExtendedTray = racksData.find((r) => r.id === extendedTrayRackId)
  const floorY = underfloorRaised ? 4.5 : 1.0

  return (
    <group>
      {/* 1. Raised Floor Grid System (Building A & Building B) */}
      <group position={[0, floorY, 0]}>
        {/* Building A Floor Slab (Base) */}
        <mesh position={[-180, -0.05, 120]} receiveShadow>
          <boxGeometry args={[218, 0.1, 126]} />
          <meshStandardMaterial color="#334155" roughness={0.9} metalness={0.1} />
        </mesh>
        
        {/* Building A Realistic 600x600 Raised Floor Grid */}
        <Grid
          position={[-180, 0.0, 120]}
          args={[218, 126]}
          cellSize={0.6}
          cellThickness={1.0}
          cellColor="#94a3b8"
          sectionSize={0.6}
          sectionThickness={1.5}
          sectionColor="#475569"
          fadeDistance={150}
        />
        
        {/* Green Safety Walkways (Building A) */}
        <mesh position={[-180, 0.01, 120]}>
          <planeGeometry args={[200, 3.2]} />
          <meshStandardMaterial color="#22c55e" roughness={0.5} transparent opacity={0.6} />
        </mesh>

        {/* Building B Floor Slab (Base) */}
        <mesh position={[180, -0.05, 120]} receiveShadow>
          <boxGeometry args={[218, 0.1, 126]} />
          <meshStandardMaterial color="#334155" roughness={0.9} metalness={0.1} />
        </mesh>

        {/* Building B Realistic 600x600 Raised Floor Grid */}
        <Grid
          position={[180, 0.0, 120]}
          args={[218, 126]}
          cellSize={0.6}
          cellThickness={1.0}
          cellColor="#94a3b8"
          sectionSize={0.6}
          sectionThickness={1.5}
          sectionColor="#475569"
          fadeDistance={150}
        />

        {/* Green Safety Walkways (Building B) */}
        <mesh position={[180, 0.01, 120]}>
          <planeGeometry args={[200, 3.2]} />
          <meshStandardMaterial color="#22c55e" roughness={0.5} transparent opacity={0.6} />
        </mesh>
      </group>

      {/* 2. Instanced 19" / 21" Server Racks */}
      <group>
        {/* Main Cabinet Body */}
        <instancedMesh
          ref={rackMeshRef}
          args={[undefined, undefined, totalRacks]}
          onClick={handleRackClick}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[3.6, 7.6, 2.6]} />
          <meshPhysicalMaterial color="#0f172a" metalness={0.95} roughness={0.5} />
        </instancedMesh>
      </group>

      {/* Server Blade Inserts */}
      <instancedMesh ref={serverBladeMeshRef} args={[undefined, undefined, totalRacks]} castShadow>
        <boxGeometry args={[3.3, 6.2, 2.4]} />
        <meshPhysicalMaterial color="#1e293b" metalness={0.8} roughness={0.3} />
      </instancedMesh>

      {/* Top-of-Rack Switches */}
      <instancedMesh ref={torSwitchMeshRef} args={[undefined, undefined, totalRacks]}>
        <boxGeometry args={[3.2, 0.6, 2.2]} />
        <meshPhysicalMaterial color="#020617" metalness={0.95} roughness={0.1} />
      </instancedMesh>

      {/* Front Status LED Activity Strips */}
      <instancedMesh ref={ledMeshRef} args={[undefined, undefined, totalRacks]}>
        <boxGeometry args={[0.08, 6.8, 0.08]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      {/* 3. Interactive Open Rack Door Animation */}
      {activeOpenRack && (
        <group position={[activeOpenRack.position.x - 1.8, activeOpenRack.position.y, activeOpenRack.position.z + 1.3]}>
          <mesh rotation={[0, -Math.PI / 1.8, 0]}>
            <boxGeometry args={[3.5, 7.4, 0.08]} />
            <meshStandardMaterial color="#0f172a" metalness={0.9} wireframe />
          </mesh>
        </group>
      )}

      {/* 4. Interactive Extended Server Tray (Slide Out) */}
      {activeExtendedTray && (
        <group position={[activeExtendedTray.position.x, activeExtendedTray.position.y + 0.4, activeExtendedTray.position.z + 2.6]}>
          <mesh castShadow>
            <boxGeometry args={[3.2, 0.8, 3.6]} />
            <meshStandardMaterial color="#64748b" metalness={0.85} roughness={0.2} />
          </mesh>
          {/* Internal Copper Cold Plate Die */}
          <mesh position={[0, 0.45, 0]}>
            <boxGeometry args={[1.8, 0.15, 1.8]} />
            <meshStandardMaterial
              color="#b45309"
              emissive="#d97706"
              emissiveIntensity={0.3}
              metalness={0.95}
              roughness={0.1}
            />
          </mesh>
        </group>
      )}

      {/* 5. Cold Aisle Containment Modules (Building A & Building B) */}
      {[-180, 180].map((bX, bi) => (
        <group key={`containment-bldg-${bi}`}>
          {Array.from({ length: 4 }).map((_, ai) => {
            const aisleZ = 120 + (ai - 1.5) * 22
            return (
              <group key={`aisle-${bi}-${ai}`}>
                {/* Transparent Polycarbonate Ceiling Canopy */}
                <mesh position={[bX, 8.4, aisleZ]}>
                  <boxGeometry args={[95, 0.1, 5.2]} />
                  <meshPhysicalMaterial
                    color="#38bdf8"
                    transmission={0.85}
                    transparent
                    opacity={0.6}
                    roughness={0.1}
                    ior={1.4}
                  />
                </mesh>
                {/* Sliding Glass Doors at Aisle Ends */}
                <mesh position={[bX - 48, 4.4, aisleZ]}>
                  <boxGeometry args={[0.15, 7.8, 5.0]} />
                  <meshPhysicalMaterial color="#00e5ff" transmission={0.8} transparent opacity={0.8} />
                </mesh>
                <mesh position={[bX + 48, 4.4, aisleZ]}>
                  <boxGeometry args={[0.15, 7.8, 5.0]} />
                  <meshPhysicalMaterial color="#00e5ff" transmission={0.8} transparent opacity={0.8} />
                </mesh>
              </group>
            )
          })}
        </group>
      ))}

      {/* 5.5 High-Bay LED Aisle Lighting (Building A & Building B) */}
      <group>
        {[-180, 180].map((bX, bi) =>
          Array.from({ length: 9 }).map((_, ai) => {
            const aisleZ = 120 + (ai - 4) * 11
            return (
              <group key={`light-${bi}-${ai}`}>
                {/* Long continuous LED strip above the cold aisle */}
                <mesh position={[bX, 12, aisleZ]}>
                  <boxGeometry args={[95, 0.2, 0.6]} />
                  <meshPhysicalMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1.2} />
                </mesh>
                {/* Fixture casing */}
                <mesh position={[bX, 12.15, aisleZ]}>
                  <boxGeometry args={[95.2, 0.1, 0.8]} />
                  <meshPhysicalMaterial color="#cbd5e1" metalness={0.9} roughness={0.3} />
                </mesh>
              </group>
            )
          })
        )}
      </group>

      {/* 6. Row-End Coolant Distribution Units (CDUs in Building B) */}
      <group position={[180, 1.0, 120]}>
        {Array.from({ length: 8 }).map((_, r) => {
          const rowZ = (r - 3.5) * 11
          const cduX = 52
          const isFaulty = scenario === 'CDU_FAILURE' && r === 1

          return (
            <group
              key={`cdu-unit-${r}`}
              position={[cduX, 4.4, rowZ]}
              onClick={(e) => {
                e.stopPropagation()
                const assetInfo: SelectedAssetInfo = {
                  id: `CDU-DC-B-ROW-${r + 1}`,
                  name: `Data Center B Row ${r + 1} Liquid Coolant Distribution Unit (CDU)`,
                  type: 'cdu',
                  status: isFaulty ? 'CRITICAL' : 'OPTIMAL',
                  powerKw: 18.5,
                  tempC: isFaulty ? 74.2 : 23.8,
                  coolantFlowLpm: isFaulty ? 780 : 3800,
                  location: `Building B AI GPU Hall, Row ${r + 1} Header`,
                  details: {
                    'Heat Exchanger': 'Liquid-to-Liquid Brazed Plate (3,800 LPM Capacity)',
                    'Primary Loop': isFaulty ? '260 LPM Chilled Water (Flow Alarm)' : '1,950 LPM Chilled Water',
                    'Secondary Loop': isFaulty ? '780 LPM Dielectric Fluid (Cavitation)' : '3,800 LPM Dielectric Fluid',
                    'Operating Pressure': isFaulty ? '1.5 Bar (Low Pressure Alarm)' : '4.2 Bar Nominal',
                  },
                }
                setSelectedAsset(assetInfo)
              }}
            >
              <mesh castShadow receiveShadow>
                <boxGeometry args={[3.8, 8.4, 3.4]} />
                <meshPhysicalMaterial
                  color={isFaulty ? '#7f1d1d' : '#334155'}
                  roughness={0.2}
                  metalness={0.9}
                  clearcoat={0.2}
                />
              </mesh>
              {/* CDU Touchscreen Diagnostic Display */}
              <mesh position={[0, 1.8, 1.72]}>
                <planeGeometry args={[2.4, 1.5]} />
                <meshBasicMaterial color={isFaulty ? '#ef4444' : '#00e5ff'} />
              </mesh>
            </group>
          )
        })}
      </group>

      {/* 7. Overhead Cable Ladders & Fiber Trays */}
      {showOverheadTrays && (
        <group>
          {[-180, 180].map((bX, bi) =>
            Array.from({ length: 8 }).map((_, r) => {
              const rowZ = 120 + (r - 3.5) * 11
              return (
                <group key={`tray-${bi}-${r}`} position={[bX, 9.8, rowZ]}>
                  {/* Yellow Fiber Duct */}
                  <mesh position={[0, 0.6, 0]}>
                    <boxGeometry args={[96, 0.25, 0.8]} />
                    <meshPhysicalMaterial color="#eab308" roughness={0.3} metalness={0.2} clearcoat={0.1} />
                  </mesh>
                  {/* Steel Cable Tray */}
                  <mesh position={[0, 0, 0]}>
                    <boxGeometry args={[96, 0.15, 1.4]} />
                    <meshPhysicalMaterial color="#64748b" metalness={0.85} roughness={0.5} />
                  </mesh>
                  {/* Copper Power Busway */}
                  <mesh position={[0, -0.6, -0.8]}>
                    <boxGeometry args={[96, 0.3, 0.5]} />
                    <meshPhysicalMaterial color="#d97706" metalness={0.95} roughness={0.2} />
                  </mesh>
                  {/* Busway Drops to Racks */}
                  {Array.from({ length: 14 }).map((_, c) => (
                    <mesh key={`drop-${c}`} position={[(c - 6.5) * 6.5, -2.6, -0.8]}>
                      <cylinderGeometry args={[0.08, 0.08, 4.0, 8]} />
                      <meshPhysicalMaterial color="#1e293b" metalness={0.8} roughness={0.3} />
                    </mesh>
                  ))}
                </group>
              )
            })
          )}
        </group>
      )}

      {/* 8. Structural Ceiling Steel (I-Beams & Trusses) */}
      <group position={[0, 14.5, 0]}>
        {[-180, 180].map((bX, bi) => (
          <group key={`steel-bldg-${bi}`}>
            {/* Main Long Span Girders */}
            {[-40, 0, 40].map((gZ, gi) => (
              <mesh key={`girder-${gi}`} position={[bX, 0, 120 + gZ]} castShadow>
                <boxGeometry args={[210, 0.8, 0.4]} />
                <meshPhysicalMaterial color="#1e293b" roughness={0.8} metalness={0.6} />
              </mesh>
            ))}
            {/* Cross Trusses */}
            {Array.from({ length: 11 }).map((_, ti) => {
              const tX = bX + (ti - 5) * 18
              return (
                <mesh key={`truss-${ti}`} position={[tX, -0.4, 120]} castShadow>
                  <boxGeometry args={[0.3, 0.6, 120]} />
                  <meshPhysicalMaterial color="#1e293b" roughness={0.8} metalness={0.6} />
                </mesh>
              )
            })}
          </group>
        ))}
      </group>
    </group>
  )
}
