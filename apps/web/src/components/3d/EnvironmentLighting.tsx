import { useMemo } from 'react'
import { Sky, Environment } from '@react-three/drei'
import { useStore } from '../../store'

export default function EnvironmentLighting() {
  const { lightingMode } = useStore()

  // Dynamic sky & lighting configurations
  const config = useMemo(() => {
    switch (lightingMode) {
      case 'golden_hour':
        return {
          sunPosition: [320, 45, 240] as [number, number, number],
          sunColor: '#ffd8a8',
          sunIntensity: 3.5,
          ambientColor: '#ffedd5',
          ambientIntensity: 1.2,
          skyTurbidity: 6.0,
          skyRayleigh: 2.0,
          skyMieCoefficient: 0.005,
          skyMieDirectionalG: 0.8,
          fogColor: '#9a3412',
          bgColor: '#fed7aa',
        }
      case 'studio':
        return {
          sunPosition: [150, 320, 150] as [number, number, number],
          sunColor: '#ffffff',
          sunIntensity: 2.2,
          ambientColor: '#ffffff',
          ambientIntensity: 1.5,
          skyTurbidity: 0.1,
          skyRayleigh: 0.1,
          skyMieCoefficient: 0.001,
          skyMieDirectionalG: 0.9,
          fogColor: '#f8fafc',
          bgColor: '#ffffff',
        }
      case 'night':
        return {
          sunPosition: [20, -30, 20] as [number, number, number],
          sunColor: '#38bdf8',
          sunIntensity: 0.5,
          ambientColor: '#0f172a',
          ambientIntensity: 0.6,
          skyTurbidity: 10.0,
          skyRayleigh: 0.2,
          skyMieCoefficient: 0.01,
          skyMieDirectionalG: 0.8,
          fogColor: '#020617',
          bgColor: '#020617',
        }
      case 'daylight':
      default:
        return {
          sunPosition: [180, 400, 120] as [number, number, number],
          sunColor: '#ffffff',
          sunIntensity: 3.8,
          ambientColor: '#ffffff',
          ambientIntensity: 1.6,
          skyTurbidity: 0.2,
          skyRayleigh: 0.3,
          skyMieCoefficient: 0.003,
          skyMieDirectionalG: 0.75,
          fogColor: '#bae6fd',
          bgColor: '#e0f2fe',
        }
    }
  }, [lightingMode])

  return (
    <group>
      {/* Set background to fog color to eliminate any horizon black walls/voids */}
      <color attach="background" args={[config.fogColor]} />
      
      {/* High Dynamic Range Image-Based Lighting (IBL) for metallic/glass reflections */}
      <Environment preset={lightingMode === 'night' ? 'night' : 'city'} />

      {/* 1. Procedural Sky Atmosphere */}
      {lightingMode !== 'studio' && (
        <Sky
          distance={450000}
          sunPosition={config.sunPosition}
          turbidity={config.skyTurbidity}
          rayleigh={config.skyRayleigh}
          mieCoefficient={config.skyMieCoefficient}
          mieDirectionalG={config.skyMieDirectionalG}
        />
      )}

      {/* Atmospheric Horizon Fog */}
      <fog attach="fog" args={[config.fogColor, 350, 1400]} />

      {/* 2. Professional Campus Lighting */}
      <ambientLight intensity={config.ambientIntensity} color={config.ambientColor} />

      <directionalLight
        position={config.sunPosition}
        intensity={config.sunIntensity}
        color={config.sunColor}
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-camera-near={10}
        shadow-camera-far={1200}
        shadow-camera-left={-500}
        shadow-camera-right={500}
        shadow-camera-top={500}
        shadow-camera-bottom={-500}
        shadow-bias={-0.0002}
        shadow-normalBias={0.05}
      />

      {/* Campus Secondary Fill Light */}
      <directionalLight position={[-250, 200, -200]} intensity={0.4} color="#93c5fd" />
    </group>
  )
}
