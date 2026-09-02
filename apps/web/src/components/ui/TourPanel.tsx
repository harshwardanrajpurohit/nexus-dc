import { useStore } from '../../store'
import { TOUR_WAYPOINTS } from '../3d/CinematicController'

export default function TourPanel() {
  const { 
    viewMode, 
    tourState, 
    tourIndex, 
    isTourPaused, 
    setIsTourPaused,
    tourDebugMode,
    setTourDebugMode
  } = useStore()

  if (viewMode !== 'cinematic') return null

  const wp = TOUR_WAYPOINTS[tourIndex]
  const nextWp = TOUR_WAYPOINTS[(tourIndex + 1) % TOUR_WAYPOINTS.length]

  return (
    <>
      {/* Main Tour Overlay */}
      <div className="absolute bottom-24 left-1/2 -translate-x-1/2 w-[500px] bg-[#020617]/90 backdrop-blur-md border border-[#1e293b] rounded-lg p-5 shadow-2xl z-40">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-2 w-2 rounded-full opacity-75 ${tourState === 'NARRATING' ? 'bg-[#00e5ff]' : 'bg-[#eab308]'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${tourState === 'NARRATING' ? 'bg-[#00e5ff]' : 'bg-[#eab308]'}`}></span>
            </span>
            <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider">
              {tourState === 'NARRATING' ? 'AI Assistant Speaking' : tourState.replace('_', ' ')}
            </span>
          </div>
          <button 
            onClick={() => setTourDebugMode(!tourDebugMode)}
            className="text-[10px] text-[#64748b] hover:text-[#f8fafc]"
          >
            DEBUG
          </button>
        </div>

        {/* Current Target */}
        <h2 className="text-xl font-bold text-[#f8fafc] mb-1">{wp?.title}</h2>
        
        {/* Narration Subtitles */}
        <div className="min-h-[60px] text-sm text-[#cbd5e1] leading-relaxed italic mb-4">
          "{wp?.narration}"
        </div>

        {/* Controls & Next */}
        <div className="flex justify-between items-end border-t border-[#1e293b] pt-3">
          <div className="flex flex-col">
            <span className="text-[10px] text-[#64748b] uppercase tracking-widest mb-1">Up Next</span>
            <span className="text-sm font-semibold text-[#94a3b8]">{nextWp?.title}</span>
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={() => setIsTourPaused(!isTourPaused)}
              className="px-3 py-1 bg-[#1e293b] hover:bg-[#334155] text-white text-xs font-semibold rounded transition-colors"
            >
              {isTourPaused ? 'RESUME' : 'PAUSE'}
            </button>
          </div>
        </div>
      </div>

      {/* Debug Panel */}
      {tourDebugMode && (
        <div className="absolute top-20 right-6 w-64 bg-black/80 border border-red-500/50 p-4 font-mono text-[10px] text-[#ef4444] z-50">
          <h3 className="text-xs font-bold text-white mb-2">LIVE SYNC DEBUG</h3>
          <div className="flex flex-col gap-1">
            <div className="flex justify-between"><span>TOUR STATE:</span> <span className="text-white">{tourState}</span></div>
            <div className="flex justify-between"><span>WAYPOINT IDX:</span> <span className="text-white">{tourIndex} / {TOUR_WAYPOINTS.length}</span></div>
            <div className="flex justify-between"><span>TARGET ID:</span> <span className="text-white">{wp?.targetId}</span></div>
            <div className="flex justify-between"><span>PAUSED:</span> <span className="text-white">{isTourPaused ? 'YES' : 'NO'}</span></div>
          </div>
        </div>
      )}
    </>
  )
}
