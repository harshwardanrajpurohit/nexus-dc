import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PointerLockControls } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../../store'

export default function FPSController() {
  const { viewMode, setViewMode, setPlayerTransform, cutaway } = useStore()
  const controlsRef = useRef<any>(null)
  const { camera } = useThree()
  const { underfloorRaised } = cutaway

  const [isLocked, setIsLocked] = useState(false)

  const keys = useRef<{ forward: boolean; backward: boolean; left: boolean; right: boolean; sprint: boolean }>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
  })

  // Set initial spawn location when entering Walk Mode
  useEffect(() => {
    if (viewMode === 'fps') {
      camera.position.set(0, 2.75, 290)
      camera.lookAt(0, 2.75, 120)
    }
  }, [viewMode, camera])

  // Keyboard Event Listeners
  useEffect(() => {
    if (viewMode !== 'fps') return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          keys.current.forward = true
          break
        case 'KeyS':
        case 'ArrowDown':
          keys.current.backward = true
          break
        case 'KeyA':
        case 'ArrowLeft':
          keys.current.left = true
          break
        case 'KeyD':
        case 'ArrowRight':
          keys.current.right = true
          break
        case 'ShiftLeft':
        case 'ShiftRight':
          keys.current.sprint = true
          break
        case 'Escape':
          setViewMode('orbit')
          break
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          keys.current.forward = false
          break
        case 'KeyS':
        case 'ArrowDown':
          keys.current.backward = false
          break
        case 'KeyA':
        case 'ArrowLeft':
          keys.current.left = false
          break
        case 'KeyD':
        case 'ArrowRight':
          keys.current.right = false
          break
        case 'ShiftLeft':
        case 'ShiftRight':
          keys.current.sprint = false
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [viewMode, setViewMode])

  // Movement Frame Calculation
  const moveDirection = useRef(new THREE.Vector3())
  const forwardVector = useRef(new THREE.Vector3())
  const sideVector = useRef(new THREE.Vector3())

  useFrame((_, delta) => {
    if (viewMode !== 'fps') return

    // If mouse is not locked, don't move
    if (!isLocked) return

    const baseSpeed = keys.current.sprint ? 40.0 : 20.0
    const moveDist = baseSpeed * delta

    forwardVector.current.set(0, 0, 0)
    sideVector.current.set(0, 0, 0)

    if (keys.current.forward) forwardVector.current.z -= 1
    if (keys.current.backward) forwardVector.current.z += 1
    if (keys.current.left) sideVector.current.x -= 1
    if (keys.current.right) sideVector.current.x += 1

    moveDirection.current
      .copy(forwardVector.current)
      .add(sideVector.current)
      .normalize()
      .applyEuler(camera.rotation)

    moveDirection.current.y = 0

    if (moveDirection.current.lengthSq() > 0) {
      camera.position.addScaledVector(moveDirection.current, moveDist)
    }

    // Dynamic Floor Height Calculation
    // Check if player is inside Building A bounds
    const inBldgA = camera.position.x > -289 && camera.position.x < -71 && camera.position.z > 57 && camera.position.z < 183
    // Check if player is inside Building B bounds
    const inBldgB = camera.position.x > 71 && camera.position.x < 289 && camera.position.z > 57 && camera.position.z < 183
    
    let targetFloorY = 0
    if (inBldgA || inBldgB) {
      // If inside, the floor is at 4.5 (if underfloor raised) or 0.0 (if normal)
      targetFloorY = underfloorRaised ? 4.5 : 0.0
    }

    // Cinematic Head Bobbing
    let headBobOffset = 0
    if (moveDirection.current.lengthSq() > 0) {
      const bobSpeed = keys.current.sprint ? 15 : 10
      const bobAmount = keys.current.sprint ? 0.12 : 0.06
      headBobOffset = Math.sin(performance.now() / 1000 * bobSpeed) * bobAmount
    }

    // Smoothly interpolate camera Y position to match the floor + 2.75m eye level + head bobbing
    const targetCamY = targetFloorY + 2.75 + headBobOffset
    camera.position.y += (targetCamY - camera.position.y) * 0.15

    // Clamp inside massive campus bounds
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -520, 520)
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -320, 360)

    // Update player transform in Zustand store for live minimap tracking
    setPlayerTransform([camera.position.x, camera.position.y, camera.position.z], camera.rotation.y)
  })

  if (viewMode !== 'fps') return null

  return (
    <PointerLockControls 
      ref={controlsRef} 
      onLock={() => setIsLocked(true)} 
      onUnlock={() => setIsLocked(false)} 
    />
  )
}
