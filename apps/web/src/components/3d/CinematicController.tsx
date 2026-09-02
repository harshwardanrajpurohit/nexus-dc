import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../../store'

export const TOUR_WAYPOINTS = [
  { 
    id: 'intro',
    targetId: 'CAMPUS',
    title: 'Hyperscale Campus',
    position: [380, 220, 380], 
    lookAt: [0, 10, 0], 
    narration: "Welcome to the Hyperscale Cloud Data Center. This 100-megawatt campus consists of five independent data halls.",
    preHold: 1.0,
    postHold: 1.5,
  },
  { 
    id: 'substation',
    targetId: 'CAMPUS-SUBSTATION',
    title: 'Utility Substation',
    position: [-380, 48, 120], 
    lookAt: [-420, 8, 80], 
    narration: "On our right is the 230 kilovolt utility transmission yard, supplying primary power to the facility.",
    preHold: 1.0,
    postHold: 1.5,
  },
  { 
    id: 'generator',
    targetId: 'CAMPUS-GENERATOR-PLANT',
    title: 'Generator Yard',
    position: [-350, 32, 260], 
    lookAt: [-400, 6, 270], 
    narration: "Here is the 60-megawatt standby diesel generator plant, ready to provide backup power in under ten seconds.",
    preHold: 1.0,
    postHold: 1.5,
  },
  { 
    id: 'data-hall-a',
    targetId: 'DC-A-RACK-R4-K7',
    title: 'Building A: Compute Hall',
    position: [-180, 7.5, 145], 
    lookAt: [-180, 4.4, 120], 
    narration: "We are now inside Building A. This hall houses tens of thousands of enterprise compute servers using cold aisle containment.",
    preHold: 1.5,
    postHold: 2.0,
  },
  { 
    id: 'data-hall-b',
    targetId: 'DC-B-GPU-RACK-R4-K7',
    title: 'Building B: AI GPU Cluster',
    position: [180, 7.5, 145], 
    lookAt: [180, 4.4, 120], 
    narration: "Building B features high-density liquid-cooled racks, purpose-built for intense artificial intelligence workloads.",
    preHold: 1.5,
    postHold: 2.0,
  },
  { 
    id: 'cooling-plant',
    targetId: 'CAMPUS-COOLING-PLANT',
    title: 'Central Cooling Plant',
    position: [380, 52, 180], 
    lookAt: [430, 10, 180], 
    narration: "This is the central mechanical cooling plant, rejecting over thirty thousand tons of thermal heat using massive cooling towers.",
    preHold: 1.0,
    postHold: 1.5,
  },
  { 
    id: 'north-quad',
    targetId: 'CAMPUS',
    title: 'North Quad',
    position: [0, 68, -140], 
    lookAt: [0, 8, -140], 
    narration: "Finally, the North Quad, housing additional storage and network capacity, completing our digital twin tour.",
    preHold: 1.0,
    postHold: 2.0,
  }
]

