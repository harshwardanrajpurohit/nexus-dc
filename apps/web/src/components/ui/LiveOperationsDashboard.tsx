import { useState, useEffect, useRef } from 'react'
import { useStore } from '../../store'
import {
  Activity, Zap, Droplets, Thermometer, Fan, ShieldAlert,
  Play, Pause, RotateCcw, AlertTriangle,
  Sliders, Search, RefreshCw, Power, CheckCircle2,
  Terminal, Server, FileText, ChevronRight, X
} from 'lucide-react'

interface CoolingUnit {
  id: string
  name: string
  parent_id: string
  status: string
  operating_mode: 'AUTO' | 'MANUAL'
  power_state: 'ON' | 'OFF'
  fan_speed_percent: number
  fan_rpm: number
  setpoint_c: number
  measured_temp_c: number
  airflow_cfm: number
  cooling_power_kw: number
  emergency_override: boolean
  override_reason: string | null
  connected_racks_count: number
  last_updated: number
}

interface RackDetail {
  id: string
  type: string
  name: string
  status: string
  power_kw: number
  temp_c: number
  inlet_temp_c: number
  exhaust_temp_c: number
  cpu_utilization: number
  gpu_utilization: number
  memory_utilization: number
  fan_speed_percent: number
  fan_rpm: number
  airflow_cfm: number
  humidity_rh: number
  thermal_throttled: boolean
}

interface TelemetryEvent {
  event_id: string
  timestamp: string
  source: string
  event_type: string
  metric: string
  value: number | string
  unit: string
  severity: 'INFO' | 'WARNING' | 'CRITICAL' | 'ERROR'
  message: string
  processing_status: string
}

interface Alarm {
  alarm_id: string
  timestamp: string
  source: string
  severity: 'INFO' | 'WARNING' | 'CRITICAL' | 'ERROR'
  title: string
  message: string
  acknowledged: boolean
  cleared: boolean
}

interface CommandHistoryItem {
  command_id: string
  timestamp: string
  operator: string
  cdu_id: string
  action: string
  status: string
  before: {
    fan_speed_percent: number
    cooling_power_kw: number
    measured_temp_c: number
    total_facility_kw: number
    pue: number
  }
  after: {
    fan_speed_percent: number
    cooling_power_kw: number
    projected_temp_c: number
    cooling_power_delta_kw: number
    estimated_hourly_energy_delta_kwh: number
    projected_pue: number
  }
}

