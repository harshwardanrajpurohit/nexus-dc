import {
  Building,
  Layers,
  Zap,
  Droplets,
  Network,
  Sun,
  Sunset,
  Lightbulb,
  Moon,
  Footprints,
  Video,
  Compass,
  Map,
  AlertTriangle,
  Eye,
  Cpu,
  Volume2,
  VolumeX
} from 'lucide-react'
import { useStore } from '../../store'
import type { WallsMode, FlowTraceMode } from '../../store'

export default function CutawayToolbar() {
  const {
    cutaway,
    setRoofVisible,
    setWallsMode,
    setUnderfloorRaised,
    setFlowTrace,
    viewMode,
    setViewMode,
    lightingMode,
    setLightingMode,
    showMinimap,
    setShowMinimap,
    scenario,
    setScenario,
    visualMode,
    setVisualMode,
    audioVolume,
    setAudioVolume,
    isAudioMuted,
    setIsAudioMuted,
  } = useStore()

  const { roofVisible, wallsMode, underfloorRaised, flowTrace } = cutaway

  return (
    <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2 bg-[#0c1017]/95 backdrop-blur-md border border-[#30363d] rounded-xl p-1.5 shadow-2xl select-none text-xs font-mono">
      {/* 0. Photorealism vs Engineering Mode */}
      <div className="flex items-center gap-1 bg-[#161b22] p-1 rounded-lg border border-[#30363d] mr-2">
        <button
          onClick={() => setVisualMode('realism')}
          className={`px-3 py-1 rounded-lg flex items-center gap-2 transition-all ${
            visualMode === 'realism'
              ? 'bg-blue-600 text-white font-bold shadow'
              : 'text-gray-400 hover:text-white hover:bg-white/10'
          }`}
          title="Photorealistic architectural view with natural materials"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>REALISM</span>
        </button>
        <button
          onClick={() => setVisualMode('engineering')}
          className={`px-3 py-1 rounded-lg flex items-center gap-2 transition-all ${
            visualMode === 'engineering'
              ? 'bg-purple-600 text-white font-bold shadow'
              : 'text-gray-400 hover:text-white hover:bg-white/10'
          }`}
          title="Engineering digital twin view with glowing infrastructure flows"
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>ENGINEERING</span>
        </button>
      </div>

      {/* 1. Camera View Mode Switcher */}
      <div className="flex items-center gap-1 bg-[#161b22] p-1 rounded-lg border border-[#30363d]">
        <span className="text-[10px] text-gray-400 px-1 uppercase flex items-center gap-1">
          <Compass className="w-3 h-3 text-blue-400" />
          <span>View:</span>
        </span>
        <button
          onClick={() => setViewMode('orbit')}
          className={`px-2 py-0.5 rounded text-[11px] uppercase transition-colors ${
            viewMode === 'orbit'
              ? 'bg-blue-600 text-white font-bold'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
          title="Architectural Cutaway 3D Orbit View"
        >
          Cutaway
        </button>

        <button
          onClick={() => setViewMode('fps')}
          className={`px-2 py-0.5 rounded text-[11px] uppercase flex items-center gap-1 transition-colors ${
            viewMode === 'fps'
              ? 'bg-emerald-600 text-white font-bold shadow'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
          title="Walk freely across the campus & aisles using WASD + Mouse look at human eye level"
        >
          <Footprints className="w-3 h-3" />
          <span>Walk Mode</span>
        </button>

        <button
          onClick={() => setViewMode('cinematic')}
          className={`px-2 py-0.5 rounded text-[11px] uppercase flex items-center gap-1 transition-colors ${
            viewMode === 'cinematic'
              ? 'bg-purple-600 text-white font-bold shadow'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
          title="Automated cinematic drone flyover across all 5 buildings and yards"
        >
          <Video className="w-3 h-3" />
          <span>Drone Tour</span>
        </button>
      </div>

      {/* 2. Natural Lighting Preset Switcher */}
      <div className="flex items-center gap-1 bg-[#161b22] p-1 rounded-lg border border-[#30363d]">
        <span className="text-[10px] text-gray-400 px-1 uppercase flex items-center gap-1">
          <Sun className="w-3 h-3 text-amber-400" />
          <span>Light:</span>
        </span>

        <button
          onClick={() => setLightingMode('daylight')}
          className={`px-2 py-0.5 rounded text-[11px] flex items-center gap-1 transition-colors ${
            lightingMode === 'daylight'
              ? 'bg-amber-600 text-white font-bold'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
          title="Natural sunny daylight sky with crisp shadows"
        >
          <Sun className="w-3 h-3" />
          <span>Daylight</span>
        </button>

        <button
          onClick={() => setLightingMode('golden_hour')}
          className={`px-2 py-0.5 rounded text-[11px] flex items-center gap-1 transition-colors ${
            lightingMode === 'golden_hour'
              ? 'bg-orange-600 text-white font-bold'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
          title="Golden hour sunset glow"
        >
          <Sunset className="w-3 h-3" />
          <span>Sunset</span>
        </button>

        <button
          onClick={() => setLightingMode('studio')}
          className={`px-2 py-0.5 rounded text-[11px] flex items-center gap-1 transition-colors ${
            lightingMode === 'studio'
              ? 'bg-slate-600 text-white font-bold'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
          title="High-key clean studio lighting"
        >
          <Lightbulb className="w-3 h-3" />
          <span>Studio</span>
        </button>

        <button
          onClick={() => setLightingMode('night')}
          className={`px-2 py-0.5 rounded text-[11px] flex items-center gap-1 transition-colors ${
            lightingMode === 'night'
              ? 'bg-indigo-600 text-white font-bold'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
          title="Night facility security floodlights"
        >
          <Moon className="w-3 h-3" />
          <span>Night</span>
        </button>
      </div>

      {/* 3. Roof & Walls Cutaway Controls */}
      <button
        onClick={() => setRoofVisible(!roofVisible)}
        className={`px-2 py-1 rounded-lg flex items-center gap-1 transition-colors ${
          roofVisible
            ? 'bg-blue-600 text-white shadow'
            : 'text-gray-400 hover:text-white hover:bg-white/10'
        }`}
      >
        <Building className="w-3.5 h-3.5" />
        <span>Roof: {roofVisible ? 'ON' : 'OFF'}</span>
      </button>

      <div className="flex items-center gap-1 bg-[#161b22] p-1 rounded-lg border border-[#30363d]">
        <span className="text-[10px] text-gray-500 px-1 uppercase">Walls:</span>
        {(['cutaway', 'solid', 'glass', 'hidden'] as WallsMode[]).map((mode) => (
          <button
            key={`wall-mode-${mode}`}
            onClick={() => setWallsMode(mode)}
            className={`px-2 py-0.5 rounded text-[11px] uppercase transition-colors ${
              wallsMode === mode
                ? 'bg-blue-600 text-white font-bold'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {mode}
          </button>
        ))}
      </div>

      {/* 4. Underfloor Raised Floor Lift */}
      <button
        onClick={() => setUnderfloorRaised(!underfloorRaised)}
        className={`px-2 py-1 rounded-lg flex items-center gap-1 transition-colors ${
          underfloorRaised
            ? 'bg-purple-600 text-white shadow'
            : 'text-gray-400 hover:text-white hover:bg-white/10'
        }`}
      >
        <Layers className="w-3.5 h-3.5" />
        <span>Underfloor: {underfloorRaised ? 'LIFTED' : 'NORMAL'}</span>
      </button>

      {/* 5. Campus Minimap Radar Toggle */}
      <button
        onClick={() => setShowMinimap(!showMinimap)}
        className={`px-2 py-1 rounded-lg flex items-center gap-1 transition-colors ${
          showMinimap
            ? 'bg-emerald-600 text-white shadow'
            : 'text-gray-400 hover:text-white hover:bg-white/10'
        }`}
        title="Toggle Campus Radar Minimap"
      >
        <Map className="w-3.5 h-3.5" />
        <span>Minimap</span>
      </button>

      {/* 6. Campus-Wide Flow Tracing */}
      <div className="flex items-center gap-1 bg-[#161b22] p-1 rounded-lg border border-[#30363d]">
        <span className="text-[10px] text-gray-500 px-1 uppercase">Trace:</span>
        {(['none', 'power', 'cooling', 'network'] as FlowTraceMode[]).map((mode) => {
          const isActive = flowTrace === mode
          return (
            <button
              key={`trace-${mode}`}
              onClick={() => setFlowTrace(mode)}
              className={`px-2 py-0.5 rounded text-[11px] uppercase flex items-center gap-1 transition-colors ${
                isActive
                  ? mode === 'power'
                    ? 'bg-amber-600 text-white font-bold'
                    : mode === 'cooling'
                    ? 'bg-cyan-600 text-white font-bold'
                    : mode === 'network'
                    ? 'bg-purple-600 text-white font-bold'
                    : 'bg-gray-600 text-white font-bold'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {mode === 'power' && <Zap className="w-3 h-3 text-amber-300" />}
              {mode === 'cooling' && <Droplets className="w-3 h-3 text-cyan-300" />}
              {mode === 'network' && <Network className="w-3 h-3 text-purple-300" />}
              <span>{mode}</span>
            </button>
          )
        })}
      </div>

      {/* 7. Educational Failure Simulations */}
      <div className="flex items-center gap-1 bg-[#161b22] p-1 rounded-lg border border-red-500/30">
        <span className="text-[10px] text-red-400 px-1 uppercase flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          <span>Failures:</span>
        </span>
        <button
          onClick={() => setScenario(scenario === 'GRID_LOSS' ? 'NORMAL' : 'GRID_LOSS')}
          className={`px-2 py-0.5 rounded text-[11px] uppercase transition-colors ${
            scenario === 'GRID_LOSS'
              ? 'bg-red-600 text-white font-bold animate-pulse'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
          title="Simulate 230kV utility grid loss -> UPS battery discharge -> 60MW diesel generators start"
        >
          Grid Drop
        </button>
        <button
          onClick={() => setScenario(scenario === 'CDU_FAILURE' ? 'NORMAL' : 'CDU_FAILURE')}
          className={`px-2 py-0.5 rounded text-[11px] uppercase transition-colors ${
            scenario === 'CDU_FAILURE'
              ? 'bg-red-600 text-white font-bold animate-pulse'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
          title="Simulate CDU pump cavitation fault in Building B AI GPU row"
        >
          CDU Fault
        </button>
      </div>

      {/* 8. Audio Controls */}
      <div className="flex items-center gap-2 bg-[#161b22] p-1 rounded-lg border border-[#30363d] ml-auto">
        <button
          onClick={() => setIsAudioMuted(!isAudioMuted)}
          className={`px-2 py-1 rounded transition-colors ${
            isAudioMuted ? 'text-red-400 hover:text-red-300' : 'text-gray-400 hover:text-white'
          }`}
          title={isAudioMuted ? 'Unmute Data Center Ambience' : 'Mute Data Center Ambience'}
        >
          {isAudioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={audioVolume}
          onChange={(e) => setAudioVolume(parseFloat(e.target.value))}
          disabled={isAudioMuted}
          className={`w-20 accent-emerald-500 ${isAudioMuted ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          title="Volume Control"
        />
      </div>
    </div>
  )
}
