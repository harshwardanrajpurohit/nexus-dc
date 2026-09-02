import { Navigation, Eye, CheckCircle2 } from 'lucide-react'
import { useStore } from '../../store'
import type { WaypointId } from '../../store'

interface WaypointCard {
  id: WaypointId;
  title: string;
  subtitle: string;
  badge: string;
  color: string;
}

const WAYPOINTS: WaypointCard[] = [
  {
    id: 'campus_overview',
    title: '5-Building Campus Overview',
    subtitle: '100,000 Physical Servers',
    badge: 'HERO MASTER',
    color: 'border-blue-500/50 bg-blue-950/20 text-blue-400',
  },
  {
    id: 'building_a',
    title: 'Data Center A (Compute)',
    subtitle: '20,000 Xeon/EPYC Servers',
    badge: '19" COMPUTE',
    color: 'border-emerald-500/50 bg-emerald-950/20 text-emerald-400',
  },
  {
    id: 'building_b',
    title: 'Data Center B (AI GPU)',
    subtitle: '20,000 GB200 Liquid Dies',
    badge: '132 kW/RACK',
    color: 'border-cyan-500/50 bg-cyan-950/20 text-cyan-400',
  },
  {
    id: 'building_c',
    title: 'Data Center C (AI Hall 2)',
    subtitle: '20,000 High-Density Servers',
    badge: 'AI TRAINING',
    color: 'border-teal-500/50 bg-teal-950/20 text-teal-400',
  },
  {
    id: 'building_d',
    title: 'Data Center D (Storage)',
    subtitle: '20,000 Exabyte Storage Nodes',
    badge: 'CLOUD STORAGE',
    color: 'border-sky-500/50 bg-sky-950/20 text-sky-400',
  },
  {
    id: 'building_e',
    title: 'Data Center E (Cloud)',
    subtitle: '20,000 Multi-Tenant Nodes',
    badge: 'K8s CLOUD',
    color: 'border-purple-500/50 bg-purple-950/20 text-purple-400',
  },
  {
    id: 'power_substation',
    title: '230kV Grid Substation',
    subtitle: '4x 100MVA Transformers',
    badge: '120 MW GRID',
    color: 'border-yellow-500/50 bg-yellow-950/20 text-yellow-400',
  },
  {
    id: 'generator_yard',
    title: '60 MW Generator Yard',
    subtitle: '16x 3.75MW Diesel Gensets',
    badge: '60 MW / 7 DAYS',
    color: 'border-orange-500/50 bg-orange-950/20 text-orange-400',
  },
  {
    id: 'ups_building',
    title: 'Central UPS & BESS',
    subtitle: '80 MW / 160 MWh Battery Vault',
    badge: '0ms TRANSFER',
    color: 'border-amber-500/50 bg-amber-950/20 text-amber-400',
  },
  {
    id: 'cooling_plant',
    title: 'Central Cooling Plant',
    subtitle: '30,000 Tons Chiller Facility',
    badge: '30,000 TONS',
    color: 'border-teal-500/50 bg-teal-950/20 text-teal-400',
  },
  {
    id: 'water_infrastructure',
    title: 'Water Storage & Towers',
    subtitle: '18-Cell Towers + 5M Gal Tanks',
    badge: '1.25M LPM',
    color: 'border-cyan-500/50 bg-cyan-950/20 text-cyan-400',
  },
  {
    id: 'security_gate',
    title: 'Main Security Portal',
    subtitle: 'Guardhouse, Barriers & CCTV',
    badge: 'LOGISTICS GATE',
    color: 'border-slate-500/50 bg-slate-800/40 text-slate-300',
  },
  {
    id: 'rack_closeup',
    title: 'Rack & Blade Close-Up',
    subtitle: 'Inspect Server Dies & Trays',
    badge: 'GB200 SILICON',
    color: 'border-blue-500/50 bg-blue-950/20 text-blue-400',
  },
]

export default function WaypointsPanel() {
  const { currentWaypoint, setWaypoint } = useStore()

  return (
    <aside className="w-68 bg-[#0d1117]/95 backdrop-blur-md border-l border-[#21262d] flex flex-col h-full select-none z-10">
      {/* Header */}
      <div className="p-3 border-b border-[#21262d] flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold text-gray-200 uppercase tracking-wider font-mono">
          <Navigation className="w-4 h-4 text-blue-400" />
          <span>Campus Facilities</span>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
          5 BUILDINGS
        </span>
      </div>

      {/* Waypoint Cards List */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
        {WAYPOINTS.map((wp) => {
          const isActive = currentWaypoint === wp.id

          return (
            <div
              key={wp.id}
              onClick={() => setWaypoint(wp.id)}
              className={`p-2.5 rounded-lg border cursor-pointer transition-all duration-150 group ${
                isActive
                  ? `${wp.color} shadow-lg shadow-blue-500/10 scale-[1.02]`
                  : 'bg-[#161b22]/70 border-[#30363d] hover:bg-[#21262d] hover:border-gray-500 text-gray-300'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs font-mono text-white group-hover:text-blue-300 transition-colors">
                      {wp.title}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-400">{wp.subtitle}</div>
                </div>
                {isActive ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                ) : (
                  <Eye className="w-3.5 h-3.5 text-gray-500 group-hover:text-white shrink-0" />
                )}
              </div>

              <div className="mt-2 flex items-center justify-between">
                <span className="text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded bg-black/40 border border-white/10 text-gray-300">
                  {wp.badge}
                </span>
                <span className="text-[9px] font-mono text-gray-500 group-hover:text-gray-300">
                  {isActive ? 'CURRENT' : 'NAVIGATE'}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
