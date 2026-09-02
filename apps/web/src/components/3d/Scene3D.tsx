import { useRef, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import { EffectComposer, Bloom, N8AO } from '@react-three/postprocessing'
import * as THREE from 'three'
import { useStore } from '../../store'
import type { WaypointId } from '../../store'

import EnvironmentLighting from './EnvironmentLighting'
import CampusTerrain from './CampusTerrain'
import CampusBuildings from './CampusBuildings'
import DataHallInteriors from './DataHallInteriors'
import CampusPowerSubsystem from './CampusPowerSubsystem'
import CampusCoolingSubsystem from './CampusCoolingSubsystem'
import CampusFlowTracer from './CampusFlowTracer'
import AudioSubsystem from './AudioSubsystem'
import FPSController from './FPSController'
import CinematicController from './CinematicController'

// Campus Waypoint Camera Presets
const WAYPOINT_PRESETS: Record<
  WaypointId,
  { position: [number, number, number]; target: [number, number, number]; fov: number }
> = {
  campus_overview: { position: [480, 120, 520], target: [0, 10, 0], fov: 42 },
  building_a: { position: [-180, 52, 215], target: [-180, 6, 120], fov: 46 },
  building_b: { position: [180, 52, 215], target: [180, 6, 120], fov: 46 },
  building_c: { position: [260, 48, -45], target: [260, 8, -140], fov: 48 },
  building_d: { position: [0, 48, -45], target: [0, 8, -140], fov: 48 },
  building_e: { position: [-260, 48, -45], target: [-260, 8, -140], fov: 48 },
  power_substation: { position: [-420, 58, 175], target: [-420, 10, 80], fov: 48 },
  generator_yard: { position: [-400, 48, 350], target: [-400, 8, 270], fov: 48 },
  ups_building: { position: [0, 42, 335], target: [0, 8, 260], fov: 45 },
  cooling_plant: { position: [340, 48, 265], target: [340, 8, 180], fov: 48 },
  water_infrastructure: { position: [470, 58, 265], target: [470, 10, 180], fov: 48 },
  security_gate: { position: [0, 26, 385], target: [0, 4, 330], fov: 45 },
  noc_room: { position: [-180, 14, 165], target: [-180, 6, 120], fov: 40 },
  network_mmr: { position: [180, 14, 165], target: [180, 6, 120], fov: 40 },
  rack_closeup: { position: [174, 8, 128], target: [180, 4.4, 120], fov: 35 },
}

function OrbitCameraRig() {
  const { currentWaypoint, viewMode, setPlayerTransform } = useStore()
  const controlsRef = useRef<any>(null)

  const targetCamPos = useRef(new THREE.Vector3(...WAYPOINT_PRESETS.campus_overview.position))
  const targetLookAt = useRef(new THREE.Vector3(...WAYPOINT_PRESETS.campus_overview.target))

  useEffect(() => {
    if (viewMode === 'orbit') {
      const cfg = WAYPOINT_PRESETS[currentWaypoint] || WAYPOINT_PRESETS.campus_overview
      targetCamPos.current.set(...cfg.position)
      targetLookAt.current.set(...cfg.target)
    }
  }, [currentWaypoint, viewMode])

  useFrame(({ camera }) => {
    if (viewMode === 'orbit') {
      camera.position.lerp(targetCamPos.current, 0.05)
      if (controlsRef.current) {
        controlsRef.current.target.lerp(targetLookAt.current, 0.05)
        controlsRef.current.update()
      }
      setPlayerTransform([camera.position.x, camera.position.y, camera.position.z], camera.rotation.y)
    }
  })

  if (viewMode !== 'orbit') return null

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      dampingFactor={0.05}
      maxPolarAngle={Math.PI / 2.05}
      minDistance={6}
      maxDistance={1200}
    />
  )
}

export default function Scene3D() {
  const { viewMode, visualMode } = useStore()

  return (
    <div className="relative w-full h-full bg-[#020617]">
      <Canvas
        camera={{ position: [360, 220, 360], fov: 45 }}
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.15,
        }}
        shadows={{ type: THREE.PCFSoftShadowMap }}
      >
        {/* Realistic Sky Dome Atmosphere & Dynamic Sunlight */}
        <EnvironmentLighting />

        {/* Building A & B Interior Accent Spotlights */}
        <pointLight position={[-180, 12, 120]} intensity={1.5} distance={120} color="#f8fafc" />
        <pointLight position={[180, 12, 120]} intensity={1.5} distance={120} color="#f8fafc" />

        {/* Subtle Ground Reference Grid */}
        {visualMode !== 'realism' && (
          <Grid
            infiniteGrid
            fadeDistance={900}
            cellColor="#475569"
            sectionColor="#64748b"
            cellSize={15}
            sectionSize={75}
          />
        )}

        {/* ========================================================================= */}
        {/* 100,000-SERVER 5-BUILDING HYPERSCALE CAMPUS INFRASTRUCTURE               */}
        {/* ========================================================================= */}
        <group>
          {/* Master Industrial Campus Terrain, Roads & Security Gate */}
          <CampusTerrain />

          {/* 5 Massive Data Center Buildings (A, B, C, D, E) */}
          <CampusBuildings />

          {/* Vast Data Hall Interiors (Instanced Racks, Cold Containment, CDUs) */}
          <DataHallInteriors />

          {/* 230kV Substation, 60MW Gen Yard, Bulk Fuel, 80MW UPS Building */}
          <CampusPowerSubsystem />

          {/* 30,000-Ton Cooling Plant, 18-Cell Cooling Towers, Water Reservoirs */}
          <CampusCoolingSubsystem />

          {/* Glowing Infrastructure Flow Pipelines (Power, Cooling, Network) */}
          <CampusFlowTracer />
        </group>

        {/* Camera Control Modes */}
        <OrbitCameraRig />
        <FPSController />
        <CinematicController />

        {/* Post-Processing Pipeline for Realism */}
        <EffectComposer enableNormalPass={false} multisampling={4}>
          <N8AO aoRadius={6.0} intensity={4.0} color="black" distanceFalloff={0.2} />
          <Bloom
            luminanceThreshold={1.0}
            mipmapBlur
            intensity={visualMode === 'engineering' ? 1.5 : 0.6}
            levels={8}
          />
        </EffectComposer>

        {/* Generative Web Audio Subsystem (3D Positional Noise/Hum) */}
        <AudioSubsystem />
      </Canvas>

      {/* First-Person HUD Overlay */}
      {viewMode === 'fps' && (
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between p-6 select-none z-10">
          <div className="bg-black/80 backdrop-blur-md px-4 py-2 rounded-xl border border-emerald-500/50 text-xs font-mono text-emerald-300 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>WALK MODE ACTIVE: Click screen to capture mouse</span>
            <span>•</span>
            <span className="text-gray-300">WASD: Walk | Shift: Sprint | ESC: Exit</span>
          </div>

          <div className="w-3 h-3 rounded-full border-2 border-white/80 bg-cyan-400/40" />

          <div className="bg-black/65 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-[11px] font-mono text-gray-300">
            Walk freely between all 5 data centers, enter data halls, and inspect racks & substations
          </div>
        </div>
      )}

      {/* Cinematic Drone Tour HUD Overlay */}
      {viewMode === 'cinematic' && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 pointer-events-none bg-purple-950/80 backdrop-blur-md px-4 py-2 rounded-xl border border-purple-500/50 text-xs font-mono text-purple-200 flex items-center gap-3 select-none z-10">
          <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
          <span>CINEMATIC DRONE TOUR: Gliding across 5-building hyperscale campus</span>
        </div>
      )}
    </div>
  )
}
