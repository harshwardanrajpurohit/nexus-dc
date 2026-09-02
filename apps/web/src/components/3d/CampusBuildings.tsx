import { useStore } from '../../store'
import type { SelectedAssetInfo } from '../../store'

interface ExteriorBuildingProps {
  id: string;
  name: string;
  serverCount: number;
  typeDesc: string;
  position: [number, number, number];
  dimensions: [number, number, number];
  signColor: string;
}

function IndustrialBuildingExterior({
  id,
  name,
  serverCount,
  typeDesc,
  position,
  dimensions,
  signColor,
}: ExteriorBuildingProps) {
  const { setSelectedAsset } = useStore()
  const [w, h, d] = dimensions

  return (
    <group
      position={position}
      onClick={(e) => {
        e.stopPropagation()
        const assetInfo: SelectedAssetInfo = {
          id,
          name,
          type: 'building',
          status: 'OPTIMAL',
          serverCount,
          powerKw: 16000,
          tempC: 22.1,
          location: `Campus North Quad (${id})`,
          details: {
            'Building Role': typeDesc,
            'Physical Servers': `${serverCount.toLocaleString()} High-Density Compute Nodes`,
            'Data Halls': '4x 5,000-Server Secure Partitioned Data Halls',
            'Cooling Plant': 'Dedicated Rooftop Adiabatic Condensers + Chilled Water Loop',
            'Power Feeds': 'Dual 33kV Redundant (2N) Utility Feeds from Substation',
          },
        }
        setSelectedAsset(assetInfo)
      }}
    >
      {/* 1. Concrete Base Plinth (Lower 30%) */}
      <mesh position={[0, h * 0.15, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h * 0.3, d]} />
        <meshPhysicalMaterial color="#334155" roughness={0.9} metalness={0.1} />
      </mesh>

      {/* 2. Corrugated Metal Upper Facade (Upper 70%) */}
      <mesh position={[0, h * 0.65, 0]} castShadow receiveShadow>
        <boxGeometry args={[w - 0.2, h * 0.7, d - 0.2]} />
        {/* Simulate corrugated metal with bump-like metalness and high roughness */}
        <meshPhysicalMaterial color="#1e293b" roughness={0.6} metalness={0.5} clearcoat={0.1} />
      </mesh>

      {/* 3. Roof Parapet Wall (Safety barrier around roof edge) */}
      <mesh position={[0, h + 0.6, 0]} castShadow>
        <boxGeometry args={[w, 1.2, d]} />
        <meshPhysicalMaterial color="#334155" roughness={0.9} />
      </mesh>

      {/* 4. Roof Membrane (TPO White Reflective / Ballast) */}
      <mesh position={[0, h, 0]} receiveShadow>
        <boxGeometry args={[w - 1.2, 0.2, d - 1.2]} />
        <meshPhysicalMaterial color="#94a3b8" roughness={0.95} metalness={0.0} />
      </mesh>

      {/* Decorative Architectural Louver Bands */}
      <mesh position={[0, h * 0.75, d / 2 + 0.1]}>
        <boxGeometry args={[w * 0.92, 3.2, 0.4]} />
        <meshPhysicalMaterial color="#0f172a" roughness={0.3} metalness={0.8} clearcoat={0.5} />
      </mesh>
      <mesh position={[0, h * 0.35, d / 2 + 0.1]}>
        <boxGeometry args={[w * 0.92, 2.4, 0.4]} />
        <meshPhysicalMaterial color="#0f172a" roughness={0.3} metalness={0.8} clearcoat={0.5} />
      </mesh>

      {/* Loading Dock Sectional Roll-up Doors (Front) */}
      {[-28, 0, 28].map((dockX, di) => (
        <group key={`dock-${di}`} position={[dockX, 3.8, d / 2 + 0.1]}>
          {/* Concrete Dock Ramp Cutout simulation */}
          <mesh position={[0, -2.8, 1.8]} receiveShadow>
            <boxGeometry args={[16, 2.0, 3.6]} />
            <meshPhysicalMaterial color="#1e293b" roughness={0.9} />
          </mesh>
          {/* Rubber Dock Bumpers */}
          {[-7.2, 7.2].map(bx => (
            <mesh key={`bumper-${bx}`} position={[bx, -1.5, 0.4]}>
              <boxGeometry args={[0.6, 2.5, 0.4]} />
              <meshPhysicalMaterial color="#020617" roughness={0.9} />
            </mesh>
          ))}
          {/* Door Frame */}
          <mesh castShadow>
            <boxGeometry args={[14, 7.5, 0.4]} />
            <meshPhysicalMaterial color="#475569" roughness={0.4} metalness={0.8} clearcoat={0.2} />
          </mesh>
          {/* Sectional Door Grooves */}
          <mesh position={[0, 0, 0.22]}>
            <planeGeometry args={[13.2, 7.0]} />
            <meshPhysicalMaterial color="#64748b" roughness={0.7} wireframe />
          </mesh>
        </group>
      ))}

      {/* Exterior Structural Pillars */}
      {Array.from({ length: 9 }).map((_, i) => {
        const pX = (i - 4) * (w / 8.5)
        return (
          <group key={`pillar-front-${i}`} position={[pX, h / 2, d / 2 + 0.1]}>
            <mesh castShadow>
              <boxGeometry args={[1.5, h, 0.6]} />
              <meshPhysicalMaterial color="#334155" roughness={0.9} />
            </mesh>
          </group>
        )
      })}

      {/* Luminous Building Identification Sign */}
      <group position={[0, h - 2.2, d / 2 + 0.35]}>
        <mesh>
          <planeGeometry args={[w * 0.65, 3.2]} />
          <meshBasicMaterial color={signColor} toneMapped={false} />
        </mesh>
      </group>

      {/* Massive Rooftop HVAC / Air Handling & Condenser Array */}
      <group position={[0, h + 2.5, 0]}>
        {/* Maintenance Walkways */}
        <mesh position={[0, -2.4, 0]} receiveShadow>
          <boxGeometry args={[w * 0.8, 0.05, d * 0.8]} />
          <meshPhysicalMaterial color="#94a3b8" roughness={0.9} />
        </mesh>
        
        {Array.from({ length: 12 }).map((_, i) => {
          const rowX = (i % 4 - 1.5) * (w / 4.8)
          const rowZ = (Math.floor(i / 4) - 1) * (d / 3.8)
          return (
            <group key={`roof-ac-${i}`} position={[rowX, 0, rowZ]}>
              {/* Condenser Housing */}
              <mesh castShadow receiveShadow>
                <boxGeometry args={[18, 4.5, 14]} />
                <meshPhysicalMaterial color="#1e293b" metalness={0.8} roughness={0.3} clearcoat={0.2} />
              </mesh>
              {/* Air Intake Louvers on sides */}
              <mesh position={[0, 0, 7.1]}>
                <planeGeometry args={[16, 3]} />
                <meshPhysicalMaterial color="#0f172a" roughness={0.8} />
              </mesh>
              <mesh position={[0, 0, -7.1]} rotation={[0, Math.PI, 0]}>
                <planeGeometry args={[16, 3]} />
                <meshPhysicalMaterial color="#0f172a" roughness={0.8} />
              </mesh>
              {/* Dual Exhaust Fan Cowlings */}
              {[-4, 4].map((fanX, fi) => (
                <mesh key={`fan-${fi}`} position={[fanX, 2.4, 0]}>
                  <cylinderGeometry args={[2.6, 2.8, 0.8, 16]} />
                  <meshPhysicalMaterial color="#0f172a" metalness={0.9} roughness={0.3} />
                </mesh>
              ))}
            </group>
          )
        })}
      </group>
    </group>
  )
}

