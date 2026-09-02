import { useMemo } from 'react'
import * as THREE from 'three'
import { useStore } from '../../store'
import type { SelectedAssetInfo } from '../../store'

export default function CampusTerrain() {
  const { setSelectedAsset } = useStore()

  // Streetlight Pole Locations along campus roadways
  const streetLightPositions = useMemo(() => {
    const list: [number, number, number][] = []
    // Central Spine Boulevard
    for (let x = -320; x <= 320; x += 80) {
      list.push([x, 0, -30])
      list.push([x, 0, 70])
    }
    // South Highway Roadway
    for (let x = -380; x <= 380; x += 95) {
      list.push([x, 0, 240])
    }
    // North Perimeter Road
    for (let x = -320; x <= 320; x += 105) {
      list.push([x, 0, -260])
    }
    return list
  }, [])

  // Procedural Noise Texture Removed - Using Clean PBR Materials for Professional Arch-Viz Look


  return (
    <group>
      {/* 0. Infinite Master Ground Plane (Professional ArchViz Asphalt/Concrete) */}
      <mesh position={[0, -0.6, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[10000, 10000]} />
        <meshPhysicalMaterial color="#1e293b" roughness={0.9} metalness={0.0} clearcoat={0.0} />
      </mesh>

      {/* 1. Master Campus Concrete Foundation Pad */}
      <mesh position={[0, -0.55, 0]} receiveShadow>
        <boxGeometry args={[1800, 0.1, 1400]} />
        <meshPhysicalMaterial color="#2d3748" roughness={0.8} metalness={0.1} clearcoat={0.1} />
      </mesh>

      {/* 2. Concrete Facility Super-Pads (Buildings A, B, C, D, E & Yards) */}
      {/* Data Center Building A Pad (Front Left) */}
      <mesh position={[-180, -0.45, 120]} receiveShadow>
        <boxGeometry args={[230, 0.3, 150]} />
        <meshPhysicalMaterial color="#475569" roughness={0.85} metalness={0.05} clearcoat={0.1} />
      </mesh>

      {/* Data Center Building B Pad (Front Right) */}
      <mesh position={[180, -0.45, 120]} receiveShadow>
        <boxGeometry args={[230, 0.3, 150]} />
        <meshPhysicalMaterial color="#475569" roughness={0.85} metalness={0.05} clearcoat={0.1} />
      </mesh>

      {/* Data Center Building C Pad (Mid Right) */}
      <mesh position={[260, -0.45, -140]} receiveShadow>
        <boxGeometry args={[210, 0.3, 140]} />
        <meshPhysicalMaterial color="#475569" roughness={0.85} metalness={0.05} clearcoat={0.1} />
      </mesh>

      {/* Data Center Building D Pad (Mid Center) */}
      <mesh position={[0, -0.45, -140]} receiveShadow>
        <boxGeometry args={[210, 0.3, 140]} />
        <meshPhysicalMaterial color="#475569" roughness={0.85} metalness={0.05} clearcoat={0.1} />
      </mesh>

      {/* Data Center Building E Pad (Mid Left) */}
      <mesh position={[-260, -0.45, -140]} receiveShadow>
        <boxGeometry args={[210, 0.3, 140]} />
        <meshPhysicalMaterial color="#475569" roughness={0.85} metalness={0.05} clearcoat={0.1} />
      </mesh>

      {/* 3. Specialized Gravel Ballast Yards */}
      {/* Electrical Substation Gravel Pad (Far Left) */}
      <mesh position={[-420, -0.45, 80]} receiveShadow>
        <boxGeometry args={[140, 0.3, 220]} />
        <meshPhysicalMaterial color="#334155" roughness={0.98} metalness={0.0} bumpScale={0.05} />
      </mesh>

      {/* Generator Yard Gravel Pad (Lower Left) */}
      <mesh position={[-400, -0.45, 270]} receiveShadow>
        <boxGeometry args={[160, 0.3, 130]} />
        <meshPhysicalMaterial color="#334155" roughness={0.98} metalness={0.0} />
      </mesh>

      {/* Cooling Plant & Water Infrastructure Pad (Far Right) */}
      <mesh position={[430, -0.45, 180]} receiveShadow>
        <boxGeometry args={[160, 0.3, 260]} />
        <meshPhysicalMaterial color="#475569" roughness={0.85} metalness={0.05} />
      </mesh>

      {/* UPS Building Pad (Center Bottom) */}
      <mesh position={[0, -0.45, 260]} receiveShadow>
        <boxGeometry args={[130, 0.3, 85]} />
        <meshPhysicalMaterial color="#475569" roughness={0.85} metalness={0.05} />
      </mesh>

      {/* 4. Campus Road Network (Asphalt Boulevards & Painted Striping) */}
      {/* Central East-West Spine Boulevard */}
      <group position={[0, -0.4, 20]}>
        <mesh receiveShadow>
          <boxGeometry args={[880, 0.1, 26]} />
          <meshPhysicalMaterial color="#0f172a" roughness={0.7} clearcoat={0.1} />
        </mesh>
        {/* Curbs */}
        <mesh position={[0, 0.1, 13.5]} castShadow receiveShadow>
          <boxGeometry args={[880, 0.2, 1]} />
          <meshPhysicalMaterial color="#64748b" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.1, -13.5]} castShadow receiveShadow>
          <boxGeometry args={[880, 0.2, 1]} />
          <meshPhysicalMaterial color="#64748b" roughness={0.9} />
        </mesh>
        {/* Striping */}
        <mesh position={[0, 0.071, 0]}>
          <boxGeometry args={[860, 0.04, 0.45]} />
          <meshBasicMaterial color="#eab308" toneMapped={false} />
        </mesh>
      </group>

      {/* South Primary Highway (Gate to Utility Yards) */}
      <group position={[0, -0.4, 210]}>
        <mesh receiveShadow>
          <boxGeometry args={[960, 0.1, 28]} />
          <meshPhysicalMaterial color="#0f172a" roughness={0.7} clearcoat={0.1} />
        </mesh>
        <mesh position={[0, 0.071, 0]}>
          <boxGeometry args={[940, 0.04, 0.45]} />
          <meshBasicMaterial color="#eab308" toneMapped={false} />
        </mesh>
      </group>

      {/* North Perimeter Road */}
      <group position={[0, -0.4, -230]}>
        <mesh receiveShadow>
          <boxGeometry args={[820, 0.1, 22]} />
          <meshPhysicalMaterial color="#0f172a" roughness={0.7} clearcoat={0.1} />
        </mesh>
        <mesh position={[0, 0.071, 0]}>
          <boxGeometry args={[800, 0.04, 0.45]} />
          <meshBasicMaterial color="#eab308" toneMapped={false} />
        </mesh>
      </group>

      {/* North-South Connecting Interchanges */}
      {[-330, -110, 110, 330].map((rX, ri) => (
        <group key={`road-ns-${ri}`} position={[rX, -0.4, -5]}>
          <mesh receiveShadow>
            <boxGeometry args={[24, 0.1, 450]} />
            <meshPhysicalMaterial color="#0f172a" roughness={0.7} clearcoat={0.1} />
          </mesh>
          <mesh position={[0, 0.071, 0]}>
            <boxGeometry args={[0.45, 0.04, 430]} />
            <meshBasicMaterial color="#eab308" toneMapped={false} />
          </mesh>
        </group>
      ))}

      {/* 5. Main Campus Security Gate & Guardhouse (South Center) */}
      <group
        position={[0, 0, 330]}
        onClick={(e) => {
          e.stopPropagation()
          const assetInfo: SelectedAssetInfo = {
            id: 'CAMPUS-SECURITY-GATE',
            name: 'Hyperscale Main Security Access Portal & Guardhouse',
            type: 'building',
            status: 'OPTIMAL',
            location: 'South Campus Primary Logistics Portal',
            details: {
              'Defense Protocol': 'Tier IV Defense-in-Depth Campus Security',
              'Vehicle Screening': 'Automated Under-Vehicle Laser Inspection + RFID Tagging',
              'Barriers': 'Anti-Ram Hydraulic Wedge Vehicle Barriers (K12 Rated)',
              'Surveillance': '360° Laser PTZ Thermal Perimeter Array',
              'Access Rate': '24/7 Security Operations & Logistics Dispatch',
            },
          }
          setSelectedAsset(assetInfo)
        }}
      >
        {/* Guardhouse Main Building */}
        <mesh position={[0, 4.0, 0]} castShadow receiveShadow>
          <boxGeometry args={[24, 8, 14]} />
          <meshStandardMaterial color="#1e293b" roughness={0.3} metalness={0.7} />
        </mesh>
        {/* Guardhouse Tinted Viewing Windows */}
        <mesh position={[0, 4.2, 7.1]}>
          <planeGeometry args={[20, 4.5]} />
          <meshPhysicalMaterial color="#38bdf8" transmission={0.7} roughness={0.1} />
        </mesh>

        {/* Dual Anti-Ram Hydraulic Boom Gates */}
        {[-18, 18].map((gateX, gi) => (
          <group key={`boom-gate-${gi}`} position={[gateX, 1.2, 0]}>
            <mesh position={[0, 1.2, 0]}>
              <cylinderGeometry args={[0.4, 0.5, 2.4, 12]} />
              <meshStandardMaterial color="#0f172a" metalness={0.9} />
            </mesh>
            <mesh position={[gi === 0 ? 6 : -6, 1.8, 0]} rotation={[0, 0, gi === 0 ? 0.05 : -0.05]}>
              <cylinderGeometry args={[0.15, 0.15, 12, 12]} />
              <meshStandardMaterial color="#ef4444" roughness={0.2} />
            </mesh>
          </group>
        ))}
      </group>

      {/* 6. Campus Perimeter Security Fence (High Security Chainlink & Posts) */}
      <group>
        {/* Wire mesh panels */}
        <mesh position={[0, 5, 380]}>
          <boxGeometry args={[1150, 10, 0.1]} />
          <meshStandardMaterial color="#94a3b8" wireframe />
        </mesh>
        <mesh position={[0, 5, -340]}>
          <boxGeometry args={[1150, 10, 0.1]} />
          <meshStandardMaterial color="#94a3b8" wireframe />
        </mesh>
        <mesh position={[-560, 5, 20]}>
          <boxGeometry args={[0.1, 10, 740]} />
          <meshStandardMaterial color="#94a3b8" wireframe />
        </mesh>
        <mesh position={[560, 5, 20]}>
          <boxGeometry args={[0.1, 10, 740]} />
          <meshStandardMaterial color="#94a3b8" wireframe />
        </mesh>

        {/* Physical Fence Posts */}
        {Array.from({ length: 60 }).map((_, i) => {
          const x = -575 + i * 20;
          return (
            <group key={`fence-post-${i}`}>
              <mesh position={[x, 5, 380]} castShadow>
                <cylinderGeometry args={[0.15, 0.15, 10, 8]} />
                <meshStandardMaterial color="#64748b" roughness={0.7} />
              </mesh>
              <mesh position={[x, 5, -340]} castShadow>
                <cylinderGeometry args={[0.15, 0.15, 10, 8]} />
                <meshStandardMaterial color="#64748b" roughness={0.7} />
              </mesh>
            </group>
          )
        })}
        {Array.from({ length: 37 }).map((_, i) => {
          const z = -340 + i * 20;
          return (
            <group key={`fence-post-side-${i}`}>
              <mesh position={[-560, 5, z]} castShadow>
                <cylinderGeometry args={[0.15, 0.15, 10, 8]} />
                <meshStandardMaterial color="#64748b" roughness={0.7} />
              </mesh>
              <mesh position={[560, 5, z]} castShadow>
                <cylinderGeometry args={[0.15, 0.15, 10, 8]} />
                <meshStandardMaterial color="#64748b" roughness={0.7} />
              </mesh>
            </group>
          )
        })}
      </group>

      {/* 7. Industrial Streetlight Poles */}
      {streetLightPositions.map((pos, idx) => (
        <group key={`streetlight-${idx}`} position={pos}>
          {/* Vertical Steel Mast */}
          <mesh position={[0, 6, 0]} castShadow>
            <cylinderGeometry args={[0.2, 0.35, 12, 8]} />
            <meshPhysicalMaterial color="#334155" metalness={0.8} roughness={0.4} />
          </mesh>
          {/* Top Overhang Arm */}
          <mesh position={[1.5, 11.8, 0]} rotation={[0, 0, Math.PI / 4]}>
            <cylinderGeometry args={[0.12, 0.12, 3.5, 8]} />
            <meshPhysicalMaterial color="#334155" metalness={0.8} roughness={0.4} />
          </mesh>
          {/* Luminaire Head */}
          <mesh position={[2.8, 12.8, 0]}>
            <boxGeometry args={[1.2, 0.3, 0.6]} />
            <meshPhysicalMaterial color="#fef08a" emissive="#fef08a" emissiveIntensity={2.0} />
          </mesh>
        </group>
      ))}

      {/* 8. Campus Landscaping (Subtle Hedges & Bushes) */}
      <group>
        {/* Row of manicured hedges along main boulevard */}
        {Array.from({ length: 48 }).map((_, i) => {
          const x = -400 + i * 18;
          return (
            <group key={`hedge-south-${i}`} position={[x, -0.2, 36]}>
              <mesh castShadow receiveShadow>
                <boxGeometry args={[14, 2.5, 3]} />
                <meshPhysicalMaterial color="#0f3b22" roughness={0.95} clearcoat={0.1} />
              </mesh>
            </group>
          )
        })}
        {Array.from({ length: 48 }).map((_, i) => {
          const x = -400 + i * 18;
          return (
            <group key={`hedge-north-${i}`} position={[x, -0.2, 4]}>
              <mesh castShadow receiveShadow>
                <boxGeometry args={[14, 2.5, 3]} />
                <meshPhysicalMaterial color="#0f3b22" roughness={0.95} clearcoat={0.1} />
              </mesh>
            </group>
          )
        })}
      </group>

      {/* 9. Employee Parking Lot & Service Vehicles */}
      <group position={[0, 0, -50]}>
        {/* Parking Asphalt Extension */}
        <mesh position={[0, -0.42, 0]} receiveShadow>
          <boxGeometry args={[180, 0.1, 40]} />
          <meshPhysicalMaterial color="#0f172a" roughness={0.7} clearcoat={0.1} />
        </mesh>
        
        {/* Parking Lines */}
        {Array.from({ length: 16 }).map((_, i) => {
          const x = -138 + i * 18.5;
          if (x > -20 && x < 20) return null;
          return (
            <mesh key={`pline-${i}`} position={[x, -0.349, -8]}>
              <boxGeometry args={[0.2, 0.04, 18]} />
              <meshBasicMaterial color="#ffffff" toneMapped={false} />
            </mesh>
          )
        })}

        {/* Parked Service Vans & Corporate Vehicles */}
        {Array.from({ length: 15 }).map((_, i) => {
          const x = -130 + i * 18;
          if (x > -20 && x < 20) return null;
          
          const isVan = i % 3 === 0;
          return (
            <group key={`car-${i}`} position={[x, isVan ? 1.4 : 0.8, -10]} rotation={[0, Math.PI, 0]}>
              {/* Chassis */}
              <mesh castShadow receiveShadow>
                <boxGeometry args={[3.8, isVan ? 2.8 : 1.2, 7.5]} />
                <meshPhysicalMaterial 
                  color={isVan ? '#ffffff' : ['#f8fafc', '#94a3b8', '#0f172a', '#1e293b', '#3b82f6'][i % 5]} 
                  roughness={0.1} 
                  metalness={0.8} 
                  clearcoat={1.0} 
                  clearcoatRoughness={0.0} 
                />
              </mesh>
              {/* Cabin Glass */}
              {!isVan && (
                <mesh position={[0, 0.9, -0.5]}>
                  <boxGeometry args={[3.4, 0.8, 4.0]} />
                  <meshPhysicalMaterial color="#020617" roughness={0.0} metalness={1.0} clearcoat={1.0} transmission={0.9} />
                </mesh>
              )}
              {isVan && (
                <mesh position={[0, 0.4, -2.8]}>
                  <boxGeometry args={[3.4, 1.2, 1.5]} />
                  <meshPhysicalMaterial color="#020617" roughness={0.0} metalness={1.0} clearcoat={1.0} transmission={0.9} />
                </mesh>
              )}
              {/* Wheels */}
              {[-1.8, 1.8].map(wx => 
                [-2.5, 2.5].map(wz => (
                  <mesh key={`wheel-${wx}-${wz}`} position={[wx, isVan ? -1.2 : -0.6, wz]} rotation={[0, 0, Math.PI/2]}>
                    <cylinderGeometry args={[0.5, 0.5, 0.4, 16]} />
                    <meshPhysicalMaterial color="#020617" roughness={0.9} />
                  </mesh>
                ))
              )}
            </group>
          )
        })}
      </group>

      {/* 10. Elevated Utility & Pedestrian Walkway Bridges Connecting Buildings */}
      <group>
        {/* Bridge: Bldg A <--> Bldg B (Over the central road) */}
        <group position={[0, 14, 120]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[130, 4, 6]} />
            <meshPhysicalMaterial color="#1e293b" roughness={0.6} metalness={0.4} />
          </mesh>
          <mesh position={[0, 0, 3.1]}>
            <planeGeometry args={[130, 3]} />
            <meshPhysicalMaterial color="#020617" transmission={0.9} roughness={0.1} clearcoat={1.0} transparent opacity={0.6} />
          </mesh>
          <mesh position={[0, 0, -3.1]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[130, 3]} />
            <meshPhysicalMaterial color="#020617" transmission={0.9} roughness={0.1} clearcoat={1.0} transparent opacity={0.6} />
          </mesh>
        </group>

        {/* Bridge: Bldg D <--> Spine (North-South connection) */}
        <group position={[0, 14, -60]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[6, 4, 140]} />
            <meshPhysicalMaterial color="#1e293b" roughness={0.6} metalness={0.4} />
          </mesh>
          <mesh position={[3.1, 0, 0]} rotation={[0, Math.PI/2, 0]}>
            <planeGeometry args={[140, 3]} />
            <meshPhysicalMaterial color="#38bdf8" transmission={0.7} roughness={0.2} transparent opacity={0.6} />
          </mesh>
          <mesh position={[-3.1, 0, 0]} rotation={[0, -Math.PI/2, 0]}>
            <planeGeometry args={[140, 3]} />
            <meshPhysicalMaterial color="#38bdf8" transmission={0.7} roughness={0.2} transparent opacity={0.6} />
          </mesh>
        </group>
      </group>

      {/* 11. Distant Surrounding Scenario (Mountains / Hills) */}
      <group position={[0, -5, 0]}>
        {Array.from({ length: 36 }).map((_, i) => {
          const angle = (i / 36) * Math.PI * 2
          const radius = 1600 + Math.random() * 200
          const hX = Math.cos(angle) * radius
          const hZ = Math.sin(angle) * radius
          const height = 150 + Math.random() * 300
          const width = 400 + Math.random() * 200
          
          // Generate a varied earth-tone color for hills
          const hue = 0.2 + Math.random() * 0.1 // Greenish to brownish
          const color = new THREE.Color().setHSL(hue, 0.3, 0.15 + Math.random() * 0.1)

          return (
            <mesh key={`hill-${i}`} position={[hX, height/2 - 20, hZ]} rotation={[0, -angle, 0]}>
              <cylinderGeometry args={[0, width, height, 5]} />
              <meshPhysicalMaterial color={color} roughness={1.0} clearcoat={0.0} />
            </mesh>
          )
        })}
      </group>
    </group>
  )
}
