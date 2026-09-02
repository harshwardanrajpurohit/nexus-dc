import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../../store'

export default function CampusFlowTracer() {
  const { cutaway, visualMode } = useStore()
  const { flowTrace } = cutaway

  const flowMeshRef = useRef<THREE.InstancedMesh>(null)

  // 1. Generate ALL Physical Campus Conduit Curves permanently
  const allCurves = useMemo(() => {
    const curves: { curve: THREE.CatmullRomCurve3; type: 'power' | 'cooling' | 'network'; color: string }[] = []

    // --- POWER PIPES ---
    const pSubToUPS = [
      new THREE.Vector3(-420, 8, 80),
      new THREE.Vector3(-400, 8, 220),
      new THREE.Vector3(-200, 8, 220),
      new THREE.Vector3(0, 8, 240),
    ]
    curves.push({ curve: new THREE.CatmullRomCurve3(pSubToUPS), type: 'power', color: '#f59e0b' })

    const pUPSToA = [
      new THREE.Vector3(0, 8, 240),
      new THREE.Vector3(-180, 8, 210),
      new THREE.Vector3(-180, 8, 120),
    ]
    curves.push({ curve: new THREE.CatmullRomCurve3(pUPSToA), type: 'power', color: '#eab308' })

    const pUPSToB = [
      new THREE.Vector3(0, 8, 240),
      new THREE.Vector3(180, 8, 210),
      new THREE.Vector3(180, 8, 120),
    ]
    curves.push({ curve: new THREE.CatmullRomCurve3(pUPSToB), type: 'power', color: '#eab308' })

    const pUPSToNorth = [
      new THREE.Vector3(0, 8, 240),
      new THREE.Vector3(0, 8, 20),
      new THREE.Vector3(0, 8, -140),
    ]
    curves.push({ curve: new THREE.CatmullRomCurve3(pUPSToNorth), type: 'power', color: '#f59e0b' })

    const pNorthToC = [
      new THREE.Vector3(0, 8, 20),
      new THREE.Vector3(260, 8, 20),
      new THREE.Vector3(260, 8, -140),
    ]
    curves.push({ curve: new THREE.CatmullRomCurve3(pNorthToC), type: 'power', color: '#eab308' })

    const pNorthToE = [
      new THREE.Vector3(0, 8, 20),
      new THREE.Vector3(-260, 8, 20),
      new THREE.Vector3(-260, 8, -140),
    ]
    curves.push({ curve: new THREE.CatmullRomCurve3(pNorthToE), type: 'power', color: '#eab308' })

    // --- COOLING PIPES ---
    const pTanksToPlant = [
      new THREE.Vector3(470, 6, 180),
      new THREE.Vector3(340, 6, 180),
    ]
    curves.push({ curve: new THREE.CatmullRomCurve3(pTanksToPlant), type: 'cooling', color: '#00e5ff' })

    const pPlantToBuildingB = [
      new THREE.Vector3(340, 6, 180),
      new THREE.Vector3(180, 6, 180),
      new THREE.Vector3(180, 6, 120),
    ]
    curves.push({ curve: new THREE.CatmullRomCurve3(pPlantToBuildingB), type: 'cooling', color: '#0284c7' })

    const pPlantToBuildingA = [
      new THREE.Vector3(340, 6, 180),
      new THREE.Vector3(0, 6, 180),
      new THREE.Vector3(-180, 6, 180),
      new THREE.Vector3(-180, 6, 120),
    ]
    curves.push({ curve: new THREE.CatmullRomCurve3(pPlantToBuildingA), type: 'cooling', color: '#0284c7' })

    const pPlantToNorth = [
      new THREE.Vector3(340, 6, 180),
      new THREE.Vector3(340, 6, 20),
      new THREE.Vector3(260, 6, -140),
    ]
    curves.push({ curve: new THREE.CatmullRomCurve3(pPlantToNorth), type: 'cooling', color: '#00e5ff' })

    const pHotReturn = [
      new THREE.Vector3(180, 9, 120),
      new THREE.Vector3(260, 9, 20),
      new THREE.Vector3(470, 9, 180),
    ]
    curves.push({ curve: new THREE.CatmullRomCurve3(pHotReturn), type: 'cooling', color: '#ef4444' })

    // --- NETWORK PIPES ---
    const pNetSpine = [
      new THREE.Vector3(0, 10, 320),
      new THREE.Vector3(0, 10, 20),
      new THREE.Vector3(-180, 10, 120),
    ]
    curves.push({ curve: new THREE.CatmullRomCurve3(pNetSpine), type: 'network', color: '#a855f7' })

    const pNetToB = [
      new THREE.Vector3(0, 10, 20),
      new THREE.Vector3(180, 10, 120),
    ]
    curves.push({ curve: new THREE.CatmullRomCurve3(pNetToB), type: 'network', color: '#38bdf8' })

    const pNetToNorth = [
      new THREE.Vector3(0, 10, 20),
      new THREE.Vector3(0, 10, -140),
      new THREE.Vector3(260, 10, -140),
    ]
    curves.push({ curve: new THREE.CatmullRomCurve3(pNetToNorth), type: 'network', color: '#a855f7' })

    return curves
  }, [])

  // Filter curves for flowing particles (Only in Engineering mode)
  const activeCurves = useMemo(() => {
    return (flowTrace === 'none' || visualMode === 'realism') ? [] : allCurves.filter(c => c.type === flowTrace)
  }, [allCurves, flowTrace, visualMode])

  // Moving particles along active flow conduits
  const particleCount = 150
  const particles = useMemo(() => {
    const list = []
    for (let i = 0; i < particleCount; i++) {
      list.push({
        progress: Math.random(),
        speed: 0.15 + Math.random() * 0.25,
      })
    }
    return list
  }, [])

  const dummy = useMemo(() => new THREE.Object3D(), [])
  const colorDummy = useMemo(() => new THREE.Color(), [])
  const geom = useMemo(() => new THREE.SphereGeometry(0.65, 8, 8), [])

  useFrame((_, delta) => {
    if (flowMeshRef.current && activeCurves.length > 0) {
      particles.forEach((p, idx) => {
        p.progress = (p.progress + delta * p.speed) % 1.0
        const cObj = activeCurves[idx % activeCurves.length]
        if (cObj) {
          const pt = cObj.curve.getPoint(p.progress)
          dummy.position.copy(pt)
          dummy.updateMatrix()
          flowMeshRef.current!.setMatrixAt(idx, dummy.matrix)
          colorDummy.set(cObj.color)
          flowMeshRef.current!.setColorAt(idx, colorDummy)
        }
      })
      flowMeshRef.current.instanceMatrix.needsUpdate = true
      if (flowMeshRef.current.instanceColor) {
        flowMeshRef.current.instanceColor.needsUpdate = true
      }
    }
  })

  return (
    <group>
      {/* 1. Permanent Physical Flow Conduit Pipes */}
      {allCurves.map((cObj, i) => {
        const isActive = flowTrace === cObj.type && visualMode === 'engineering'
        
        let pipeColor = '#64748b' // Default insulated pipe gray
        if (isActive) pipeColor = cObj.color
        else if (cObj.type === 'cooling') pipeColor = '#cbd5e1'
        else if (cObj.type === 'power') pipeColor = '#334155'

        return (
          <mesh key={`flow-pipe-${i}`}>
            <tubeGeometry args={[cObj.curve, 48, cObj.type === 'network' ? 0.25 : 0.45, 8, false]} />
            <meshPhysicalMaterial
              color={pipeColor}
              emissive={isActive ? cObj.color : '#000000'}
              emissiveIntensity={isActive ? 1.5 : 0}
              metalness={isActive ? 0.2 : 0.8}
              roughness={isActive ? 0.2 : 0.4}
              clearcoat={isActive ? 0.0 : 0.5}
              transparent
              opacity={isActive ? 0.9 : 1.0}
            />
          </mesh>
        )
      })}

      {/* 2. Flowing Particles (Only visible when trace is active in engineering mode) */}
      <instancedMesh
        ref={flowMeshRef}
        args={[geom, undefined, particleCount]}
        visible={flowTrace !== 'none' && visualMode === 'engineering'}
      >
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  )
}