function DetailedWall({
  position,
  args,
  isWallTransparent,
  wallOpacity,
  wallHeight
}: {
  position: [number, number, number];
  args: [number, number, number];
  isWallTransparent: boolean;
  wallOpacity: number;
  wallHeight: number;
}) {
  const [w, , d] = args;
  // If we are cutting away, we just scale everything down
  const baseH = wallHeight * 0.3;
  const topH = wallHeight * 0.7;

  return (
    <group position={position}>
      {/* Lower Concrete Base */}
      <mesh position={[0, -wallHeight / 2 + baseH / 2, 0]} castShadow>
        <boxGeometry args={[w, baseH, d]} />
        <meshPhysicalMaterial
          color="#334155"
          roughness={0.9}
          metalness={0.1}
          transparent={isWallTransparent}
          opacity={wallOpacity}
        />
      </mesh>
      {/* Upper Corrugated Metal */}
      <mesh position={[0, wallHeight / 2 - topH / 2, 0]} castShadow>
        <boxGeometry args={[w, topH, d]} />
        <meshPhysicalMaterial
          color="#1e293b"
          roughness={0.6}
          metalness={0.5}
          clearcoat={0.1}
          transparent={isWallTransparent}
          opacity={wallOpacity}
        />
      </mesh>
    </group>
  );
}

