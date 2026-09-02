import {
  Play,
  Pause,
  RotateCcw,
  Flame,
  ZapOff,
  Activity,
  Sparkles,
  Sliders
} from 'lucide-react'
import { useStore } from '../../store'

export default function TimelineControls() {
  const {
    scenario,
    setScenario,
    isPlaying,
    setIsPlaying,
    playbackSpeed,
    setPlaybackSpeed,
    timelineProgress,
    setTimelineProgress,
  } = useStore()

  const handleScenarioChange = async (newScenario: string) => {
    setScenario(newScenario)
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      await fetch(`${API_URL}/api/scenario`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: newScenario }),
      })
    } catch (e) {
      console.warn('API offline, local fallback')
    }
  }

  return (
    <footer className="h-16 bg-[#0c1017]/95 backdrop-blur-md border-t border-[#21262d] flex items-center justify-between px-6 z-20 select-none">
      {/* 1. Scenario Selector */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-xs font-mono text-gray-400">
          <Sliders className="w-4 h-4 text-blue-400" />
          <span>SCENARIO:</span>
        </div>
        <div className="flex items-center gap-1.5 bg-[#161b22] p-1 rounded-lg border border-[#30363d]">
          <button
            onClick={() => handleScenarioChange('NORMAL')}
            className={`px-3 py-1 rounded text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors ${
              scenario === 'NORMAL'
                ? 'bg-blue-600 text-white shadow'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Normal (1.15 GW)</span>
          </button>

          <button
            onClick={() => handleScenarioChange('PEAK_AI')}
            className={`px-3 py-1 rounded text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors ${
              scenario === 'PEAK_AI'
                ? 'bg-purple-600 text-white shadow'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Peak AI Burst</span>
          </button>

          <button
            onClick={() => handleScenarioChange('CDU_FAILURE')}
            className={`px-3 py-1 rounded text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors ${
              scenario === 'CDU_FAILURE'
                ? 'bg-red-600 text-white shadow animate-pulse'
                : 'text-red-400 hover:text-red-300 hover:bg-red-500/10'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>CDU Pump Fault</span>
          </button>

          <button
            onClick={() => handleScenarioChange('GRID_LOSS')}
            className={`px-3 py-1 rounded text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors ${
              scenario === 'GRID_LOSS'
                ? 'bg-amber-600 text-white shadow'
                : 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10'
            }`}
          >
            <ZapOff className="w-3.5 h-3.5" />
            <span>400kV Grid Drop</span>
          </button>
        </div>
      </div>

      {/* 2. Playback Controls & Timeline Scrubber */}
      <div className="hidden md:flex items-center gap-4 flex-1 max-w-md mx-8">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition-colors"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 translate-x-0.5" />}
          </button>

          <button
            onClick={() => setTimelineProgress(0)}
            className="w-8 h-8 rounded-lg bg-[#161b22] hover:bg-[#21262d] text-gray-300 flex items-center justify-center border border-[#30363d]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setPlaybackSpeed(playbackSpeed === 1 ? 2 : playbackSpeed === 2 ? 5 : 1)}
            className="px-2.5 h-8 rounded-lg bg-[#161b22] hover:bg-[#21262d] text-gray-300 flex items-center justify-center border border-[#30363d] text-xs font-mono"
          >
            {playbackSpeed}x
          </button>
        </div>

        {/* Scrubber Bar */}
        <div className="flex-1 flex items-center gap-2">
          <span className="text-[10px] font-mono text-gray-400">00:00</span>
          <input
            type="range"
            min="0"
            max="100"
            value={timelineProgress}
            onChange={(e) => setTimelineProgress(Number(e.target.value))}
            className="flex-1 h-1.5 bg-[#21262d] rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <span className="text-[10px] font-mono text-gray-400">24:00</span>
        </div>
      </div>

      {/* 3. CFD Thermal Scale Legend */}
      <div className="flex items-center gap-3 bg-[#161b22]/90 border border-[#30363d] rounded-lg px-3 py-1.5">
        <span className="text-[10px] font-mono text-gray-400 uppercase">CFD Scale:</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-blue-400 font-bold">21.1°C</span>
          <div
            className="w-28 h-3 rounded-sm border border-black/50"
            style={{
              background: 'linear-gradient(to right, #1d4ed8, #06b6d4, #22c55e, #eab308, #ef4444, #ec4899)',
            }}
          />
          <span className="text-[10px] font-mono text-red-400 font-bold">38.0°C+</span>
        </div>
      </div>
    </footer>
  )
}