export default function LiveOperationsDashboard() {
  const [coolingUnits, setCoolingUnits] = useState<CoolingUnit[]>([])
  const [selectedUnitId, setSelectedUnitId] = useState<string>('')
  const [selectedUnitDetail, setSelectedUnitDetail] = useState<{ cdu: CoolingUnit | null; racks: RackDetail[] }>({ cdu: null, racks: [] })
  
  // Controller edit state
  const [mode, setMode] = useState<'AUTO' | 'MANUAL'>('AUTO')
  const [powerState, setPowerState] = useState<'ON' | 'OFF'>('ON')
  const [fanSpeed, setFanSpeed] = useState<number>(60)
  const [setpoint, setSetpoint] = useState<number>(22.0)
  const [isApplying, setIsApplying] = useState<boolean>(false)
  const [showShutdownConfirm, setShowShutdownConfirm] = useState<boolean>(false)
  const [lastCommandResult, setLastCommandResult] = useState<any | null>(null)
  
  // Telemetry stream state
  const [events, setEvents] = useState<TelemetryEvent[]>([])
  const [eventSeverityFilter, setEventSeverityFilter] = useState<string>('ALL')
  const [eventSearch, setEventSearch] = useState<string>('')
  const [isEventStreamPaused, setIsEventStreamPaused] = useState<boolean>(false)
  const [selectedEventForJson, setSelectedEventForJson] = useState<TelemetryEvent | null>(null)

  // Alarms & Audit history
  const [alarms, setAlarms] = useState<Alarm[]>([])
  const [commandHistory, setCommandHistory] = useState<CommandHistoryItem[]>([])
  
  // Clock state
  const [isSimPaused, setIsSimPaused] = useState<boolean>(false)
  const [simSpeed, setSimSpeed] = useState<number>(1.0)
  const [tickCount, setTickCount] = useState<number>(0)
  
  // Facility Global Telemetry from Store
  const storeTelemetry = useStore((state) => state.telemetry)
  const globalStats = {
    facility_kw: storeTelemetry ? storeTelemetry.power_facility_mw * 1000 : 80000,
    it_kw: storeTelemetry ? storeTelemetry.power_it_mw * 1000 : 65000,
    cooling_kw: storeTelemetry ? Math.max(0, (storeTelemetry.power_facility_mw - storeTelemetry.power_it_mw) * 1000) : 15000,
    pue: storeTelemetry?.pue || 1.118,
    coolant_flow_lpm: storeTelemetry?.coolant_flow_lpm || 527000,
    avg_gpu_temp: storeTelemetry?.temp_gpu_avg_c || 52.0,
    active_alarms_count: alarms.length
  }

  const [unitSearch, setUnitSearch] = useState<string>('')
  const eventLogContainerRef = useRef<HTMLDivElement>(null)

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

  // Fetch cooling units on load
  const fetchCoolingUnits = async () => {
    try {
      const res = await fetch(`${API_URL}/api/control/cooling-units`)
      if (res.ok) {
        const data = await res.json()
        setCoolingUnits(data.cooling_units || [])
        if (!selectedUnitId && data.cooling_units && data.cooling_units.length > 0) {
          setSelectedUnitId(data.cooling_units[0].id)
        }
      }
    } catch (e) {
      console.error('Failed to fetch cooling units', e)
    }
  }

  // Fetch unit details and connected racks
  const fetchUnitDetail = async (id: string) => {
    if (!id) return
    try {
      const res = await fetch(`${API_URL}/api/control/cooling-units/${id}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedUnitDetail({
          cdu: data,
          racks: data.racks_detail || []
        })
        // Update edit sliders with current values
        setMode(data.operating_mode || 'AUTO')
        setPowerState(data.power_state || 'ON')
        setFanSpeed(data.fan_speed_percent ?? 60)
        setSetpoint(data.setpoint_c ?? 22.0)
      }
    } catch (e) {
      console.error('Failed to fetch unit detail', e)
    }
  }

  // Fetch telemetry events
  const fetchEvents = async () => {
    if (isEventStreamPaused) return
    try {
      let url = `${API_URL}/api/control/events?limit=80`
      if (eventSeverityFilter !== 'ALL') url += `&severity=${eventSeverityFilter}`
      if (eventSearch) url += `&search=${encodeURIComponent(eventSearch)}`
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setEvents(data.events || [])
      }
    } catch (e) {
      console.error('Failed to fetch events', e)
    }
  }

  // Fetch active alarms and command history
  const fetchAlarmsAndHistory = async () => {
    try {
      const [resAlarms, resHistory] = await Promise.all([
        fetch(`${API_URL}/api/control/alarms`),
        fetch(`${API_URL}/api/control/history?limit=25`)
      ])
      if (resAlarms.ok) {
        const data = await resAlarms.json()
        setAlarms(data.active_alarms || [])
      }
      if (resHistory.ok) {
        const data = await resHistory.json()
        setCommandHistory(data.command_history || [])
      }
    } catch (e) {
      console.error('Failed to fetch alarms or history', e)
    }
  }

  // Apply manual cooling control
  const handleApplyCommand = async (forceOverride = false) => {
    if (!selectedUnitId) return

    // If operator is turning off cooling, request confirmation
    if (powerState === 'OFF' && !forceOverride) {
      setShowShutdownConfirm(true)
      return
    }

    setIsApplying(true)
    setShowShutdownConfirm(false)
    try {
      const res = await fetch(`${API_URL}/api/control/cooling-units/${selectedUnitId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          power_state: powerState,
          fan_speed_percent: Number(fanSpeed),
          setpoint_c: Number(setpoint),
          operator: 'Chief Control Operator',
          force_override: forceOverride
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setLastCommandResult(data)
        fetchUnitDetail(selectedUnitId)
        fetchCoolingUnits()
        fetchAlarmsAndHistory()
        fetchEvents()
      } else if (data.status === 'CONFIRMATION_REQUIRED') {
        setShowShutdownConfirm(true)
      } else {
        alert(`Command rejected: ${data.reason || data.detail || 'Invalid settings'}`)
      }
    } catch (e) {
      console.error('Failed to apply cooling command', e)
    } finally {
      setIsApplying(false)
    }
  }

  // Reset CDU to AUTO
  const handleResetAuto = async () => {
    if (!selectedUnitId) return
    setIsApplying(true)
    try {
      const res = await fetch(`${API_URL}/api/control/cooling-units/${selectedUnitId}/reset`, {
        method: 'POST'
      })
      const data = await res.json()
      if (res.ok) {
        setLastCommandResult(data)
        fetchUnitDetail(selectedUnitId)
        fetchCoolingUnits()
        fetchAlarmsAndHistory()
      }
    } catch (e) {
      console.error('Failed to reset unit', e)
    } finally {
      setIsApplying(false)
    }
  }

  // Acknowledge alarm
  const handleAcknowledgeAlarm = async (alarmId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/control/alarms/${alarmId}/ack`, { method: 'POST' })
      if (res.ok) {
        fetchAlarmsAndHistory()
      }
    } catch (e) {
      console.error('Failed to ack alarm', e)
    }
  }

  // Control simulation clock
  const handleClockControl = async (action: 'PAUSE' | 'RESUME' | 'STEP' | 'SET_SPEED', speed = 1.0) => {
    try {
      const res = await fetch(`${API_URL}/api/control/simulation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, speed })
      })
      if (res.ok) {
        const data = await res.json()
        setIsSimPaused(data.clock.is_paused)
        setSimSpeed(data.clock.speed_multiplier)
        setTickCount(data.clock.tick_count)
      }
    } catch (e) {
      console.error('Failed to control clock', e)
    }
  }

  // Fast polling loop (1Hz)
  useEffect(() => {
    fetchCoolingUnits()
    fetchAlarmsAndHistory()
    fetchEvents()

    const interval = setInterval(() => {
      fetchCoolingUnits()
      fetchEvents()
      fetchAlarmsAndHistory()
    }, 1200)

    return () => clearInterval(interval)
  }, [])

  // Poll selected unit detail
  useEffect(() => {
    if (selectedUnitId) {
      fetchUnitDetail(selectedUnitId)
    }
  }, [selectedUnitId])

  // Re-fetch events immediately on filter change
  useEffect(() => {
    fetchEvents()
  }, [eventSeverityFilter, eventSearch])

  // Filtered CDUs
  const filteredUnits = coolingUnits.filter(u =>
    u.id.toLowerCase().includes(unitSearch.toLowerCase()) ||
    u.name.toLowerCase().includes(unitSearch.toLowerCase())
  )

  const selectedCDU = selectedUnitDetail.cdu || coolingUnits.find(u => u.id === selectedUnitId)

  // Energy & Reliability Before/After comparison calculations
  const comparison = lastCommandResult?.after ? {
    fanBefore: lastCommandResult.before.fan_speed_percent,
    fanAfter: lastCommandResult.after.fan_speed_percent,
    powerBefore: lastCommandResult.before.cooling_power_kw,
    powerAfter: lastCommandResult.after.cooling_power_kw,
    powerDelta: lastCommandResult.after.cooling_power_delta_kw,
    tempBefore: lastCommandResult.before.measured_temp_c,
    tempAfter: lastCommandResult.after.projected_temp_c,
    facilityBefore: lastCommandResult.before.total_facility_kw,
    facilityAfter: lastCommandResult.after.projected_facility_kw,
    pueBefore: lastCommandResult.before.pue,
    pueAfter: lastCommandResult.after.projected_pue,
    energyDeltaKwh: lastCommandResult.after.estimated_hourly_energy_delta_kwh
  } : null

  return (
    <div className="flex-1 flex flex-col h-full bg-[#080c14] text-[#c9d1d9] overflow-hidden select-none font-sans">
      {/* 1. Control Room Header Ribbon */}
      <div className="border-b border-[#21262d] bg-[#0d1117] px-6 py-3 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-sm">
        {/* Title & Badge */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-sm tracking-wider text-white uppercase font-mono">
                Live Operations & Thermal Control Room
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/30">
                SCADA / DCIM Core
              </span>
            </div>
            <p className="text-xs text-gray-400 font-mono">
              Real-Time Mechanical Actuation • Safety Interlocks • Telemetry Stream Inspector
            </p>
          </div>
        </div>

        {/* Global Key Metrics */}
        <div className="hidden lg:flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#161b22] border border-[#30363d]">
            <Zap className="w-4 h-4 text-amber-400" />
            <div>
              <div className="text-[10px] text-gray-400 uppercase">FACILITY / IT POWER</div>
              <div className="font-bold text-white">
                {(globalStats.facility_kw / 1000).toFixed(1)} MW <span className="text-gray-400 font-normal">({(globalStats.it_kw / 1000).toFixed(1)} MW IT)</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#161b22] border border-[#30363d]">
            <Droplets className="w-4 h-4 text-cyan-400" />
            <div>
              <div className="text-[10px] text-gray-400 uppercase">COOLING LOAD / PUE</div>
              <div className="font-bold text-white">
                {(globalStats.cooling_kw / 1000).toFixed(2)} MW <span className="text-emerald-400 font-normal">/ PUE {globalStats.pue.toFixed(3)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#161b22] border border-[#30363d]">
            <Thermometer className="w-4 h-4 text-emerald-400" />
            <div>
              <div className="text-[10px] text-gray-400 uppercase">AVG GPU CORE TEMP</div>
              <div className={`font-bold ${globalStats.avg_gpu_temp > 75 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {globalStats.avg_gpu_temp.toFixed(1)}°C
              </div>
            </div>
          </div>
        </div>

        {/* Simulation Clock Controls */}
        <div className="flex items-center gap-2 font-mono text-xs bg-[#161b22] p-1.5 rounded-lg border border-[#30363d]">
          <span className="text-[11px] text-gray-400 px-2 flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${isSimPaused ? 'bg-amber-400' : 'bg-emerald-400 animate-ping'}`} />
            Tick #{tickCount}
          </span>

          <button
            onClick={() => handleClockControl(isSimPaused ? 'RESUME' : 'PAUSE')}
            className={`px-2.5 py-1 rounded flex items-center gap-1 font-semibold transition-colors ${
              isSimPaused ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-[#21262d] hover:bg-[#30363d] text-gray-200'
            }`}
          >
            {isSimPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5 fill-current" />}
            <span>{isSimPaused ? 'RESUME' : 'PAUSE'}</span>
          </button>

          <button
            onClick={() => handleClockControl('STEP')}
            disabled={!isSimPaused}
            className={`px-2 py-1 rounded transition-colors ${
              isSimPaused ? 'hover:bg-[#21262d] text-gray-300' : 'text-gray-600 cursor-not-allowed'
            }`}
            title="Step forward 1 simulation tick"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <select
            value={simSpeed}
            onChange={(e) => handleClockControl('SET_SPEED', Number(e.target.value))}
            className="bg-[#0d1117] border border-[#30363d] text-gray-300 rounded px-1.5 py-1 text-[11px] outline-none"
          >
            <option value={1.0}>1x Speed</option>
            <option value={2.0}>2x Speed</option>
            <option value={5.0}>5x Speed</option>
          </select>
        </div>
      </div>

      {/* 2. Main Workstation Grid */}
      <div className="flex-1 grid grid-cols-12 gap-4 p-4 overflow-hidden">
        {/* Left Col (3 Cols): Cooling Units & CDU Browser */}
        <div className="col-span-12 lg:col-span-3 flex flex-col bg-[#111622] rounded-xl border border-[#21262d] overflow-hidden shadow-sm">
          <div className="p-3 border-b border-[#21262d] bg-[#161b22] flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-white uppercase">
              <Fan className="w-4 h-4 text-cyan-400" />
              <span>Cooling Units ({coolingUnits.length})</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
              140 CDUs
            </span>
          </div>

          {/* Search box */}
          <div className="p-2.5 border-b border-[#21262d] bg-[#0d1117]">
            <div className="relative flex items-center text-xs font-mono">
              <Search className="w-3.5 h-3.5 absolute left-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search CDU or Row ID..."
                value={unitSearch}
                onChange={(e) => setUnitSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-[#161b22] border border-[#30363d] rounded text-gray-200 placeholder-gray-500 outline-none focus:border-cyan-500 text-xs"
              />
            </div>
          </div>

          {/* CDU List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#21262d] font-mono text-xs">
            {filteredUnits.map((u) => {
              const isSelected = u.id === selectedUnitId
              const isManual = u.operating_mode === 'MANUAL'
              const isOff = u.power_state === 'OFF'
              const isCrit = u.status === 'CRITICAL' || u.emergency_override

              return (
                <div
                  key={u.id}
                  onClick={() => setSelectedUnitId(u.id)}
                  className={`p-3 cursor-pointer transition-colors ${
                    isSelected ? 'bg-cyan-950/30 border-l-4 border-cyan-400' : 'hover:bg-[#161b22]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-white truncate max-w-[170px]" title={u.name}>
                      {u.name.replace('Liquid CDU Heat Exchanger', 'CDU')}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                      isCrit ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                      isOff ? 'bg-gray-800 text-gray-400' :
                      isManual ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                      'bg-emerald-500/10 text-emerald-400'
                    }`}>
                      {isCrit ? 'OVERRIDE' : isOff ? 'OFF' : isManual ? 'MANUAL' : 'AUTO'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-gray-400">
                    <span className="flex items-center gap-1">
                      <Fan className="w-3 h-3 text-cyan-400" />
                      {u.fan_speed_percent}% ({u.fan_rpm} RPM)
                    </span>
                    <span className="flex items-center gap-1">
                      <Thermometer className="w-3 h-3 text-emerald-400" />
                      {u.measured_temp_c}°C
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Center-Right Col (9 Cols): Interactive Manual Controller & Inspector */}
        <div className="col-span-12 lg:col-span-9 flex flex-col gap-4 overflow-y-auto">
          {/* Top Half: Controller & Before/After Comparison Card */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Interactive Manual Controller (7 Cols) */}
            <div className="lg:col-span-7 bg-[#111622] rounded-xl border border-[#21262d] p-5 shadow-sm font-mono text-xs space-y-5">
              <div className="flex items-center justify-between border-b border-[#21262d] pb-3">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-cyan-400" />
                  <span className="font-bold text-white text-sm uppercase">
                    Interactive Cooling Unit Controller
                  </span>
                </div>
                {selectedCDU && (
                  <span className={`text-[10px] px-2 py-0.5 rounded font-semibold flex items-center gap-1 ${
                    selectedCDU.emergency_override ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                    selectedCDU.operating_mode === 'MANUAL' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                    'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                  }`}>
                    {selectedCDU.emergency_override ? 'EMERGENCY OVERRIDE' :
                     selectedCDU.operating_mode === 'MANUAL' ? 'MANUAL OVERRIDE ACTIVE' : 'CLOSED-LOOP AUTO'}
                  </span>
                )}
              </div>

              {selectedCDU ? (
                <>
                  {/* Selected Unit Info Ribbon */}
                  <div className="p-3 rounded-lg bg-[#161b22] border border-[#30363d] flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-white text-sm">{selectedCDU.name}</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        ID: <span className="text-gray-300">{selectedCDU.id}</span> • Governing {selectedCDU.connected_racks_count} Racks
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-gray-400 uppercase">MEASURED RETURN TEMP</div>
                      <div className="text-base font-bold text-cyan-400">{selectedCDU.measured_temp_c}°C</div>
                    </div>
                  </div>

                  {/* Mode & Power Switches */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Operating Mode Toggle */}
                    <div className="p-3 rounded-lg bg-[#161b22] border border-[#30363d]">
                      <div className="text-[10px] text-gray-400 uppercase mb-2">OPERATING MODE</div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setMode('AUTO')}
                          className={`py-1.5 px-3 rounded font-semibold transition-all ${
                            mode === 'AUTO'
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'bg-[#0d1117] text-gray-400 hover:text-white'
                          }`}
                        >
                          AUTO
                        </button>
                        <button
                          onClick={() => setMode('MANUAL')}
                          className={`py-1.5 px-3 rounded font-semibold transition-all ${
                            mode === 'MANUAL'
                              ? 'bg-amber-600 text-white shadow-sm'
                              : 'bg-[#0d1117] text-gray-400 hover:text-white'
                          }`}
                        >
                          MANUAL
                        </button>
                      </div>
                    </div>

                    {/* Power ON / OFF Toggle */}
                    <div className="p-3 rounded-lg bg-[#161b22] border border-[#30363d]">
                      <div className="text-[10px] text-gray-400 uppercase mb-2">COOLING POWER STATE</div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setPowerState('ON')}
                          className={`py-1.5 px-3 rounded font-semibold flex items-center justify-center gap-1.5 transition-all ${
                            powerState === 'ON'
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'bg-[#0d1117] text-gray-400 hover:text-white'
                          }`}
                        >
                          <Power className="w-3.5 h-3.5" />
                          <span>ON</span>
                        </button>
                        <button
                          onClick={() => setPowerState('OFF')}
                          className={`py-1.5 px-3 rounded font-semibold flex items-center justify-center gap-1.5 transition-all ${
                            powerState === 'OFF'
                              ? 'bg-red-600 text-white shadow-sm'
                              : 'bg-[#0d1117] text-gray-400 hover:text-white'
                          }`}
                        >
                          <Power className="w-3.5 h-3.5" />
                          <span>OFF</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Sliders: Fan Speed & Temperature Setpoint */}
                  <div className="space-y-4">
                    {/* Fan Speed Slider */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-gray-300 font-semibold flex items-center gap-1.5">
                          <Fan className="w-3.5 h-3.5 text-cyan-400" />
                          FAN / PUMP SPEED: <span className="text-white text-sm font-bold">{fanSpeed}%</span>
                        </span>
                        <span className="text-gray-400 text-[11px]">
                          ~{Math.round(fanSpeed * 36)} RPM • {Math.round(fanSpeed * 250).toLocaleString()} CFM
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={fanSpeed}
                        disabled={mode === 'AUTO' || powerState === 'OFF'}
                        onChange={(e) => setFanSpeed(Number(e.target.value))}
                        className="w-full h-2 bg-[#161b22] rounded-lg appearance-none cursor-pointer accent-cyan-400 disabled:opacity-40"
                      />
                      <div className="flex justify-between text-[10px] text-gray-500 mt-1 font-mono">
                        <span>0% (OFF)</span>
                        <span>25% (Min Auto)</span>
                        <span>50%</span>
                        <span>75%</span>
                        <span>100% (Emergency Max)</span>
                      </div>
                    </div>

                    {/* Temperature Setpoint Slider */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-gray-300 font-semibold flex items-center gap-1.5">
                          <Thermometer className="w-3.5 h-3.5 text-emerald-400" />
                          TARGET SETPOINT: <span className="text-white text-sm font-bold">{setpoint}°C</span>
                        </span>
                        <span className="text-gray-400 text-[11px]">
                          Range: 15.0°C – 30.0°C (ASHRAE A1)
                        </span>
                      </div>
                      <input
                        type="range"
                        min="15"
                        max="30"
                        step="0.5"
                        value={setpoint}
                        disabled={powerState === 'OFF'}
                        onChange={(e) => setSetpoint(Number(e.target.value))}
                        className="w-full h-2 bg-[#161b22] rounded-lg appearance-none cursor-pointer accent-emerald-400 disabled:opacity-40"
                      />
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={() => handleApplyCommand(false)}
                      disabled={isApplying}
                      className="flex-1 py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold transition-all shadow-md flex items-center justify-center gap-2"
                    >
                      {isApplying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      <span>APPLY CONTROL CHANGES</span>
                    </button>

                    <button
                      onClick={handleResetAuto}
                      disabled={isApplying}
                      className="py-2.5 px-4 rounded-lg bg-[#161b22] hover:bg-[#21262d] text-gray-300 hover:text-white border border-[#30363d] font-semibold transition-all flex items-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>RESET TO AUTO</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="h-48 flex items-center justify-center text-gray-500">
                  Select a cooling unit to inspect controls
                </div>
              )}
            </div>

            {/* Before / After Impact Comparison Card (5 Cols) */}
            <div className="lg:col-span-5 bg-[#111622] rounded-xl border border-[#21262d] p-5 shadow-sm font-mono text-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-[#21262d] pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-white text-sm uppercase">
                      Before / After Impact Analysis
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-400">Modeled Physics Impact</span>
                </div>

                {comparison ? (
                  <div className="space-y-3.5">
                    {/* Fan Speed Delta */}
                    <div className="p-2.5 rounded-lg bg-[#161b22] border border-[#21262d] flex items-center justify-between">
                      <span className="text-gray-400 text-[11px]">FAN SPEED</span>
                      <div className="flex items-center gap-2 text-right">
                        <span className="text-gray-400 line-through">{comparison.fanBefore}%</span>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
                        <span className="font-bold text-white text-sm">{comparison.fanAfter}%</span>
                      </div>
                    </div>

                    {/* Cooling Power Delta */}
                    <div className="p-2.5 rounded-lg bg-[#161b22] border border-[#21262d] flex items-center justify-between">
                      <span className="text-gray-400 text-[11px]">COOLING POWER (KW)</span>
                      <div className="flex items-center gap-2 text-right">
                        <span className="text-gray-400">{comparison.powerBefore.toFixed(1)} kW</span>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
                        <span className="font-bold text-cyan-400 text-sm">{comparison.powerAfter.toFixed(1)} kW</span>
                        <span className={`text-[10px] px-1 rounded ${
                          comparison.powerDelta <= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {comparison.powerDelta >= 0 ? `+${comparison.powerDelta.toFixed(1)}` : comparison.powerDelta.toFixed(1)} kW
                        </span>
                      </div>
                    </div>

                    {/* Projected Core Temp */}
                    <div className="p-2.5 rounded-lg bg-[#161b22] border border-[#21262d] flex items-center justify-between">
                      <span className="text-gray-400 text-[11px]">ESTIMATED CORE TEMP</span>
                      <div className="flex items-center gap-2 text-right">
                        <span className="text-gray-400">{comparison.tempBefore.toFixed(1)}°C</span>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
                        <span className={`font-bold text-sm ${
                          comparison.tempAfter > 85 ? 'text-red-400' :
                          comparison.tempAfter > 75 ? 'text-amber-400' : 'text-emerald-400'
                        }`}>
                          {comparison.tempAfter.toFixed(1)}°C
                        </span>
                      </div>
                    </div>

                    {/* Energy Delta Over 1 Hr */}
                    <div className="p-2.5 rounded-lg bg-[#161b22] border border-[#21262d] flex items-center justify-between">
                      <span className="text-gray-400 text-[11px]">1-HOUR ENERGY IMPACT</span>
                      <div className="font-bold text-white text-sm">
                        {comparison.energyDeltaKwh <= 0 ? (
                          <span className="text-emerald-400">Saving {Math.abs(comparison.energyDeltaKwh).toFixed(1)} kWh/hr</span>
                        ) : (
                          <span className="text-amber-400">Consuming +{comparison.energyDeltaKwh.toFixed(1)} kWh/hr</span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 rounded-lg bg-[#161b22] border border-[#21262d] text-center text-gray-400 text-xs">
                    Apply a manual change to view instant physical impact comparison against baseline.
                  </div>
                )}
              </div>

                {/* Safety Interlock Active Status */}
                <div className="mt-4 p-3 rounded-lg bg-[#0d1117] border border-emerald-500/30 flex items-center gap-2.5 text-xs text-emerald-400">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-emerald-400" />
                  <div>
                    <span className="font-bold">Active Safety Interlocks: </span>
                    <span className="text-gray-300">
                      Thermal limits protected. Emergency override will engage if rack core reaches 95.0°C.
                    </span>
                  </div>
                </div>
            </div>
          </div>

          {/* Connected Racks Telemetry Grid */}
          <div className="bg-[#111622] rounded-xl border border-[#21262d] p-4 shadow-sm font-mono text-xs">
            <div className="flex items-center justify-between border-b border-[#21262d] pb-2 mb-3">
              <div className="flex items-center gap-2 font-bold text-white uppercase">
                <Server className="w-4 h-4 text-emerald-400" />
                <span>Connected Racks Telemetry ({selectedUnitDetail.racks.length} Racks)</span>
              </div>
              <span className="text-[11px] text-gray-400">Core Temp • Inlet/Exhaust • Airflow • Utilization</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2.5 max-h-48 overflow-y-auto">
              {selectedUnitDetail.racks.map((r) => {
                const isCrit = r.temp_c >= 85
                const isWarn = r.temp_c >= 75 && r.temp_c < 85

                return (
                  <div
                    key={r.id}
                    className={`p-2.5 rounded-lg border transition-all ${
                      isCrit ? 'bg-red-950/40 border-red-500/60 shadow-red-900/30 shadow' :
                      isWarn ? 'bg-amber-950/30 border-amber-500/50' :
                      'bg-[#161b22] border-[#21262d]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-white text-[11px] truncate">{r.id.split('-').slice(-2).join('-')}</span>
                      <span className={`text-[10px] font-bold ${
                        isCrit ? 'text-red-400' : isWarn ? 'text-amber-400' : 'text-emerald-400'
                      }`}>
                        {r.temp_c}°C
                      </span>
                    </div>

                    <div className="text-[10px] text-gray-400 space-y-0.5">
                      <div>Power: <span className="text-gray-200">{r.power_kw} kW</span></div>
                      <div>In/Out: <span className="text-gray-200">{r.inlet_temp_c}° / {r.exhaust_temp_c}°</span></div>
                      <div>Flow: <span className="text-gray-200">{r.airflow_cfm} CFM</span></div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Bottom Half: Live Incoming Telemetry Inspector & Alarms Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Telemetry Stream Inspector (8 Cols) */}
            <div className="lg:col-span-8 bg-[#111622] rounded-xl border border-[#21262d] p-4 shadow-sm font-mono text-xs flex flex-col h-80">
              <div className="flex flex-wrap items-center justify-between border-b border-[#21262d] pb-2 mb-2 gap-2">
                <div className="flex items-center gap-2 font-bold text-white uppercase">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  <span>Incoming Telemetry & Event Stream</span>
                </div>

                {/* Stream Controls */}
                <div className="flex items-center gap-2">
                  {/* Event Search Input */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-gray-500 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Filter events..."
                      value={eventSearch}
                      onChange={(e) => setEventSearch(e.target.value)}
                      className="bg-[#161b22] border border-[#30363d] rounded pl-7 pr-2 py-0.5 text-[11px] text-white focus:outline-none focus:border-cyan-500 w-32 placeholder:text-gray-500"
                    />
                  </div>

                  {/* Severity Filter */}
                  <div className="flex items-center bg-[#161b22] rounded border border-[#30363d] p-0.5 text-[10px]">
                    {['ALL', 'CRITICAL', 'WARNING', 'INFO'].map(sev => (
                      <button
                        key={sev}
                        onClick={() => setEventSeverityFilter(sev)}
                        className={`px-2 py-0.5 rounded transition-colors ${
                          eventSeverityFilter === sev ? 'bg-cyan-600 text-white font-bold' : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        {sev}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setIsEventStreamPaused(!isEventStreamPaused)}
                    className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 ${
                      isEventStreamPaused ? 'bg-amber-600 text-white' : 'bg-[#161b22] border border-[#30363d] text-gray-300'
                    }`}
                  >
                    {isEventStreamPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                    <span>{isEventStreamPaused ? 'Resume' : 'Pause'}</span>
                  </button>
                </div>
              </div>

              {/* Event Log Window */}
              <div
                ref={eventLogContainerRef}
                className="flex-1 overflow-y-auto divide-y divide-[#1e2430] bg-[#0a0e17] rounded-lg p-2 font-mono text-[11px]"
              >
                {events.length > 0 ? (
                  events.map((evt) => {
                    const isCrit = evt.severity === 'CRITICAL'
                    const isWarn = evt.severity === 'WARNING'

                    return (
                      <div
                        key={evt.event_id}
                        onClick={() => setSelectedEventForJson(evt)}
                        className="py-1.5 px-2 hover:bg-[#161b22] cursor-pointer rounded flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-gray-500 text-[10px] shrink-0">{evt.timestamp}</span>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold shrink-0 ${
                            isCrit ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                            isWarn ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                            'bg-blue-500/10 text-blue-300'
                          }`}>
                            {evt.severity}
                          </span>
                          <span className="text-cyan-400 shrink-0 font-semibold">{evt.source.split('-').slice(-2).join('-')}:</span>
                          <span className="text-gray-300 truncate">{evt.message}</span>
                        </div>
                        <span className="text-gray-500 text-[10px] shrink-0 font-mono">
                          {evt.value} {evt.unit}
                        </span>
                      </div>
                    )
                  })
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-500 text-xs">
                    Listening for live telemetry packets...
                  </div>
                )}
              </div>
            </div>

            {/* Active Alarms & Actions (4 Cols) */}
            <div className="lg:col-span-4 bg-[#111622] rounded-xl border border-[#21262d] p-4 shadow-sm font-mono text-xs flex flex-col h-80">
              <div className="flex items-center justify-between border-b border-[#21262d] pb-2 mb-2">
                <div className="flex items-center gap-2 font-bold text-white uppercase">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>Active Alarms ({alarms.length})</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2">
                {alarms.length > 0 ? (
                  alarms.map((alm) => (
                    <div
                      key={alm.alarm_id}
                      className={`p-2.5 rounded-lg border text-[11px] ${
                        alm.severity === 'CRITICAL'
                          ? 'bg-red-950/30 border-red-500/50 text-red-200'
                          : 'bg-amber-950/20 border-amber-500/40 text-amber-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold truncate">{alm.title}</span>
                        <span className="text-[10px] text-gray-400">{alm.timestamp}</span>
                      </div>
                      <p className="text-[10px] text-gray-300 mb-2 leading-relaxed">{alm.message}</p>
                      <div className="flex justify-end">
                        <button
                          onClick={() => handleAcknowledgeAlarm(alm.alarm_id)}
                          disabled={alm.acknowledged}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            alm.acknowledged
                              ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                              : 'bg-red-600 hover:bg-red-500 text-white'
                          }`}
                        >
                          {alm.acknowledged ? 'ACKNOWLEDGED' : 'ACKNOWLEDGE'}
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500 text-xs text-center p-4">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
                    <span>0 Unacknowledged Critical Alarms</span>
                    <span className="text-[10px] text-gray-600 mt-1">All monitored thresholds within envelope</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Operator Command Audit History Table */}
          <div className="bg-[#111622] rounded-xl border border-[#21262d] p-4 shadow-sm font-mono text-xs">
            <div className="flex items-center justify-between border-b border-[#21262d] pb-2 mb-3">
              <div className="flex items-center gap-2 font-bold text-white uppercase">
                <FileText className="w-4 h-4 text-blue-400" />
                <span>Operator Command History & Audit Trail</span>
              </div>
              <span className="text-[11px] text-gray-400">Validated State Transitions & Impact Snapshots</span>
            </div>

            <div className="overflow-x-auto max-h-44">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#161b22] text-gray-400 uppercase text-[10px] border-b border-[#21262d]">
                  <tr>
                    <th className="py-2 px-3">Time</th>
                    <th className="py-2 px-3">Operator</th>
                    <th className="py-2 px-3">Target Unit</th>
                    <th className="py-2 px-3">Action Command</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3 text-right">Power Delta</th>
                    <th className="py-2 px-3 text-right">Projected Temp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#21262d]">
                  {commandHistory.map((cmd) => (
                    <tr key={cmd.command_id} className="hover:bg-[#161b22]">
                      <td className="py-2 px-3 text-gray-400">{cmd.timestamp}</td>
                      <td className="py-2 px-3 text-gray-200 font-semibold">{cmd.operator}</td>
                      <td className="py-2 px-3 text-cyan-400">{cmd.cdu_id}</td>
                      <td className="py-2 px-3 text-gray-300 truncate max-w-xs">{cmd.action}</td>
                      <td className="py-2 px-3">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                          {cmd.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        {cmd.after?.cooling_power_delta_kw !== undefined && (
                          <span className={cmd.after.cooling_power_delta_kw <= 0 ? 'text-emerald-400' : 'text-amber-400'}>
                            {cmd.after.cooling_power_delta_kw > 0 ? `+${cmd.after.cooling_power_delta_kw}` : cmd.after.cooling_power_delta_kw} kW
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right text-gray-300">
                        {cmd.after?.projected_temp_c ? `${cmd.after.projected_temp_c}°C` : '-'}
                      </td>
                    </tr>
                  ))}
                  {commandHistory.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-4 text-center text-gray-500">
                        No manual commands issued yet. All units running on automatic PID tracking.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Shutdown Confirmation Modal */}
      {showShutdownConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 font-mono text-xs">
          <div className="bg-[#161b22] border-2 border-red-500 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400 font-bold text-sm">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <span>SAFETY INTERLOCK WARNING: SHUTDOWN CONFIRMATION</span>
            </div>

            <p className="text-gray-300 text-xs leading-relaxed">
              You are attempting to turn <span className="text-red-400 font-bold">OFF</span> cooling unit{' '}
              <span className="text-white font-bold">{selectedUnitId}</span> while connected racks are running active workloads.
              Airflow will drop to 0 CFM and thermal runaway will occur.
            </p>

            <div className="p-3 rounded bg-red-950/40 border border-red-500/40 text-[11px] text-red-300">
              Emergency protection interlock is active. If core temperature exceeds 95.0°C, the system will automatically override and force 100% cooling.
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowShutdownConfirm(false)}
                className="px-4 py-2 rounded bg-gray-800 text-gray-300 hover:bg-gray-700"
              >
                CANCEL
              </button>
              <button
                onClick={() => handleApplyCommand(true)}
                className="px-4 py-2 rounded bg-red-600 hover:bg-red-500 text-white font-bold"
              >
                CONFIRM SHUTDOWN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* JSON Event Inspector Modal */}
      {selectedEventForJson && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 font-mono text-xs">
          <div className="bg-[#111622] border border-[#30363d] rounded-xl p-5 max-w-lg w-full shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between border-b border-[#21262d] pb-2 mb-3">
              <div className="font-bold text-white flex items-center gap-2">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <span>Structured Telemetry Event Inspector</span>
              </div>
              <button
                onClick={() => setSelectedEventForJson(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <pre className="flex-1 overflow-auto bg-[#080c14] p-3 rounded-lg text-emerald-400 text-[11px] leading-relaxed">
              {JSON.stringify(selectedEventForJson, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