export default function CampusBuildings() {
  const { cutaway, setSelectedAsset } = useStore()
  const { roofVisible, wallsMode } = cutaway

  const wallOpacity = wallsMode === 'glass' ? 0.25 : 1.0
  const isWallTransparent = wallsMode === 'glass'
  const wallHeight = wallsMode === 'cutaway' ? 4.5 : 14.0
  const isWallHidden = wallsMode === 'hidden'

  return (
    <group>
      {/* ========================================================================= */}
      {/* 1. DATA CENTER BUILDING A (Front Left, Primary Compute Cutaway)           */}
      {/* ========================================================================= */}
      <group
        position={[-180, 0, 120]}
        onClick={(e) => {
          e.stopPropagation()
          const assetInfo: SelectedAssetInfo = {
            id: 'DATA-CENTER-BUILDING-A',
            name: 'Data Center Building A (20,000 Enterprise Compute Servers)',
            type: 'building',
            status: 'OPTIMAL',
            serverCount: 20000,
            powerKw: 16000,
            tempC: 21.4,
            location: 'Front-West Campus Quad',
            details: {
              'Architecture': '500 Standard 19" OCP Compute Racks (40 1U Nodes/Rack)',
              'Total Capacity': '20,000 Physical Intel Xeon & AMD EPYC Servers',
              'Cooling Mode': 'Cold Aisle Containment + Underfloor Plenum Chilled Air',
              'Aisle Containment': 'Polycarbonate Ceiling Canopies & Biometric Sliding Doors',
              'Power Busbars': '1,400A Overhead Copper Busway Feeds',
            },
          }
          setSelectedAsset(assetInfo)
        }}
      >
        {/* Exterior Shell Walls (Cutaway / Glass / Solid / Hidden) */}
        {!isWallHidden && (
          <group>
            {/* North Wall */}
            <DetailedWall position={[0, wallHeight / 2 + 0.4, -65]} args={[220, wallHeight, 1.6]} isWallTransparent={isWallTransparent} wallOpacity={wallOpacity} wallHeight={wallHeight} />
            {/* South Wall */}
            <DetailedWall position={[0, wallHeight / 2 + 0.4, 65]} args={[220, wallHeight, 1.6]} isWallTransparent={isWallTransparent} wallOpacity={wallOpacity} wallHeight={wallHeight} />
            {/* West Wall */}
            <DetailedWall position={[-110, wallHeight / 2 + 0.4, 0]} args={[1.6, wallHeight, 130]} isWallTransparent={isWallTransparent} wallOpacity={wallOpacity} wallHeight={wallHeight} />
            {/* East Wall */}
            <DetailedWall position={[110, wallHeight / 2 + 0.4, 0]} args={[1.6, wallHeight, 130]} isWallTransparent={isWallTransparent} wallOpacity={wallOpacity} wallHeight={wallHeight} />
          </group>
        )}

        {/* Luminous Building A Sign */}
        <mesh position={[0, 13.5, 66]}>
          <planeGeometry args={[95, 3.0]} />
          <meshBasicMaterial color="#0284c7" toneMapped={false} />
        </mesh>

        {/* Removable Roof Slab */}
        {roofVisible && (
          <group position={[0, 14.8, 0]}>
            {/* Roof Parapet */}
            <mesh position={[0, 0.6, 0]} castShadow>
              <boxGeometry args={[220, 1.2, 130]} />
              <meshPhysicalMaterial color="#334155" roughness={0.9} />
            </mesh>
            {/* Roof Membrane */}
            <mesh castShadow receiveShadow>
              <boxGeometry args={[218, 0.2, 128]} />
              <meshPhysicalMaterial color="#94a3b8" roughness={0.95} metalness={0.0} />
            </mesh>
          </group>
        )}
      </group>

      {/* ========================================================================= */}
      {/* 2. DATA CENTER BUILDING B (Front Right, AI GPU Liquid Cluster Cutaway)    */}
      {/* ========================================================================= */}
      <group
        position={[180, 0, 120]}
        onClick={(e) => {
          e.stopPropagation()
          const assetInfo: SelectedAssetInfo = {
            id: 'DATA-CENTER-BUILDING-B',
            name: 'Data Center Building B (20,000 AI GPU GB200 Superchips)',
            type: 'building',
            status: 'OPTIMAL',
            serverCount: 20000,
            powerKw: 24000,
            tempC: 52.8,
            coolantFlowLpm: 680000,
            location: 'Front-East Campus Quad',
            details: {
              'Architecture': '278 GB200 NVL72 Liquid-Cooled AI GPU Racks (132 kW/Rack)',
              'Total Capacity': '20,000 Grace Blackwell AI Superchips & NVLink Switch Fabric',
              'Cooling Mode': 'Direct-to-Chip Liquid Cold Plates + Stainless Steel CDUs',
              'CDU Network': '16x Row-End Coolant Distribution Units (3,800 LPM each)',
              'Power Busbars': '1,400A 48V DC High-Density Copper Busways (2N)',
            },
          }
          setSelectedAsset(assetInfo)
        }}
      >
        {/* Exterior Shell Walls */}
        {!isWallHidden && (
          <group>
            {/* North Wall */}
            <DetailedWall position={[0, wallHeight / 2 + 0.4, -65]} args={[220, wallHeight, 1.6]} isWallTransparent={isWallTransparent} wallOpacity={wallOpacity} wallHeight={wallHeight} />
            {/* South Wall */}
            <DetailedWall position={[0, wallHeight / 2 + 0.4, 65]} args={[220, wallHeight, 1.6]} isWallTransparent={isWallTransparent} wallOpacity={wallOpacity} wallHeight={wallHeight} />
            {/* West Wall */}
            <DetailedWall position={[-110, wallHeight / 2 + 0.4, 0]} args={[1.6, wallHeight, 130]} isWallTransparent={isWallTransparent} wallOpacity={wallOpacity} wallHeight={wallHeight} />
            {/* East Wall */}
            <DetailedWall position={[110, wallHeight / 2 + 0.4, 0]} args={[1.6, wallHeight, 130]} isWallTransparent={isWallTransparent} wallOpacity={wallOpacity} wallHeight={wallHeight} />
          </group>
        )}

        {/* Luminous Building B Sign */}
        <mesh position={[0, 13.5, 66]}>
          <planeGeometry args={[95, 3.0]} />
          <meshBasicMaterial color="#06b6d4" toneMapped={false} />
        </mesh>

        {/* Removable Roof Slab */}
        {roofVisible && (
          <group position={[0, 14.8, 0]}>
            {/* Roof Parapet */}
            <mesh position={[0, 0.6, 0]} castShadow>
              <boxGeometry args={[220, 1.2, 130]} />
              <meshPhysicalMaterial color="#334155" roughness={0.9} />
            </mesh>
            {/* Roof Membrane */}
            <mesh castShadow receiveShadow>
              <boxGeometry args={[218, 0.2, 128]} />
              <meshPhysicalMaterial color="#94a3b8" roughness={0.95} metalness={0.0} />
            </mesh>
          </group>
        )}
      </group>

      {/* ========================================================================= */}
      {/* 3. DATA CENTER BUILDING C (Mid Right, AI GPU Cluster 2)                   */}
      {/* ========================================================================= */}
      <IndustrialBuildingExterior
        id="DATA-CENTER-BUILDING-C"
        name="Data Center Building C (20,000 AI GPU & Training Servers)"
        serverCount={20000}
        typeDesc="High-Density Liquid Cooled AI Training Facility"
        position={[260, 0, -140]}
        dimensions={[200, 14, 130]}
        signColor="#06b6d4"
      />

      {/* ========================================================================= */}
      {/* 4. DATA CENTER BUILDING D (Mid Center, Storage & Compute Infrastructure)  */}
      {/* ========================================================================= */}
      <IndustrialBuildingExterior
        id="DATA-CENTER-BUILDING-D"
        name="Data Center Building D (20,000 Exabyte Storage & Compute Servers)"
        serverCount={20000}
        typeDesc="Hyperscale NVMe Storage & Cloud Database Fabric"
        position={[0, 0, -140]}
        dimensions={[200, 14, 130]}
        signColor="#0284c7"
      />

      {/* ========================================================================= */}
      {/* 5. DATA CENTER BUILDING E (Mid Left, Cloud Infrastructure & Expansion)   */}
      {/* ========================================================================= */}
      <IndustrialBuildingExterior
        id="DATA-CENTER-BUILDING-E"
        name="Data Center Building E (20,000 Cloud Platform Servers)"
        serverCount={20000}
        typeDesc="Multi-Tenant Cloud Compute & Kubernetes Infrastructure"
        position={[-260, 0, -140]}
        dimensions={[200, 14, 130]}
        signColor="#a855f7"
      />
    </group>
  )
}