export default function CinematicController() {
  const { 
    viewMode, 
    isAudioMuted, 
    tourState, setTourState, 
    tourIndex, setTourIndex,
    setTourTargetId,
    isTourPaused
  } = useStore()
  
  const { camera } = useThree()
  
  // State Machine Timers & Refs
  const timerRef = useRef(0)
  const currentLookAt = useRef(new THREE.Vector3())
  const orbitalOffset = useRef(0)
  
  const moveStartPos = useRef(new THREE.Vector3())
  const moveStartLook = useRef(new THREE.Vector3())
  
  // Voice Synthesis state
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  
  // On Mount / Unmount / Mode switch
  useEffect(() => {
    if (viewMode !== 'cinematic') {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
      setTourState('MOVING')
      setTourIndex(0)
      setTourTargetId(null)
    } else {
      // Init Camera position for the very first frame to avoid wild flying
      const wp = TOUR_WAYPOINTS[0]
      camera.position.set(wp.position[0], wp.position[1], wp.position[2])
      currentLookAt.current.set(wp.lookAt[0], wp.lookAt[1], wp.lookAt[2])
      moveStartPos.current.copy(camera.position)
      moveStartLook.current.copy(currentLookAt.current)
    }
  }, [viewMode])

  // Ensure voices load
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const loadVoices = () => { window.speechSynthesis.getVoices() }
      loadVoices()
      window.speechSynthesis.onvoiceschanged = loadVoices
    }
  }, [])

  // Handle Pause/Resume Voice
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      if (isTourPaused || isAudioMuted) {
        window.speechSynthesis.pause()
      } else {
        window.speechSynthesis.resume()
      }
    }
  }, [isTourPaused, isAudioMuted])

  useFrame((_, delta) => {
    if (viewMode !== 'cinematic' || isTourPaused) return
    
    // Safety clamp delta to prevent huge jumps if tab was inactive
    const dt = Math.min(delta, 0.1)
    
    const wp = TOUR_WAYPOINTS[tourIndex]
    if (!wp) {
      // Loop back or finish
      setTourIndex(0)
      setTourState('MOVING')
      return
    }

    const targetPos = new THREE.Vector3(...wp.position)
    const targetLook = new THREE.Vector3(...wp.lookAt)

    if (tourState === 'MOVING') {
      // Clear highlight if we are moving to next target
      setTourTargetId(null)

      timerRef.current += dt
      
      // Calculate transition duration dynamically based on distance (clamp 3s to 7s)
      const dist = moveStartPos.current.distanceTo(targetPos)
      const duration = Math.max(3.0, Math.min(7.0, dist / 80.0))
      
      const progress = Math.min(timerRef.current / duration, 1.0)
      // Cubic ease in-out (smoothstep)
      const ease = progress * progress * (3 - 2 * progress)

      // Lerp camera
      camera.position.lerpVectors(moveStartPos.current, targetPos, ease)
      currentLookAt.current.lerpVectors(moveStartLook.current, targetLook, ease)
      camera.lookAt(currentLookAt.current)

      // Check arrival
      if (progress >= 1.0) {
        setTourState('ARRIVING')
      }
    } 
    else if (tourState === 'ARRIVING') {
      // Hard set just to be precise
      camera.position.copy(targetPos)
      currentLookAt.current.copy(targetLook)
      camera.lookAt(currentLookAt.current)
      
      timerRef.current = 0
      setTourState('FRAMING')
    }
    else if (tourState === 'FRAMING') {
      timerRef.current += dt
      
      if (timerRef.current >= wp.preHold * 0.5 && useStore.getState().tourTargetId !== wp.targetId) {
        setTourTargetId(wp.targetId)
      }

      if (timerRef.current >= wp.preHold) {
        setTourState('READY_TO_NARRATE')
      }
    }
    else if (tourState === 'READY_TO_NARRATE') {
      if (!isAudioMuted && typeof window !== 'undefined' && window.speechSynthesis) {
        const utterance = new SpeechSynthesisUtterance(wp.narration)
        const voices = window.speechSynthesis.getVoices()
        if (voices.length > 0) {
          const premiumVoice = voices.find(v => 
            v.name.includes('Google US English') || 
            v.name.includes('Samantha') || 
            v.name.includes('Edge') ||
            v.name.includes('Microsoft Aria')
          )
          utterance.voice = premiumVoice || voices.find(v => v.lang.startsWith('en')) || voices[0]
        }
        
        utterance.rate = 1.0
        
        // Critical: Event Driven State Transition
        utterance.onend = () => {
          if (useStore.getState().tourState === 'NARRATING') {
            useStore.getState().setTourState('POST_HOLD')
            timerRef.current = 0
          }
        }
        
        utterance.onerror = (e) => {
          console.warn('SpeechSynthesis error:', e)
          if (useStore.getState().tourState === 'NARRATING') {
            useStore.getState().setTourState('POST_HOLD')
            timerRef.current = 0
          }
        }

        utteranceRef.current = utterance
        window.speechSynthesis.speak(utterance)
        setTourState('NARRATING')
      } else {
        // Audio muted or not supported, use dummy timer based on text length (~13 chars/sec)
        const estDuration = (wp.narration.length / 13.0) 
        timerRef.current = -estDuration
        setTourState('NARRATING')
      }
      orbitalOffset.current = 0
    }
    else if (tourState === 'NARRATING') {
      // Extremely subtle cinematic orbital motion
      orbitalOffset.current += dt * 0.05
      const subtlePos = targetPos.clone().add(
        new THREE.Vector3(Math.sin(orbitalOffset.current) * 2, Math.cos(orbitalOffset.current * 0.5) * 1, 0)
      )
      camera.position.lerp(subtlePos, 0.1)
      camera.lookAt(currentLookAt.current) // Maintain target lock
      
      // If muted, we are using negative timerRef as a countdown
      if (isAudioMuted || !window.speechSynthesis) {
        timerRef.current += dt
        if (timerRef.current >= 0) {
          setTourState('POST_HOLD')
          timerRef.current = 0
        }
      }
    }
    else if (tourState === 'POST_HOLD') {
      timerRef.current += dt
      camera.lookAt(currentLookAt.current)
      
      if (timerRef.current >= wp.postHold) {
        setTourState('TRANSITIONING')
      }
    }
    else if (tourState === 'TRANSITIONING') {
      // Store start pos for next move
      moveStartPos.current.copy(camera.position)
      moveStartLook.current.copy(currentLookAt.current)

      // Move to next waypoint
      const nextIdx = tourIndex + 1
      if (nextIdx >= TOUR_WAYPOINTS.length) {
        setTourIndex(0) // Loop
      } else {
        setTourIndex(nextIdx)
      }
      timerRef.current = 0
      setTourState('MOVING')
    }
  })

  return null
}
