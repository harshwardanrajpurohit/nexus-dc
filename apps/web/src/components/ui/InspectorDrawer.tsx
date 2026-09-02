import {
  X,
  Cpu,
  Zap,
  Thermometer,
  Droplets,
  CheckCircle2,
  AlertTriangle,
  Server,
  Network,
  Sliders
} from 'lucide-react'
import { useStore } from '../../store'

export default function InspectorDrawer() {
  const {
    selectedAsset,
    setSelectedAsset,
    showInspector,
    setShowInspector,
    setFlowTrace,
    openRackId,
    extendedTrayRackId,
    toggleRackDoor,
    toggleServerTray,
    componentOverrides,
    setComponentOverride,
  } = useStore()

  if (!showInspector || !selectedAsset) return null

  const isCritical = selectedAsset.status === 'CRITICAL'
  const isWarning = selectedAsset.status === 'WARNING'
  const isRack = selectedAsset.type === 'rack_gpu' || selectedAsset.type === 'rack_cpu'
  const isCdu = selectedAsset.type === 'cdu'
  const isChiller = selectedAsset.type === 'chiller'
  const isGenerator = selectedAsset.type === 'generator'

  const currentOverride = componentOverrides[selectedAsset.id] || {}
  const activeLoad = currentOverride.loadPercent ?? 85
  const activeFlow = currentOverride.flowLpm ?? (selectedAsset.coolantFlowLpm || 190)
  const activeTemp = currentOverride.tempC ?? (selectedAsset.tempC || 52.8)
  const activeRpm = currentOverride.rpm ?? 1500

  const isDoorOpen = openRackId === selectedAsset.id
  const isTrayOut = extendedTrayRackId === selectedAsset.id

  return (
    <div className="absolute right-68 top-4 bottom-20 w-92 bg-[#0d1117]/95 backdrop-blur-xl border border-[#30363d] rounded-xl shadow-2xl flex flex-col z-30 overflow-hidden animate-in fade-in slide-in-from-right-4 duration-150">
      {/* Drawer Header */}
      <div className="p-3.5 border-b border-[#21262d] flex items-center justify-between bg-[#161b22]/80">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/30">
            <Server className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-white font-mono uppercase tracking-wide truncate max-w-[210px]">
              {selectedAsset.name}
            </h2>
            <div className="text-[10px] text-gray-400 font-mono">{selectedAsset.id}</div>
          </div>
        </div>
        <button
          onClick={() => {
            setShowInspector(false)
            setSelectedAsset(null)
          }}
          className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Drawer Body Content */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3 text-xs font-mono">
        {/* Status Badge */}
        <div className="flex items-center justify-between p-2 rounded-lg bg-[#161b22] border border-[#30363d]">
          <span className="text-gray-400 text-[10px]">OPERATIONAL STATE:</span>
          <div className="flex items-center gap-1.5">
            {isCritical ? (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/40 font-bold text-[10px]">
                <AlertTriangle className="w-3 h-3" />
                CRITICAL FAULT
              </span>
            ) : isWarning ? (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40 font-bold text-[10px]">
                <AlertTriangle className="w-3 h-3" />
                DEGRADED
              </span>
            ) : (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold text-[10px]">
                <CheckCircle2 className="w-3 h-3" />
                ONLINE (OPTIMAL)
              </span>
            )}
          </div>
        </div>

        {/* 1. Interactive 3D Hardware Actions (For Racks) */}
        {isRack && (
          <div className="space-y-1.5 bg-[#161b22] p-2.5 rounded-lg border border-blue-500/30">
            <div className="text-[10px] text-blue-400 uppercase font-bold tracking-wider flex items-center gap-1">
              <Server className="w-3.5 h-3.5" />
              <span>3D Hardware Actions:</span>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => toggleRackDoor(selectedAsset.id)}
                className={`px-2 py-1.5 rounded text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors border ${
                  isDoorOpen
                    ? 'bg-amber-600 text-white border-amber-500'
                    : 'bg-[#21262d] text-gray-200 border-[#30363d] hover:bg-white/10'
                }`}
              >
                <span>{isDoorOpen ? '🚪 Close Door' : '🚪 Open Rack Door'}</span>
              </button>

              <button
                onClick={() => toggleServerTray(selectedAsset.id)}
                className={`px-2 py-1.5 rounded text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors border ${
                  isTrayOut
                    ? 'bg-purple-600 text-white border-purple-500'
                    : 'bg-[#21262d] text-gray-200 border-[#30363d] hover:bg-white/10'
                }`}
              >
                <span>{isTrayOut ? '📤 Push In Tray' : '📥 Slide Out Tray'}</span>
              </button>
            </div>
          </div>
        )}

        {/* 2. Live Component Parameter Sliders (User Tweaking) */}
        <div className="bg-[#161b22] p-2.5 rounded-lg border border-[#30363d] space-y-2">
          <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider flex items-center gap-1">
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            <span>Live Parameter Tweaking:</span>
          </div>

          {/* Workload / Power Load Slider */}
          {isRack && (
            <div className="space-y-1">
              <div className="flex justify-between text-[10px]">
                <span className="text-gray-400">Compute Load:</span>
                <span className="text-white font-bold">{activeLoad}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                value={activeLoad}
                onChange={(e) => {
                  const load = Number(e.target.value)
                  setComponentOverride(selectedAsset.id, { loadPercent: load })
                }}
                className="w-full h-1.5 bg-[#21262d] rounded appearance-none cursor-pointer accent-blue-500"
              />
            </div>
          )}

          {/* Coolant Flow Slider */}
          {(isRack || isCdu) && (
            <div className="space-y-1">
              <div className="flex justify-between text-[10px]">
                <span className="text-gray-400">Coolant Flow:</span>
                <span className="text-cyan-400 font-bold">{activeFlow} LPM</span>
              </div>
              <input
                type="range"
                min="50"
                max="4500"
                value={activeFlow}
                onChange={(e) => {
                  const flow = Number(e.target.value)
                  setComponentOverride(selectedAsset.id, { flowLpm: flow })
                }}
                className="w-full h-1.5 bg-[#21262d] rounded appearance-none cursor-pointer accent-cyan-500"
              />
            </div>
          )}

          {/* Chiller Setpoint */}
          {isChiller && (
            <div className="space-y-1">
              <div className="flex justify-between text-[10px]">
                <span className="text-gray-400">Chilled Water Supply:</span>
                <span className="text-blue-400 font-bold">{activeTemp}°C</span>
              </div>
              <input
                type="range"
                min="4"
                max="14"
                step="0.5"
                value={activeTemp}
                onChange={(e) => {
                  const temp = Number(e.target.value)
                  setComponentOverride(selectedAsset.id, { tempC: temp })
                }}
                className="w-full h-1.5 bg-[#21262d] rounded appearance-none cursor-pointer accent-blue-500"
              />
            </div>
          )}

          {/* Generator RPM */}
          {isGenerator && (
            <div className="space-y-1">
              <div className="flex justify-between text-[10px]">
                <span className="text-gray-400">Engine Speed:</span>
                <span className="text-amber-400 font-bold">{activeRpm} RPM</span>
              </div>
              <input
                type="range"
                min="0"
                max="1500"
                step="50"
                value={activeRpm}
                onChange={(e) => {
                  const rpm = Number(e.target.value)
                  setComponentOverride(selectedAsset.id, { rpm })
                }}
                className="w-full h-1.5 bg-[#21262d] rounded appearance-none cursor-pointer accent-amber-500"
              />
            </div>
          )}
        </div>

        {/* 3. Physical Flow Tracing Actions */}
        <div className="grid grid-cols-3 gap-1.5 pt-0.5">
          <button
            onClick={() => setFlowTrace('power')}
            className="px-2 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors"
          >
            <Zap className="w-3 h-3" />
            <span>Trace Power</span>
          </button>
          <button
            onClick={() => setFlowTrace('cooling')}
            className="px-2 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors"
          >
            <Droplets className="w-3 h-3" />
            <span>Trace Cool</span>
          </button>
          <button
            onClick={() => setFlowTrace('network')}
            className="px-2 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors"
          >
            <Network className="w-3 h-3" />
            <span>Trace Net</span>
          </button>
        </div>

        {/* 4. Live Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-2">
          {selectedAsset.powerKw !== undefined && (
            <div className="p-2 rounded-lg bg-[#161b22] border border-[#30363d] space-y-0.5">
              <div className="flex items-center gap-1 text-[10px] text-gray-400">
                <Zap className="w-3 h-3 text-amber-400" />
                <span>POWER DRAW</span>
              </div>
              <div className="text-sm font-bold text-white">
                {selectedAsset.powerKw >= 1000
                  ? `${(selectedAsset.powerKw / 1000).toFixed(1)} MW`
                  : `${selectedAsset.powerKw} kW`}
              </div>
            </div>
          )}

          {selectedAsset.tempC !== undefined && (
            <div className="p-2 rounded-lg bg-[#161b22] border border-[#30363d] space-y-0.5">
              <div className="flex items-center gap-1 text-[10px] text-gray-400">
                <Thermometer className="w-3 h-3 text-red-400" />
                <span>TEMPERATURE</span>
              </div>
              <div className={`text-sm font-bold ${isCritical ? 'text-red-400 animate-pulse' : 'text-white'}`}>
                {selectedAsset.tempC}°C
              </div>
            </div>
          )}

          {selectedAsset.coolantFlowLpm !== undefined && selectedAsset.coolantFlowLpm > 0 && (
            <div className="p-2 rounded-lg bg-[#161b22] border border-[#30363d] space-y-0.5">
              <div className="flex items-center gap-1 text-[10px] text-gray-400">
                <Droplets className="w-3 h-3 text-cyan-400" />
                <span>COOLANT FLOW</span>
              </div>
              <div className="text-sm font-bold text-white">
                {selectedAsset.coolantFlowLpm.toLocaleString()} LPM
              </div>
            </div>
          )}

          {selectedAsset.serverCount !== undefined && (
            <div className="p-2 rounded-lg bg-[#161b22] border border-[#30363d] space-y-0.5">
              <div className="flex items-center gap-1 text-[10px] text-gray-400">
                <Cpu className="w-3 h-3 text-emerald-400" />
                <span>COMPUTE DIES</span>
              </div>
              <div className="text-sm font-bold text-white">
                {selectedAsset.serverCount.toLocaleString()} Nodes
              </div>
            </div>
          )}
        </div>

        {/* Location Info */}
        {selectedAsset.location && (
          <div className="p-2 rounded-lg bg-[#161b22] border border-[#30363d] space-y-0.5">
            <div className="text-[9px] text-gray-400 uppercase">PHYSICAL LOCATION</div>
            <div className="text-[11px] text-gray-200">{selectedAsset.location}</div>
          </div>
        )}

        {/* Engineering Specification Details Table */}
        {selectedAsset.details && (
          <div className="space-y-1">
            <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">
              FACILITY & HARDWARE ATTRIBUTES
            </div>
            <div className="divide-y divide-[#21262d] border border-[#30363d] rounded-lg bg-[#161b22]/70 overflow-hidden">
              {Object.entries(selectedAsset.details).map(([key, val]) => (
                <div key={key} className="p-2 flex items-center justify-between text-[10px]">
                  <span className="text-gray-400">{key}</span>
                  <span className="text-gray-200 font-semibold text-right max-w-[180px] truncate">{val}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
