import { useStore } from '../../store'
import type { SelectedAssetInfo } from '../../store'

export default function CampusPowerSubsystem() {
  const { fetchAndSetSelectedAsset, scenario, setSelectedAsset } = useStore()
  const isGridLoss = scenario === 'GRID_LOSS'

  return (
    <group>
      {/* ========================================================================= */}
      {/* 1. 230kV GRID UTILITY SUBSTATION (Far Left, [-420, 0, 80])                */}
      {/* ========================================================================= */}
      <group
        position={[-420, 0, 80]}
        onClick={(e) => {
          e.stopPropagation()
          fetchAndSetSelectedAsset('CAMPUS-SUBSTATION')
        }}
      >
        {/* 4x Massive 100MVA Step-Down Power Transformers */}
        {[-38, -12, 12, 38].map((tX, i) => (
          <group key={`transformer-${i}`} position={[tX, 6.5, 0]}>
            {/* Gravel Spill Containment Pit */}
            <mesh position={[0, -6.3, 0]} receiveShadow>
              <boxGeometry args={[20, 0.4, 22]} />
              <meshPhysicalMaterial color="#334155" roughness={0.9} />
            </mesh>
            {/* Main Oil Tank */}
            <mesh castShadow receiveShadow>
              <boxGeometry args={[16, 12, 18]} />
              <meshPhysicalMaterial color="#1e293b" roughness={0.3} metalness={0.8} clearcoat={0.3} />
            </mesh>
            {/* Radiator Cooling Fins (Left & Right) */}
            <mesh position={[-9.2, 0, 0]}>
              <boxGeometry args={[2.2, 10, 15]} />
              <meshPhysicalMaterial color="#475569" metalness={0.9} roughness={0.2} clearcoat={0.2} />
            </mesh>
            <mesh position={[9.2, 0, 0]}>
              <boxGeometry args={[2.2, 10, 15]} />
              <meshPhysicalMaterial color="#475569" metalness={0.9} roughness={0.2} clearcoat={0.2} />
            </mesh>
            {/* Conservator Oil Expansion Tank */}
            <mesh position={[0, 7.8, -4]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[2.0, 2.0, 12, 16]} />
              <meshPhysicalMaterial color="#0f172a" metalness={0.8} roughness={0.4} />
            </mesh>
            {/* Ceramic Insulator Bushings */}
            {[-4, 0, 4].map((bX, bi) => (
              <mesh key={`bushing-${bi}`} position={[bX, 9.4, 3]}>
                <cylinderGeometry args={[0.5, 0.9, 5.5, 16]} />
                <meshPhysicalMaterial color="#94a3b8" roughness={0.1} metalness={0.9} clearcoat={1.0} />
              </mesh>
            ))}
          </group>
        ))}

        {/* High-Voltage Transmission Gantries */}
        {[-50, 50].map((gX, gi) => (
          <mesh key={`gantry-${gi}`} position={[gX, 22, 0]}>
            <boxGeometry args={[3.5, 44, 3.5]} />
            <meshStandardMaterial color="#64748b" metalness={0.9} wireframe />
          </mesh>
        ))}

        {/* Substation Chainlink Fence */}
        <mesh position={[0, 4, -100]}>
          <boxGeometry args={[130, 8, 0.2]} />
          <meshStandardMaterial color="#94a3b8" wireframe />
        </mesh>
        <mesh position={[0, 4, 100]}>
          <boxGeometry args={[130, 8, 0.2]} />
          <meshStandardMaterial color="#94a3b8" wireframe />
        </mesh>
      </group>

      {/* ========================================================================= */}
      {/* 2. 60 MW DIESEL GENERATOR YARD (Lower Left, [-400, 0, 270])               */}
      {/* ========================================================================= */}
      <group
        position={[-400, 0, 270]}
        onClick={(e) => {
          e.stopPropagation()
          fetchAndSetSelectedAsset('CAMPUS-GENERATOR-PLANT')
        }}
      >
        {/* 16x Heavy Acoustic Enclosures in 2 Long Parallel Rows */}
        {Array.from({ length: 16 }).map((_, i) => {
          const genX = (i % 8 - 3.5) * 18
          const genZ = (Math.floor(i / 8) - 0.5) * 32
          return (
            <group key={`genset-unit-${i}`} position={[genX, 5.5, genZ]}>
              {/* Concrete Housekeeping Pad */}
              <mesh position={[0, -4.6, 0]} receiveShadow>
                <boxGeometry args={[15, 0.4, 9]} />
                <meshPhysicalMaterial color="#475569" roughness={0.9} />
              </mesh>
              {/* Boxcar Weatherproof Enclosure */}
              <mesh castShadow receiveShadow>
                <boxGeometry args={[14, 9, 8]} />
                <meshPhysicalMaterial color="#334155" roughness={0.4} metalness={0.6} clearcoat={0.3} />
              </mesh>
              {/* Maintenance Access Doors (Side) */}
              {[-3.5, 0, 3.5].map((dx, di) => (
                <group key={`door-${di}`} position={[dx, -0.5, 4.01]}>
                  <mesh>
                    <planeGeometry args={[2.5, 5]} />
                    <meshPhysicalMaterial color="#1e293b" roughness={0.5} metalness={0.8} />
                  </mesh>
                  {/* Warning Decals */}
                  <mesh position={[0, 1.5, 0.01]}>
                    <planeGeometry args={[0.5, 0.5]} />
                    <meshBasicMaterial color="#ef4444" />
                  </mesh>
                </group>
              ))}
              {/* Radiator Louvers (Front) */}
              <mesh position={[6.9, 0, 0]}>
                <boxGeometry args={[0.4, 7.5, 7.0]} />
                <meshPhysicalMaterial color="#0f172a" roughness={0.8} />
              </mesh>
              <mesh position={[7.0, 0, 0]}>
                <boxGeometry args={[0.4, 7.0, 6.0]} />
                <meshPhysicalMaterial color="#020617" roughness={0.9} />
              </mesh>
              {/* Twin Vertical Exhaust Stacks with Flaps */}
              {[-2, 2].map((sZ, si) => (
                <group key={`stack-${si}`} position={[-4, 6.8, sZ]}>
                  <mesh>
                    <cylinderGeometry args={[0.5, 0.5, 5.0, 16]} />
                    <meshPhysicalMaterial color="#cbd5e1" metalness={0.95} roughness={0.1} clearcoat={1.0} />
                  </mesh>
                  {/* Flap */}
                  <mesh position={[0, 2.6, 0]} rotation={[isGridLoss ? Math.PI/4 : 0, 0, 0]}>
                    <cylinderGeometry args={[0.55, 0.55, 0.05, 16]} />
                    <meshPhysicalMaterial color="#94a3b8" metalness={0.8} roughness={0.4} />
                  </mesh>
                </group>
              ))}
              {/* Operating Status LED */}
              <mesh position={[0, 4.8, 0]}>
                <sphereGeometry args={[0.25, 12, 12]} />
                <meshBasicMaterial color={isGridLoss ? '#22c55e' : '#f59e0b'} />
              </mesh>
            </group>
          )
        })}

        {/* 4x Bulk Fuel Storage Tanks (Horizontal Cylinders) */}
        <group position={[0, 4.5, 52]}>
          {[-45, -15, 15, 45].map((tX, ti) => (
            <group key={`fuel-tank-${ti}`} position={[tX, 0, 0]}>
              {/* Concrete Saddle Supports */}
              {[-6, 6].map((sx, si) => (
                <mesh key={`saddle-${si}`} position={[0, -2.5, sx]} castShadow receiveShadow>
                  <boxGeometry args={[4, 2, 8]} />
                  <meshPhysicalMaterial color="#475569" roughness={0.9} />
                </mesh>
              ))}
              {/* Cylinder Tank */}
              <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
                <cylinderGeometry args={[3.2, 3.2, 18, 24]} />
                <meshPhysicalMaterial color="#1e293b" metalness={0.8} roughness={0.3} clearcoat={0.2} />
              </mesh>
            </group>
          ))}
          {/* Yellow Safety Fuel Header Pipe Rack */}
          <group position={[0, 3.8, 4]}>
            <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.3, 0.3, 110, 12]} />
              <meshPhysicalMaterial color="#eab308" roughness={0.4} metalness={0.5} />
            </mesh>
            {/* Pipe Supports */}
            {[-50, -25, 0, 25, 50].map((px, pi) => (
              <mesh key={`pipe-support-${pi}`} position={[px, -2, 0]} castShadow>
                <boxGeometry args={[0.2, 4, 0.2]} />
                <meshPhysicalMaterial color="#64748b" roughness={0.7} />
              </mesh>
            ))}
          </group>
        </group>
      </group>

      {/* ========================================================================= */}
      {/* 3. 80 MW / 160 MWh CENTRAL UPS BUILDING (Center Bottom, [0, 0, 260])       */}
      {/* ========================================================================= */}
      <group
        position={[0, 0, 260]}
        onClick={(e) => {
          e.stopPropagation()
          const assetInfo: SelectedAssetInfo = {
            id: 'CENTRAL-UPS-FACILITY',
            name: '80 MW / 160 MWh Central UPS & Battery Energy Storage (BESS)',
            type: 'ups_flywheel',
            status: 'OPTIMAL',
            powerKw: 80000,
            location: 'Central South Infrastructure Quad',
            details: {
              'UPS Capacity': '80 MW Continuous High-Efficiency Dynamic UPS (N+1 Redundancy)',
              'BESS Energy': '160 MWh Lithium-Ion Battery Storage Vaults',
              'Flywheel Reserve': '20x 8-Tonne Kinetic Steel Flywheels (12,000 RPM)',
              'Switching Time': '0.00 Milliseconds (Seamless Online Double-Conversion)',
            },
          }
          setSelectedAsset(assetInfo)
        }}
      >
        {/* UPS Building Shell */}
        <group position={[0, 6.0, 0]}>
          {/* Concrete Base */}
          <mesh position={[0, -4.2, 0]} castShadow receiveShadow>
            <boxGeometry args={[120, 3.6, 75]} />
            <meshPhysicalMaterial color="#334155" roughness={0.9} metalness={0.1} />
          </mesh>
          {/* Corrugated Upper */}
          <mesh position={[0, 1.8, 0]} castShadow receiveShadow>
            <boxGeometry args={[119.8, 8.4, 74.8]} />
            <meshPhysicalMaterial color="#1e293b" roughness={0.6} metalness={0.5} clearcoat={0.1} />
          </mesh>
          {/* Roof Parapet */}
          <mesh position={[0, 6.6, 0]} castShadow>
            <boxGeometry args={[120, 1.2, 75]} />
            <meshPhysicalMaterial color="#334155" roughness={0.9} />
          </mesh>
          {/* Roof Membrane */}
          <mesh position={[0, 6.0, 0]} receiveShadow>
            <boxGeometry args={[118, 0.2, 73]} />
            <meshPhysicalMaterial color="#94a3b8" roughness={0.95} metalness={0.0} />
          </mesh>
        </group>
        {/* Luminous UPS Sign */}
        <mesh position={[0, 10.5, 37.6]}>
          <planeGeometry args={[80, 2.5]} />
          <meshBasicMaterial color="#f59e0b" toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}
