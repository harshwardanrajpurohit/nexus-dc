import {
  Zap,
  Droplets,
  Activity,
  Network,
  ShieldCheck,
  Building
} from 'lucide-react'
import { useStore } from '../../store'

export default function TopNav() {
  const { telemetry, scenario, activeAppTab, setActiveAppTab } = useStore()

  return (
    <header className="h-14 bg-[#0d1117]/95 backdrop-blur-md border-b border-[#21262d] px-4 flex items-center justify-between select-none z-30">
      {/* 1. Facility Branding */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-inner">
          <Building className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-sm tracking-wider text-white font-mono uppercase">
              HYPERSCALE CLOUD CAMPUS
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
              5 FACILITIES
            </span>
          </div>
          <div className="text-[11px] text-gray-400 font-mono flex items-center gap-2">
            <span className="text-emerald-400 font-semibold">100,000 SERVERS</span>
            <span>•</span>
            <span>8,000 RACKS</span>
            <span>•</span>
            <span>120 MW UTILITY</span>
          </div>
        </div>
      </div>

      {/* 2. Live Key Operational Telemetry Ribbon */}
      <div className="hidden lg:flex items-center gap-4 text-xs font-mono">
        {/* Total Facility Power & PUE */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#161b22] border border-[#30363d]">
          <Zap className="w-4 h-4 text-amber-400" />
          <div>
            <div className="text-[10px] text-gray-400 uppercase">FACILITY POWER / PUE</div>
            <div className="font-bold text-white">
              {telemetry.power_facility_mw.toFixed(1)} MW{' '}
              <span className="text-emerald-400 font-normal">/ PUE {telemetry.pue.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Chilled Water Coolant Loop Flow */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#161b22] border border-[#30363d]">
          <Droplets className="w-4 h-4 text-cyan-400" />
          <div>
            <div className="text-[10px] text-gray-400 uppercase">COOLING / 30,000 TONS</div>
            <div className="font-bold text-white">
              {telemetry.coolant_flow_lpm.toLocaleString()} LPM{' '}
              <span className="text-cyan-400 font-normal">{telemetry.temp_cooling_water_supply_c}°C In</span>
            </div>
          </div>
        </div>

        {/* AI GPU Silicon Temperature */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#161b22] border border-[#30363d]">
          <Activity className="w-4 h-4 text-emerald-400" />
          <div>
            <div className="text-[10px] text-gray-400 uppercase">GPU DIES / RETURN</div>
            <div className="font-bold text-white">
              {telemetry.temp_gpu_avg_c.toFixed(1)}°C{' '}
              <span className="text-gray-400 font-normal">({telemetry.temp_cooling_water_return_c}°C Out)</span>
            </div>
          </div>
        </div>

        {/* Optical Backbone Network Fabric Throughput */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#161b22] border border-[#30363d]">
          <Network className="w-4 h-4 text-purple-400" />
          <div>
            <div className="text-[10px] text-gray-400 uppercase">OPTICAL NETWORK FABRIC</div>
            <div className="font-bold text-white">
              {telemetry.network_throughput_tbps.toFixed(1)} Tbps{' '}
              <span className="text-purple-400 font-normal">OCS/800G</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Operational Grid Status & View Mode Switcher */}
      <div className="flex items-center gap-3">
        {/* Tab switcher: 3D Twin vs Control Room vs REGEN-DC Optimizer */}
        <div className="flex items-center p-1 rounded-lg bg-[#161b22] border border-[#30363d] text-xs font-mono">
          <button
            onClick={() => setActiveAppTab('3d')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded transition-all ${
              activeAppTab === '3d'
                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            <span>3D Facility</span>
          </button>
          <button
            onClick={() => setActiveAppTab('operations')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded transition-all ${
              activeAppTab === 'operations'
                ? 'bg-cyan-600 text-white font-semibold shadow-sm'
                : 'text-gray-400 hover:text-cyan-400'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>Control Room</span>
          </button>
          <button
            onClick={() => setActiveAppTab('optimization')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded transition-all ${
              activeAppTab === 'optimization'
                ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                : 'text-gray-400 hover:text-emerald-400'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>REGEN-DC Optimizer</span>
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#161b22] border border-emerald-500/30 text-emerald-400 text-xs font-mono font-semibold">
          <ShieldCheck className="w-4 h-4" />
          <span>{scenario === 'GRID_LOSS' ? '60MW GEN ACTIVE' : 'GRID 2N SYNC (99.999%)'}</span>
        </div>
      </div>
    </header>
  )
}
