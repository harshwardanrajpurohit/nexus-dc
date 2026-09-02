import { Navigation } from 'lucide-react'
import { useStore } from '../../store'
import type { WaypointId } from '../../store'

export default function CampusMinimap() {
  const { showMinimap, setWaypoint, cutaway, playerPos } = useStore()
  const { flowTrace } = cutaway

  if (!showMinimap) return null

  // Transform 3D world coordinates [-500, 500] to minimap SVG [0, 260]
  const mapX = (playerPos[0] + 550) * (260 / 1100)
  const mapY = (playerPos[2] + 400) * (200 / 800)

  const buildings: { id: WaypointId; name: string; x: number; y: number; w: number; h: number; color: string }[] = [
    { id: 'building_a', name: 'BUILDING A (COMPUTE)', x: 45, y: 110, w: 55, h: 38, color: '#0284c7' },
    { id: 'building_b', name: 'BUILDING B (AI GPU)', x: 145, y: 110, w: 55, h: 38, color: '#06b6d4' },
    { id: 'building_e', name: 'BUILDING E (CLOUD)', x: 30, y: 45, w: 50, h: 35, color: '#a855f7' },
    { id: 'building_d', name: 'BUILDING D (STORAGE)', x: 95, y: 45, w: 50, h: 35, color: '#38bdf8' },
    { id: 'building_c', name: 'BUILDING C (AI HALL 2)', x: 160, y: 45, w: 50, h: 35, color: '#06b6d4' },
    { id: 'power_substation', name: '230kV SUBSTATION', x: 8, y: 95, w: 28, h: 48, color: '#eab308' },
    { id: 'generator_yard', name: '60MW GEN YARD', x: 12, y: 155, w: 32, h: 30, color: '#f59e0b' },
    { id: 'ups_building', name: 'UPS & BESS', x: 105, y: 155, w: 34, h: 22, color: '#f59e0b' },
    { id: 'cooling_plant', name: 'COOLING PLANT', x: 195, y: 145, w: 30, h: 22, color: '#00e5ff' },
    { id: 'water_infrastructure', name: 'WATER & TOWERS', x: 228, y: 135, w: 26, h: 45, color: '#0284c7' },
    { id: 'security_gate', name: 'SECURITY GATE', x: 108, y: 184, w: 26, h: 12, color: '#ef4444' },
  ]

  return (
    <div className="absolute bottom-16 right-4 z-20 bg-[#0c1017]/95 backdrop-blur-xl border border-[#30363d] rounded-xl p-2.5 shadow-2xl select-none font-mono text-[10px] w-72">
      {/* Header */}
      <div className="flex items-center justify-between pb-1.5 border-b border-[#21262d] text-gray-300">
        <div className="flex items-center gap-1.5 font-bold uppercase text-blue-400">
          <Navigation className="w-3.5 h-3.5" />
          <span>Campus Radar Minimap</span>
        </div>
        <span className="text-[9px] text-gray-500">100,000 SERVERS</span>
      </div>

      {/* SVG Interactive Map Canvas */}
      <div className="relative mt-2 bg-[#161b22] rounded-lg border border-[#30363d] overflow-hidden">
        <svg viewBox="0 0 260 200" className="w-full h-auto cursor-crosshair">
          {/* Background Grid */}
          <defs>
            <pattern id="radarGrid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#21262d" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="260" height="200" fill="url(#radarGrid)" />

          {/* Road Network Overlays */}
          <path d="M 10 90 L 250 90" stroke="#334155" strokeWidth="6" />
          <path d="M 10 150 L 250 150" stroke="#334155" strokeWidth="6" />
          <path d="M 120 10 L 120 190" stroke="#334155" strokeWidth="6" />

          {/* Active Flow Trace Highlights on Minimap */}
          {flowTrace === 'power' && (
            <path
              d="M 22 120 L 28 170 L 122 165 L 122 90 L 185 90 L 72 90"
              stroke="#eab308"
              strokeWidth="2.5"
              fill="none"
              strokeDasharray="4 2"
              className="animate-pulse"
            />
          )}
          {flowTrace === 'cooling' && (
            <path
              d="M 240 155 L 210 155 L 172 130 L 72 130 L 210 90 L 185 62 L 55 62"
              stroke="#00e5ff"
              strokeWidth="2.5"
              fill="none"
              strokeDasharray="4 2"
              className="animate-pulse"
            />
          )}
          {flowTrace === 'network' && (
            <path
              d="M 120 190 L 120 130 L 72 130 L 172 130 L 120 62 L 55 62 L 185 62"
              stroke="#a855f7"
              strokeWidth="2.5"
              fill="none"
              strokeDasharray="4 2"
              className="animate-pulse"
            />
          )}

          {/* 5 Buildings & Infrastructure Nodes */}
          {buildings.map((b) => (
            <g
              key={`mini-${b.id}`}
              onClick={() => setWaypoint(b.id)}
              className="cursor-pointer group hover:opacity-80 transition-opacity"
            >
              <rect
                x={b.x}
                y={b.y}
                width={b.w}
                height={b.h}
                fill={b.color}
                fillOpacity="0.3"
                stroke={b.color}
                strokeWidth="1.2"
                rx="2"
              />
              <text
                x={b.x + b.w / 2}
                y={b.y + b.h / 2 + 3}
                fontSize="6"
                fill="#ffffff"
                textAnchor="middle"
                fontWeight="bold"
              >
                {b.name.split(' ')[0]}
              </text>
            </g>
          ))}

          {/* Player Live Location Indicator */}
          <circle cx={Math.max(8, Math.min(252, mapX))} cy={Math.max(8, Math.min(192, mapY))} r="4" fill="#22c55e" className="animate-ping" />
          <circle cx={Math.max(8, Math.min(252, mapX))} cy={Math.max(8, Math.min(192, mapY))} r="3" fill="#22c55e" stroke="#ffffff" strokeWidth="1" />
        </svg>
      </div>

      <div className="flex items-center justify-between pt-1.5 text-[9px] text-gray-400">
        <span>Click any facility to teleport</span>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>Player Position</span>
        </div>
      </div>
    </div>
  )
}
