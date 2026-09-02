import { useEffect, useRef, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../../store'

export default function AudioSubsystem() {
  const { camera } = useThree()
  const { audioVolume, isAudioMuted, scenario } = useStore()
  
  const listenerRef = useRef<THREE.AudioListener | null>(null)
  
  // Audio Sources
  const genYardAudioRef = useRef<THREE.PositionalAudio | null>(null)
  const chillerPlantAudioRef = useRef<THREE.PositionalAudio | null>(null)
  const dataHallAAudioRef = useRef<THREE.PositionalAudio | null>(null)
  const dataHallBAudioRef = useRef<THREE.PositionalAudio | null>(null)

  // Initialize Listener
  useEffect(() => {
    if (!listenerRef.current) {
      const listener = new THREE.AudioListener()
      camera.add(listener)
      listenerRef.current = listener
    }
    return () => {
      if (listenerRef.current) {
        camera.remove(listenerRef.current)
      }
    }
  }, [camera])

  // Update Master Volume
  useEffect(() => {
    if (listenerRef.current) {
      listenerRef.current.setMasterVolume(isAudioMuted ? 0 : audioVolume)
    }
  }, [audioVolume, isAudioMuted])

  // Procedural Noise Generator for AudioBuffers
  const buffers = useMemo(() => {
    const audioCtx = THREE.AudioContext.getContext() as any
    const sampleRate = audioCtx.sampleRate
    
    const createNoiseBuffer = (durationSecs: number, type: 'white' | 'low-hum' | 'engine') => {
      const frameCount = sampleRate * durationSecs
      const buffer = audioCtx.createBuffer(1, frameCount, sampleRate)
      const data = buffer.getChannelData(0)
      
      for (let i = 0; i < frameCount; i++) {
        if (type === 'white') {
          // Standard white noise (HVAC/Chiller Airflow)
          data[i] = (Math.random() * 2 - 1) * 0.1
        } else if (type === 'low-hum') {
          // 60Hz and 120Hz harmonics (Server/Transformer Hum)
          const t = i / sampleRate
          const hum60 = Math.sin(2 * Math.PI * 60 * t)
          const hum120 = Math.sin(2 * Math.PI * 120 * t)
          data[i] = (hum60 * 0.05 + hum120 * 0.02) + (Math.random() * 2 - 1) * 0.01
        } else if (type === 'engine') {
          // Diesel Engine Rumble (~1800 RPM = 30Hz fundamental)
          const t = i / sampleRate
          const rumble = Math.sin(2 * Math.PI * 30 * t) + 0.5 * Math.sin(2 * Math.PI * 15 * t)
          data[i] = (rumble * 0.1) + (Math.random() * 2 - 1) * 0.05
        }
      }
      return buffer
    }

    return {
      hvac: createNoiseBuffer(2.0, 'white'),
      hum: createNoiseBuffer(2.0, 'low-hum'),
      engine: createNoiseBuffer(2.0, 'engine')
    }
  }, [])

  // Initialize and play positional sounds
  useEffect(() => {
    if (!listenerRef.current) return

    const listener = listenerRef.current

    // 1. Generator Yard (-400, 5, 270)
    const genYardAudio = new THREE.PositionalAudio(listener)
    genYardAudio.setBuffer(buffers.engine)
    genYardAudio.setRefDistance(20)
    genYardAudio.setRolloffFactor(1.5)
    genYardAudio.setLoop(true)
    genYardAudio.setVolume(0) // dynamic based on scenario
    genYardAudioRef.current = genYardAudio

    // 2. Chiller Plant (340, 5, 180)
    const chillerAudio = new THREE.PositionalAudio(listener)
    chillerAudio.setBuffer(buffers.hvac)
    chillerAudio.setRefDistance(30)
    chillerAudio.setRolloffFactor(1.0)
    chillerAudio.setLoop(true)
    chillerAudio.setVolume(0.8)
    chillerPlantAudioRef.current = chillerAudio

    // 3. Data Hall A (Compute) (-180, 5, 120)
    const hallAAudio = new THREE.PositionalAudio(listener)
    hallAAudio.setBuffer(buffers.hum)
    hallAAudio.setRefDistance(40)
    hallAAudio.setRolloffFactor(0.8)
    hallAAudio.setLoop(true)
    hallAAudio.setVolume(0.6)
    dataHallAAudioRef.current = hallAAudio

    // 4. Data Hall B (GPU) (180, 5, 120)
    const hallBAudio = new THREE.PositionalAudio(listener)
    hallBAudio.setBuffer(buffers.hum)
    hallBAudio.setRefDistance(40)
    hallBAudio.setRolloffFactor(0.8)
    hallBAudio.setLoop(true)
    hallBAudio.setVolume(0.8) // GPUs run louder
    dataHallBAudioRef.current = hallBAudio

    // Play all (browser might block if no user interaction, handled implicitly in UI)
    try {
      genYardAudio.play()
      chillerAudio.play()
      hallAAudio.play()
      hallBAudio.play()
    } catch (e) {
      console.log('Audio autoplay blocked until interaction')
    }

    return () => {
      genYardAudio.stop()
      chillerAudio.stop()
      hallAAudio.stop()
      hallBAudio.stop()
    }
  }, [buffers])

  // Update dynamic sounds based on scenario (e.g., Generators start on Grid Loss)
  useEffect(() => {
    if (genYardAudioRef.current) {
      const isRunning = scenario === 'GRID_LOSS'
      // Smoothly transition volume in a real app, here we snap for simplicity
      genYardAudioRef.current.setVolume(isRunning ? 1.0 : 0.05) 
    }
  }, [scenario])

  return (
    <group>
      {/* Attach Audio Objects to Scene Coordinates */}
      <group position={[-400, 5, 270]}>
        {genYardAudioRef.current && <primitive object={genYardAudioRef.current} />}
      </group>
      <group position={[340, 5, 180]}>
        {chillerPlantAudioRef.current && <primitive object={chillerPlantAudioRef.current} />}
      </group>
      <group position={[-180, 5, 120]}>
        {dataHallAAudioRef.current && <primitive object={dataHallAAudioRef.current} />}
      </group>
      <group position={[180, 5, 120]}>
        {dataHallBAudioRef.current && <primitive object={dataHallBAudioRef.current} />}
      </group>
    </group>
  )
}
