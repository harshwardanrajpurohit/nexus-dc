import { useEffect } from 'react'
import { useStore } from './store'
import Scene3D from './components/3d/Scene3D'
import TopNav from './components/ui/TopNav'
import CutawayToolbar from './components/ui/CutawayToolbar'
import WaypointsPanel from './components/ui/WaypointsPanel'
import TourPanel from './components/ui/TourPanel'
import TimelineControls from './components/ui/TimelineControls'
import InspectorDrawer from './components/ui/InspectorDrawer'
import CampusMinimap from './components/ui/CampusMinimap'

import OptimizationDashboard from './components/ui/OptimizationDashboard'
import LiveOperationsDashboard from './components/ui/LiveOperationsDashboard'

function App() {
  const { setTelemetry, activeAppTab } = useStore()

  useEffect(() => {
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws'
    let ws: WebSocket | null = null
    let reconnectTimeout: any = null

    const connectWs = () => {
      try {
        ws = new WebSocket(wsUrl)

        ws.onopen = () => {
          console.log('[Digital Twin] Connected to 100,000-Server Campus Telemetry Stream')
        }

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            if (data.type === 'TELEMETRY' && data.global) {
              setTelemetry(data.global)
            }
          } catch (e) {
            console.error('[WS Parse Error]', e)
          }
        }

        ws.onclose = () => {
          reconnectTimeout = setTimeout(connectWs, 3000)
        }

        ws.onerror = () => {
          ws?.close()
        }
      } catch (err) {
        reconnectTimeout = setTimeout(connectWs, 3000)
      }
    }

    connectWs()

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout)
      ws?.close()
    }
  }, [setTelemetry])

  return (
    <div className="flex flex-col h-screen w-screen bg-[#080c14] text-[#c9d1d9] font-sans overflow-hidden select-none">
      {/* 1. Top KPI Metrics Ribbon */}
      <TopNav />

      {/* 2. Main Content View: 3D Campus vs Control Room vs REGEN-DC Optimization Dashboard */}
      {activeAppTab === 'optimization' ? (
        <OptimizationDashboard />
      ) : activeAppTab === 'operations' ? (
        <LiveOperationsDashboard />
      ) : (
        <>
          <div className="flex-1 flex relative overflow-hidden">
            {/* Main 3D Canvas */}
            <main className="flex-1 relative h-full bg-[#0f172a]">
              {/* Floating Cutaway, Lighting & Failure Toolbar */}
              <CutawayToolbar />

              {/* Master 3D Scene */}
              <Scene3D />

              {/* Interactive 2D Radar Minimap with teleportation */}
              <CampusMinimap />

              {/* Slide-over Component Inspector & Live Parameter Sliders */}
              <InspectorDrawer />
            </main>

            {/* Right Campus Facilities Navigator */}
            <WaypointsPanel />

            {/* Tour Overlay (Cinematic Mode) */}
            <TourPanel />
          </div>

          {/* 3. Bottom Timeline Scrubber & Scenarios */}
          <TimelineControls />
        </>
      )}
    </div>
  )
}

export default App
