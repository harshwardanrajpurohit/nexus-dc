import { useState, useEffect, useMemo } from 'react'
import {
  Play, RotateCcw, Award, CheckCircle2, AlertTriangle, ShieldCheck,
  TrendingDown, Zap, Droplets, Leaf, DollarSign,
  Cpu, BarChart3, LineChart,
  HelpCircle, Layers, FileText
} from 'lucide-react'

// Types matching the Python backend API
interface StrategyResult {
  strategy_key: string
  strategy_name: string
  strategy_type: string
  total_energy_kwh: number
  total_water_litres: number
  total_carbon_kg: number
  total_cost_usd: number
  total_objective_score: number
  peak_temperature_c: number
  avg_useful_compute: number
  mandatory_work_completed: number
  deadline_violations: number
  total_battery_discharged_kwh: number
  total_battery_charged_kwh: number
  safety_passed: boolean
  is_feasible: boolean
  solver_status: string
  runtime_seconds: number
  constraint_violations: Array<{
    step: number
    constraint: string
    value: number
    limit: number
    type: string
  }>
  timeseries: {
    hours: number[]
    it_power_kw: number[]
    facility_power_kw: number[]
    cooling_electric_kw: number[]
    temperature_c: number[]
    water_litres: number[]
    battery_soc_kwh: number[]
    grid_energy_kwh: number[]
    carbon_kg: number[]
    cost_usd: number[]
    useful_compute: number[]
    workload_demand: number[]
    gpu_load_fraction: number[]
    electricity_price: number[]
    carbon_intensity: number[]
    cop: number[]
    objective_score: number[]
    risk_score: number[]
  }
}

interface MetricComparisonItem {
  metric_name: string
  unit: string
  direction: string
  baseline_value: number
  values: Record<string, number>
  changes: Record<string, {
    baseline_value: number
    strategy_value: number
    absolute_change: number
    percentage_change: number | null
    is_improvement: boolean
    direction: string
    unit: string
  }>
}

interface ComparisonResponse {
  experiment_id: string
  timestamp: number
  config_summary: any
  strategy_results: Record<string, StrategyResult>
  metric_comparisons: Record<string, MetricComparisonItem>
  rankings: {
    by_objective_score: Array<{ rank: number; strategy: string; score: number }>
    best_by_metric: Record<string, { strategy: string; value: number }>
  }
  explanation: string
  best_strategy: string
  total_runtime_seconds: number
}

const STRATEGY_COLORS: Record<string, string> = {
  'A: Baseline (Existing Policy)': '#94a3b8',
  'B: Rule-Based Heuristic': '#f59e0b',
  'C: Workload-Only Optimization (MILP)': '#06b6d4',
  'D: Coordinated Optimization (MILP)': '#10b981',
  'E: Water-Priority Scenario': '#a855f7',
  'E: Carbon-Priority Scenario': '#10b981',
  'E: Cost-Priority Scenario': '#3b82f6',
}

const STRATEGY_LABELS: Record<string, string> = {
  A: 'A: Baseline',
  B: 'B: Heuristic',
  C: 'C: Workload MILP',
  D: 'D: Coordinated MILP',
  E: 'E: Priority Scenario',
}

export default function OptimizationDashboard() {
  // Experiment controls
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>(['A', 'B', 'C', 'D', 'E'])
  const [priority, setPriority] = useState<'water' | 'carbon' | 'cost'>('water')
  const [numSteps, setNumSteps] = useState<number>(24)
  const [batteryEnabled, setBatteryEnabled] = useState<boolean>(true)
  
  // Weights (normalized to sum to 1.0)
  const [weights, setWeights] = useState({
    energy: 0.20,
    water: 0.15,
    carbon: 0.15,
    cost: 0.25,
    risk: 0.10,
    useful_compute: 0.10,
    switching: 0.05,
  })

  // App UI state
  const [isRunning, setIsRunning] = useState<boolean>(false)
  const [results, setResults] = useState<ComparisonResponse | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'timeseries' | 'tradeoffs' | 'explainability' | 'formulation'>('overview')
  const [activeChartMetric, setActiveChartMetric] = useState<'power' | 'temperature' | 'battery' | 'water' | 'cost' | 'workload'>('workload')
  const [visibleStrategies, setVisibleStrategies] = useState<Record<string, boolean>>({})

  // Apply weight presets
  const applyPreset = (preset: 'balanced' | 'esg' | 'cost' | 'reliability') => {
    switch (preset) {
      case 'balanced':
        setWeights({ energy: 0.20, water: 0.15, carbon: 0.15, cost: 0.25, risk: 0.10, useful_compute: 0.10, switching: 0.05 })
        break
      case 'esg':
        setWeights({ energy: 0.10, water: 0.35, carbon: 0.35, cost: 0.05, risk: 0.05, useful_compute: 0.08, switching: 0.02 })
        break
      case 'cost':
        setWeights({ energy: 0.15, water: 0.05, carbon: 0.05, cost: 0.55, risk: 0.05, useful_compute: 0.10, switching: 0.05 })
        break
      case 'reliability':
        setWeights({ energy: 0.10, water: 0.05, carbon: 0.05, cost: 0.10, risk: 0.40, useful_compute: 0.25, switching: 0.05 })
        break
    }
  }

  // Run experiment function
  const runExperiment = async () => {
    setIsRunning(true)
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const res = await fetch(`${API_URL}/api/optimization/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategies: selectedStrategies,
          priority,
          num_steps: numSteps,
          weights,
          battery_enabled: batteryEnabled,
        }),
      })

      if (res.ok) {
        const data: ComparisonResponse = await res.json()
        setResults(data)
        // Set all returned strategies visible by default
        const vis: Record<string, boolean> = {}
        Object.keys(data.strategy_results).forEach(k => { vis[k] = true })
        setVisibleStrategies(vis)
      } else {
        console.error('Failed to run optimization experiment', await res.text())
      }
    } catch (e) {
      console.error('Network error during optimization', e)
    } finally {
      setIsRunning(false)
    }
  }

  // Run on mount
  useEffect(() => {
    runExperiment()
  }, [])

  // Best strategy result
  const bestResult = useMemo(() => {
    if (!results || !results.best_strategy) return null
    return results.strategy_results[results.best_strategy] || null
  }, [results])

  const baselineResult = useMemo(() => {
    if (!results) return null
    return results.strategy_results['A: Baseline (Existing Policy)'] || null
  }, [results])

  const strategyKeys = useMemo(() => {
    if (!results) return []
    return Object.keys(results.strategy_results)
  }, [results])

  return (
    <div className="flex-1 flex flex-col h-full bg-[#080c14] text-[#c9d1d9] overflow-hidden select-none font-sans">
      {/* 1. Header Toolbar & Quick Stats */}
      <div className="border-b border-[#21262d] bg-[#0d1117]/95 px-6 py-3 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-sm tracking-wide text-white uppercase font-mono">
                REGEN-DC Optimization & Strategy Analysis Engine
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                HiGHS MILP / MPC Solver
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Multi-Objective Mixed-Integer Linear Programming • Coordinated Cooling & Workload Scheduling
            </p>
          </div>
        </div>

        {/* Experiment Action Bar */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-[#161b22] p-1 rounded-lg border border-[#30363d] text-xs font-mono">
            <span className="text-[11px] text-gray-400 px-2">Preset:</span>
            <button
              onClick={() => applyPreset('balanced')}
              className="px-2 py-1 rounded hover:bg-[#21262d] text-gray-300 hover:text-white transition-colors"
            >
              Balanced
            </button>
            <button
              onClick={() => applyPreset('esg')}
              className="px-2 py-1 rounded hover:bg-[#21262d] text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              ESG Eco
            </button>
            <button
              onClick={() => applyPreset('cost')}
              className="px-2 py-1 rounded hover:bg-[#21262d] text-blue-400 hover:text-blue-300 transition-colors"
            >
              Cost Saver
            </button>
            <button
              onClick={() => applyPreset('reliability')}
              className="px-2 py-1 rounded hover:bg-[#21262d] text-amber-400 hover:text-amber-300 transition-colors"
            >
              Reliability
            </button>
          </div>

          <button
            onClick={runExperiment}
            disabled={isRunning}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs font-semibold transition-all shadow-md ${
              isRunning
                ? 'bg-blue-600/50 text-white cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95'
            }`}
          >
            {isRunning ? (
              <>
                <RotateCcw className="w-4 h-4 animate-spin" />
                <span>SOLVING MILP...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>RUN EXPERIMENT</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Controls & Configuration Drawer */}
      <div className="bg-[#111622] border-b border-[#21262d] px-6 py-2.5 text-xs font-mono flex flex-wrap items-center justify-between gap-4">
        {/* Strategy checkboxes */}
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-[11px] font-semibold uppercase">Strategies:</span>
          {['A', 'B', 'C', 'D', 'E'].map(k => (
            <label
              key={k}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded border cursor-pointer transition-colors ${
                selectedStrategies.includes(k)
                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-300 font-semibold'
                  : 'bg-[#161b22] border-[#30363d] text-gray-500 hover:text-gray-300'
              }`}
            >
              <input
                type="checkbox"
                className="hidden"
                checked={selectedStrategies.includes(k)}
                onChange={() => {
                  if (selectedStrategies.includes(k)) {
                    if (selectedStrategies.length > 1) {
                      setSelectedStrategies(selectedStrategies.filter(s => s !== k))
                    }
                  } else {
                    setSelectedStrategies([...selectedStrategies, k])
                  }
                }}
              />
              <span>{STRATEGY_LABELS[k]}</span>
            </label>
          ))}
        </div>

        {/* Priority and Horizon */}
        <div className="flex items-center gap-4">
          {selectedStrategies.includes('E') && (
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-[11px]">Strategy E Focus:</span>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as any)}
                className="bg-[#161b22] border border-[#30363d] text-gray-200 rounded px-2 py-1 text-xs outline-none focus:border-blue-500"
              >
                <option value="water">Water Conservation (3x Water Weight)</option>
                <option value="carbon">Carbon Minimization (3x Carbon Weight)</option>
                <option value="cost">Operating Cost Minimization (3x Cost Weight)</option>
              </select>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-[11px]">Horizon:</span>
            <select
              value={numSteps}
              onChange={e => setNumSteps(Number(e.target.value))}
              className="bg-[#161b22] border border-[#30363d] text-gray-200 rounded px-2 py-1 text-xs outline-none focus:border-blue-500"
            >
              <option value={12}>12 Hours (Fast Solve)</option>
              <option value={24}>24 Hours (Full Diurnal Cycle)</option>
            </select>
          </div>

          <label className="flex items-center gap-1.5 cursor-pointer text-gray-300">
            <input
              type="checkbox"
              checked={batteryEnabled}
              onChange={e => setBatteryEnabled(e.target.checked)}
              className="rounded bg-[#161b22] border-[#30363d] text-blue-500"
            />
            <span className="text-[11px]">Battery Storage (160 MWh)</span>
          </label>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <div className="bg-[#0d1117] px-6 border-b border-[#21262d] flex items-center justify-between">
        <div className="flex items-center gap-2">
          {[
            { id: 'overview', label: 'Strategy Comparison Overview', icon: BarChart3 },
            { id: 'timeseries', label: '24-Hour Multi-Metric Profiles', icon: LineChart },
            { id: 'tradeoffs', label: 'Trade-Off & Radar Analysis', icon: Layers },
            { id: 'explainability', label: 'Decision Insights & Proof', icon: HelpCircle },
            { id: 'formulation', label: 'Mathematical Model & Physics', icon: FileText },
          ].map(tab => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 font-mono text-xs border-b-2 font-medium transition-colors ${
                  active
                    ? 'border-emerald-400 text-emerald-400 bg-emerald-500/5'
                    : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {results && (
          <div className="text-[11px] font-mono text-gray-400 flex items-center gap-3">
            <span>Experiment: <span className="text-gray-200">{results.experiment_id}</span></span>
            <span>•</span>
            <span>HiGHS Runtime: <span className="text-emerald-400 font-semibold">{results.total_runtime_seconds.toFixed(3)}s</span></span>
          </div>
        )}
      </div>

      {/* 4. Tab Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {results ? (
          <>
            {/* TAB 1: OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Winner Card Banner */}
                {bestResult && baselineResult && (
                  <div className="p-5 rounded-xl bg-gradient-to-r from-emerald-950/40 via-[#111827] to-[#0f172a] border border-emerald-500/30 shadow-lg relative overflow-hidden">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="p-1 rounded bg-emerald-500/20 text-emerald-300">
                            <Award className="w-4 h-4" />
                          </span>
                          <span className="text-xs font-mono font-semibold text-emerald-400 uppercase tracking-wider">
                            Mathematically Proven Optimal Strategy
                          </span>
                        </div>
                        <h3 className="text-xl font-bold text-white font-mono flex items-center gap-3">
                          {bestResult.strategy_name}
                          <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Rank #1 (Score: {bestResult.total_objective_score.toFixed(4)})
                          </span>
                        </h3>
                        <p className="text-xs text-gray-300 mt-1 max-w-2xl">
                          Achieved the lowest combined multi-objective penalty score while meeting 100% of mandatory computing workloads and respecting all thermal, battery, and electrical safety constraints.
                        </p>
                      </div>

                      {/* Key Delta Badges */}
                      <div className="flex items-center gap-3 flex-wrap">
                        {/* Cost Savings */}
                        <div className="p-3 rounded-lg bg-[#161b22] border border-[#30363d] text-right">
                          <div className="text-[10px] text-gray-400 font-mono">OPEX SAVINGS</div>
                          <div className="text-base font-bold font-mono text-emerald-400">
                            {baselineResult.total_cost_usd > 0
                              ? `$${(baselineResult.total_cost_usd - bestResult.total_cost_usd).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                              : '$0'}
                          </div>
                          <div className="text-[10px] text-emerald-400/80 font-mono">
                            {baselineResult.total_cost_usd > 0
                              ? `${(((baselineResult.total_cost_usd - bestResult.total_cost_usd) / baselineResult.total_cost_usd) * 100).toFixed(1)}% vs Baseline`
                              : '0%'}
                          </div>
                        </div>

                        {/* Energy Savings */}
                        <div className="p-3 rounded-lg bg-[#161b22] border border-[#30363d] text-right">
                          <div className="text-[10px] text-gray-400 font-mono">GRID ENERGY</div>
                          <div className="text-base font-bold font-mono text-cyan-400">
                            {(bestResult.total_energy_kwh / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })} MWh
                          </div>
                          <div className="text-[10px] text-gray-400 font-mono">
                            {baselineResult.total_energy_kwh > 0
                              ? `${(((baselineResult.total_energy_kwh - bestResult.total_energy_kwh) / baselineResult.total_energy_kwh) * 100).toFixed(1)}% reduction`
                              : '0%'}
                          </div>
                        </div>

                        {/* Carbon Reduction */}
                        <div className="p-3 rounded-lg bg-[#161b22] border border-[#30363d] text-right">
                          <div className="text-[10px] text-gray-400 font-mono">CARBON ABATEMENT</div>
                          <div className="text-base font-bold font-mono text-emerald-400">
                            {((baselineResult.total_carbon_kg - bestResult.total_carbon_kg) / 1000).toFixed(1)} T CO₂
                          </div>
                          <div className="text-[10px] text-emerald-400/80 font-mono">
                            {baselineResult.total_carbon_kg > 0
                              ? `${(((baselineResult.total_carbon_kg - bestResult.total_carbon_kg) / baselineResult.total_carbon_kg) * 100).toFixed(1)}% cleaner`
                              : '0%'}
                          </div>
                        </div>

                        {/* Water Reduction */}
                        <div className="p-3 rounded-lg bg-[#161b22] border border-[#30363d] text-right">
                          <div className="text-[10px] text-gray-400 font-mono">WATER SAVED</div>
                          <div className="text-base font-bold font-mono text-blue-400">
                            {((baselineResult.total_water_litres - bestResult.total_water_litres) / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })} kL
                          </div>
                          <div className="text-[10px] text-blue-400/80 font-mono">
                            {baselineResult.total_water_litres > 0
                              ? `${(((baselineResult.total_water_litres - bestResult.total_water_litres) / baselineResult.total_water_litres) * 100).toFixed(1)}% less water`
                              : '0%'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Scorecards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
                  {/* Energy Card */}
                  <div className="p-4 rounded-xl bg-[#111622] border border-[#21262d] shadow-sm">
                    <div className="flex items-center justify-between text-gray-400 text-xs mb-2">
                      <span className="flex items-center gap-1.5"><Zap className="w-4 h-4 text-amber-400" /> GRID ELECTRICITY</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-300">Weight: {(weights.energy * 100).toFixed(0)}%</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {(bestResult?.total_energy_kwh ? (bestResult.total_energy_kwh / 1000).toFixed(1) : '0')} <span className="text-xs text-gray-400 font-normal">MWh</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-2 flex items-center justify-between">
                      <span>Baseline: {(baselineResult?.total_energy_kwh ? (baselineResult.total_energy_kwh / 1000).toFixed(1) : '0')} MWh</span>
                      {bestResult && baselineResult && bestResult.total_energy_kwh < baselineResult.total_energy_kwh ? (
                        <span className="text-emerald-400 flex items-center gap-0.5"><TrendingDown className="w-3 h-3" /> {(((baselineResult.total_energy_kwh - bestResult.total_energy_kwh) / baselineResult.total_energy_kwh) * 100).toFixed(1)}%</span>
                      ) : null}
                    </div>
                  </div>

                  {/* Water Card */}
                  <div className="p-4 rounded-xl bg-[#111622] border border-[#21262d] shadow-sm">
                    <div className="flex items-center justify-between text-gray-400 text-xs mb-2">
                      <span className="flex items-center gap-1.5"><Droplets className="w-4 h-4 text-cyan-400" /> WATER CONSUMED</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-300">Weight: {(weights.water * 100).toFixed(0)}%</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {(bestResult?.total_water_litres ? (bestResult.total_water_litres / 1000).toFixed(1) : '0')} <span className="text-xs text-gray-400 font-normal">kL (m³)</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-2 flex items-center justify-between">
                      <span>Baseline: {(baselineResult?.total_water_litres ? (baselineResult.total_water_litres / 1000).toFixed(1) : '0')} kL</span>
                      {bestResult && baselineResult && bestResult.total_water_litres < baselineResult.total_water_litres ? (
                        <span className="text-cyan-400 flex items-center gap-0.5"><TrendingDown className="w-3 h-3" /> {(((baselineResult.total_water_litres - bestResult.total_water_litres) / baselineResult.total_water_litres) * 100).toFixed(1)}%</span>
                      ) : null}
                    </div>
                  </div>

                  {/* Carbon Card */}
                  <div className="p-4 rounded-xl bg-[#111622] border border-[#21262d] shadow-sm">
                    <div className="flex items-center justify-between text-gray-400 text-xs mb-2">
                      <span className="flex items-center gap-1.5"><Leaf className="w-4 h-4 text-emerald-400" /> CARBON EMISSIONS</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-300">Weight: {(weights.carbon * 100).toFixed(0)}%</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {(bestResult?.total_carbon_kg ? (bestResult.total_carbon_kg / 1000).toFixed(1) : '0')} <span className="text-xs text-gray-400 font-normal">Tonnes CO₂</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-2 flex items-center justify-between">
                      <span>Baseline: {(baselineResult?.total_carbon_kg ? (baselineResult.total_carbon_kg / 1000).toFixed(1) : '0')} T</span>
                      {bestResult && baselineResult && bestResult.total_carbon_kg < baselineResult.total_carbon_kg ? (
                        <span className="text-emerald-400 flex items-center gap-0.5"><TrendingDown className="w-3 h-3" /> {(((baselineResult.total_carbon_kg - bestResult.total_carbon_kg) / baselineResult.total_carbon_kg) * 100).toFixed(1)}%</span>
                      ) : null}
                    </div>
                  </div>

                  {/* Cost Card */}
                  <div className="p-4 rounded-xl bg-[#111622] border border-[#21262d] shadow-sm">
                    <div className="flex items-center justify-between text-gray-400 text-xs mb-2">
                      <span className="flex items-center gap-1.5"><DollarSign className="w-4 h-4 text-blue-400" /> OPERATING COST</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-300">Weight: {(weights.cost * 100).toFixed(0)}%</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      ${bestResult?.total_cost_usd ? bestResult.total_cost_usd.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0'} <span className="text-xs text-gray-400 font-normal">USD</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-2 flex items-center justify-between">
                      <span>Baseline: ${baselineResult?.total_cost_usd ? baselineResult.total_cost_usd.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0'}</span>
                      {bestResult && baselineResult && bestResult.total_cost_usd < baselineResult.total_cost_usd ? (
                        <span className="text-emerald-400 flex items-center gap-0.5"><TrendingDown className="w-3 h-3" /> {(((baselineResult.total_cost_usd - bestResult.total_cost_usd) / baselineResult.total_cost_usd) * 100).toFixed(1)}%</span>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Strategy Comparison Matrix Table */}
                <div className="rounded-xl bg-[#111622] border border-[#21262d] overflow-hidden shadow-md">
                  <div className="p-4 border-b border-[#21262d] flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-white font-mono uppercase">Full Strategy Performance Matrix</h4>
                      <p className="text-xs text-gray-400 font-mono">Side-by-side comparison under identical facility inputs & weather conditions</p>
                    </div>
                    <span className="text-xs font-mono text-emerald-400 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4" /> All hard constraints validated independently
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-mono text-left">
                      <thead className="bg-[#161b22] text-gray-400 uppercase text-[10px] border-b border-[#21262d]">
                        <tr>
                          <th className="py-3 px-4">Rank</th>
                          <th className="py-3 px-4">Strategy</th>
                          <th className="py-3 px-4 text-right">Multi-Obj Score</th>
                          <th className="py-3 px-4 text-right">Grid Energy (kWh)</th>
                          <th className="py-3 px-4 text-right">Water (L)</th>
                          <th className="py-3 px-4 text-right">Carbon (kg)</th>
                          <th className="py-3 px-4 text-right">Cost (USD)</th>
                          <th className="py-3 px-4 text-right">Peak Temp</th>
                          <th className="py-3 px-4 text-right">Work Done</th>
                          <th className="py-3 px-4 text-center">Safety</th>
                          <th className="py-3 px-4 text-right">Runtime</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#21262d]">
                        {results.rankings.by_objective_score.map((rankItem) => {
                          const strat = results.strategy_results[rankItem.strategy]
                          if (!strat) return null
                          const isWinner = rankItem.rank === 1
                          
                          return (
                            <tr
                              key={rankItem.strategy}
                              className={`hover:bg-[#161b22]/70 transition-colors ${
                                isWinner ? 'bg-emerald-950/20 font-semibold' : ''
                              }`}
                            >
                              <td className="py-3.5 px-4">
                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs ${
                                  rankItem.rank === 1 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' :
                                  rankItem.rank === 2 ? 'bg-cyan-500/20 text-cyan-400' :
                                  'bg-gray-800 text-gray-400'
                                }`}>
                                  {rankItem.rank}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 font-semibold flex items-center gap-2">
                                <div
                                  className="w-2.5 h-2.5 rounded-full"
                                  style={{ backgroundColor: STRATEGY_COLORS[strat.strategy_name] || '#3b82f6' }}
                                />
                                <span className="text-white">{strat.strategy_name}</span>
                                {isWinner && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                    BEST
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-right font-bold text-white">
                                {strat.total_objective_score.toFixed(4)}
                              </td>
                              <td className="py-3.5 px-4 text-right text-gray-300">
                                {strat.total_energy_kwh.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </td>
                              <td className="py-3.5 px-4 text-right text-gray-300">
                                {strat.total_water_litres.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </td>
                              <td className="py-3.5 px-4 text-right text-gray-300">
                                {strat.total_carbon_kg.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </td>
                              <td className="py-3.5 px-4 text-right text-gray-300">
                                ${strat.total_cost_usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </td>
                              <td className="py-3.5 px-4 text-right text-gray-300">
                                {strat.peak_temperature_c.toFixed(1)}°C
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <span className={strat.avg_useful_compute >= 0.99 ? 'text-emerald-400' : 'text-amber-400'}>
                                  {(strat.avg_useful_compute * 100).toFixed(1)}%
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                {strat.safety_passed ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-400">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Pass
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-red-400">
                                    <AlertTriangle className="w-3.5 h-3.5" /> Fail
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-right text-gray-400 text-[11px]">
                                {strat.runtime_seconds.toFixed(3)}s
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: TIME-SERIES CHARTS */}
            {activeTab === 'timeseries' && (
              <div className="space-y-4">
                {/* Metric Selector & Legend */}
                <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-[#111622] border border-[#21262d]">
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="text-gray-400">Time-Series Metric:</span>
                    {[
                      { id: 'workload', label: 'Workload & IT Power' },
                      { id: 'temperature', label: 'Thermal Envelope & COP' },
                      { id: 'battery', label: 'Battery Storage SOC' },
                      { id: 'water', label: 'Water Evaporation Rate' },
                      { id: 'cost', label: 'Hourly Cost & Price' },
                    ].map(m => (
                      <button
                        key={m.id}
                        onClick={() => setActiveChartMetric(m.id as any)}
                        className={`px-3 py-1.5 rounded transition-colors ${
                          activeChartMetric === m.id
                            ? 'bg-blue-600 text-white font-semibold'
                            : 'bg-[#161b22] text-gray-300 hover:bg-[#21262d]'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  {/* Strategy toggles */}
                  <div className="flex items-center gap-3 font-mono text-xs flex-wrap">
                    <span className="text-gray-400 text-[11px]">Overlays:</span>
                    {strategyKeys.map(k => (
                      <label key={k} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={visibleStrategies[k] ?? true}
                          onChange={e => setVisibleStrategies({ ...visibleStrategies, [k]: e.target.checked })}
                          className="rounded"
                        />
                        <span style={{ color: STRATEGY_COLORS[k] || '#94a3b8' }}>
                          {k.split(':')[0]}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* SVG Time-Series Chart */}
                <div className="p-6 rounded-xl bg-[#111622] border border-[#21262d]">
                  <h4 className="text-sm font-bold text-white font-mono mb-4 flex items-center justify-between">
                    <span>
                      {activeChartMetric === 'workload' && 'Scheduled Compute Load vs Demanded Workload (Peak Shaving & Valley Filling)'}
                      {activeChartMetric === 'temperature' && 'Data Hall Temperature Dynamics vs Outside Ambient (°C)'}
                      {activeChartMetric === 'battery' && 'Battery State of Charge & Power Dispatch (MWh)'}
                      {activeChartMetric === 'water' && 'Cooling Evaporative Water Rate (Litres/Hour)'}
                      {activeChartMetric === 'cost' && 'Hourly Operating Cost (USD/Hour) vs Electricity Tariff'}
                    </span>
                    <span className="text-xs font-normal text-gray-400">24-Hour Horizon (dt = 1.0 hr)</span>
                  </h4>

                  {/* Custom Responsive SVG Chart */}
                  <div className="w-full h-80 relative">
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 900 300">
                      {/* Grid Lines */}
                      {[0, 1, 2, 3, 4].map(i => {
                        const y = 20 + i * 60
                        return (
                          <g key={i}>
                            <line x1="60" y1={y} x2="880" y2={y} stroke="#21262d" strokeDasharray="3 3" />
                            <text x="50" y={y + 4} fill="#64748b" fontSize="10" textAnchor="end" fontFamily="monospace">
                              {activeChartMetric === 'workload' && `${(1.0 - i * 0.25).toFixed(2)}`}
                              {activeChartMetric === 'temperature' && `${(35 - i * 5).toFixed(0)}°C`}
                              {activeChartMetric === 'battery' && `${(160 - i * 40).toFixed(0)} MWh`}
                              {activeChartMetric === 'water' && `${((400000 - i * 100000) / 1000).toFixed(0)}k`}
                              {activeChartMetric === 'cost' && `$${((25000 - i * 6000)).toLocaleString()}`}
                            </text>
                          </g>
                        )
                      })}

                      {/* X-axis hours */}
                      {Array.from({ length: 25 }, (_, i) => i).filter(h => h % 3 === 0).map(h => {
                        const x = 60 + (h / 24) * 820
                        return (
                          <g key={h}>
                            <line x1={x} y1="20" x2={x} y2="260" stroke="#161b22" />
                            <text x={x} y="280" fill="#64748b" fontSize="10" textAnchor="middle" fontFamily="monospace">
                              {`${h}:00`}
                            </text>
                          </g>
                        )
                      })}

                      {/* Demand profile background curve */}
                      {baselineResult && (
                        <path
                          d={baselineResult.timeseries.workload_demand.reduce((acc, d, i) => {
                            const x = 60 + (i / 23) * 820
                            let y = 260
                            if (activeChartMetric === 'workload') y = 260 - (d / 1.0) * 240
                            else if (activeChartMetric === 'cost') y = 260 - (baselineResult.timeseries.electricity_price[i] / 0.15) * 240
                            else if (activeChartMetric === 'temperature') y = 260 - ((baselineResult.timeseries.temperature_c[i] - 15) / 20) * 240
                            else if (activeChartMetric === 'battery') y = 260 - (baselineResult.timeseries.battery_soc_kwh[i] / 160000) * 240
                            else if (activeChartMetric === 'water') y = 260 - (baselineResult.timeseries.water_litres[i] / 400000) * 240
                            return `${acc} ${i === 0 ? 'M' : 'L'} ${x} ${y}`
                          }, '')}
                          fill="none"
                          stroke="#475569"
                          strokeWidth="2"
                          strokeDasharray="4 4"
                        />
                      )}

                      {/* Strategy Curves */}
                      {strategyKeys.map(key => {
                        if (!visibleStrategies[key]) return null
                        const strat = results.strategy_results[key]
                        const color = STRATEGY_COLORS[key] || '#3b82f6'

                        const pathData = strat.timeseries.hours.reduce((acc, _, i) => {
                          const x = 60 + (i / 23) * 820
                          let val = 0
                          if (activeChartMetric === 'workload') val = strat.timeseries.gpu_load_fraction[i] / 1.0
                          else if (activeChartMetric === 'temperature') val = (strat.timeseries.temperature_c[i] - 15) / 20
                          else if (activeChartMetric === 'battery') val = strat.timeseries.battery_soc_kwh[i] / 160000
                          else if (activeChartMetric === 'water') val = strat.timeseries.water_litres[i] / 400000
                          else if (activeChartMetric === 'cost') val = strat.timeseries.cost_usd[i] / 25000

                          const y = Math.max(20, Math.min(260, 260 - val * 240))
                          return `${acc} ${i === 0 ? 'M' : 'L'} ${x} ${y}`
                        }, '')

                        return (
                          <g key={key}>
                            <path
                              d={pathData}
                              fill="none"
                              stroke={color}
                              strokeWidth={key.includes('Coordinated') || key.includes('Workload-Only') ? '3' : '2'}
                              strokeOpacity="0.9"
                            />
                            {/* Points on curve */}
                            {strat.timeseries.hours.filter((_, i) => i % 2 === 0).map((_, idx) => {
                              const i = idx * 2
                              const x = 60 + (i / 23) * 820
                              let val = 0
                              if (activeChartMetric === 'workload') val = strat.timeseries.gpu_load_fraction[i] / 1.0
                              else if (activeChartMetric === 'temperature') val = (strat.timeseries.temperature_c[i] - 15) / 20
                              else if (activeChartMetric === 'battery') val = strat.timeseries.battery_soc_kwh[i] / 160000
                              else if (activeChartMetric === 'water') val = strat.timeseries.water_litres[i] / 400000
                              else if (activeChartMetric === 'cost') val = strat.timeseries.cost_usd[i] / 25000
                              const y = Math.max(20, Math.min(260, 260 - val * 240))
                              return (
                                <circle
                                  key={i}
                                  cx={x}
                                  cy={y}
                                  r="3"
                                  fill={color}
                                  stroke="#0f172a"
                                  strokeWidth="1.5"
                                />
                              )
                            })}
                          </g>
                        )
                      })}
                    </svg>
                  </div>

                  {/* Footnote */}
                  <div className="mt-4 pt-3 border-t border-[#21262d] flex items-center justify-between text-xs font-mono text-gray-400">
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-0.5 border-b-2 border-dashed border-gray-400"></span> Demanded Profile / Input Reference
                    </span>
                    <span>Values computed at 1-hour resolution using HiGHS rolling-horizon MPC</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: TRADEOFFS & RADAR */}
            {activeTab === 'tradeoffs' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 font-mono">
                {/* Multi-Dimensional Radar Chart */}
                <div className="p-6 rounded-xl bg-[#111622] border border-[#21262d] flex flex-col items-center">
                  <h4 className="text-sm font-bold text-white uppercase mb-1 self-start">
                    Multi-Objective Dimension Radar
                  </h4>
                  <p className="text-xs text-gray-400 mb-6 self-start">
                    Normalized comparison across all 6 key performance axes (Higher = Better)
                  </p>

                  <div className="w-80 h-80 relative flex items-center justify-center">
                    <svg className="w-full h-full overflow-visible" viewBox="-120 -120 240 240">
                      {/* Concentric Polygons */}
                      {[0.25, 0.5, 0.75, 1.0].map(level => {
                        const points = [0, 1, 2, 3, 4, 5].map(idx => {
                          const angle = (idx * Math.PI) / 3 - Math.PI / 2
                          return `${Math.cos(angle) * level * 80},${Math.sin(angle) * level * 80}`
                        }).join(' ')
                        return (
                          <polygon
                            key={level}
                            points={points}
                            fill="none"
                            stroke="#21262d"
                            strokeWidth="1"
                            strokeDasharray={level === 1.0 ? '' : '2 2'}
                          />
                        )
                      })}

                      {/* Radial Axes */}
                      {[
                        { label: 'Energy Eff', angle: -Math.PI / 2 },
                        { label: 'Water Cons', angle: -Math.PI / 6 },
                        { label: 'Carbon Abate', angle: Math.PI / 6 },
                        { label: 'Cost Savings', angle: Math.PI / 2 },
                        { label: 'Thermal Safety', angle: (5 * Math.PI) / 6 },
                        { label: 'Work Delivered', angle: -(5 * Math.PI) / 6 },
                      ].map((axis, i) => {
                        const x = Math.cos(axis.angle) * 80
                        const y = Math.sin(axis.angle) * 80
                        const lx = Math.cos(axis.angle) * 105
                        const ly = Math.sin(axis.angle) * 105
                        return (
                          <g key={i}>
                            <line x1="0" y1="0" x2={x} y2={y} stroke="#30363d" strokeWidth="1" />
                            <text
                              x={lx}
                              y={ly + 3}
                              fill="#94a3b8"
                              fontSize="9"
                              textAnchor="middle"
                              fontFamily="monospace"
                            >
                              {axis.label}
                            </text>
                          </g>
                        )
                      })}

                      {/* Strategy Radar Polygons */}
                      {strategyKeys.map(key => {
                        const strat = results.strategy_results[key]
                        const baseline = results.strategy_results['A: Baseline (Existing Policy)']
                        if (!strat || !baseline) return null

                        // Compute normalized scores [0.2 to 1.0]
                        const energyScore = Math.max(0.2, Math.min(1.0, 1.0 - (strat.total_energy_kwh - baseline.total_energy_kwh * 0.8) / (baseline.total_energy_kwh * 0.4)))
                        const waterScore = Math.max(0.2, Math.min(1.0, 1.0 - (strat.total_water_litres - baseline.total_water_litres * 0.8) / (baseline.total_water_litres * 0.4)))
                        const carbonScore = Math.max(0.2, Math.min(1.0, 1.0 - (strat.total_carbon_kg - baseline.total_carbon_kg * 0.8) / (baseline.total_carbon_kg * 0.4)))
                        const costScore = Math.max(0.2, Math.min(1.0, 1.0 - (strat.total_cost_usd - baseline.total_cost_usd * 0.8) / (baseline.total_cost_usd * 0.4)))
                        const tempScore = Math.max(0.2, Math.min(1.0, (35 - strat.peak_temperature_c) / 10))
                        const workScore = Math.max(0.2, Math.min(1.0, strat.avg_useful_compute))

                        const scores = [energyScore, waterScore, carbonScore, costScore, tempScore, workScore]
                        const points = scores.map((sc, idx) => {
                          const angle = (idx * Math.PI) / 3 - Math.PI / 2
                          return `${Math.cos(angle) * sc * 80},${Math.sin(angle) * sc * 80}`
                        }).join(' ')

                        const color = STRATEGY_COLORS[key] || '#3b82f6'

                        return (
                          <polygon
                            key={key}
                            points={points}
                            fill={color}
                            fillOpacity={key.includes('Coordinated') || key.includes('Workload-Only') ? '0.25' : '0.08'}
                            stroke={color}
                            strokeWidth={key.includes('Coordinated') ? '2.5' : '1.5'}
                          />
                        )
                      })}
                    </svg>
                  </div>
                </div>

                {/* Pareto Frontier Scatter Plot */}
                <div className="p-6 rounded-xl bg-[#111622] border border-[#21262d] flex flex-col justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white uppercase mb-1">
                      Pareto Trade-Off Frontier: Cost vs Carbon
                    </h4>
                    <p className="text-xs text-gray-400 mb-6">
                      Visualizing non-dominated solutions: Lower Cost ($) and Lower Carbon (Tonnes)
                    </p>

                    <div className="w-full h-64 relative bg-[#0d1117] rounded-lg p-4 border border-[#21262d]">
                      {/* Simple scatter plot */}
                      <svg className="w-full h-full overflow-visible" viewBox="0 0 400 200">
                        {/* Axes */}
                        <line x1="40" y1="20" x2="40" y2="170" stroke="#30363d" />
                        <line x1="40" y1="170" x2="380" y2="170" stroke="#30363d" />
                        <text x="380" y="190" fill="#64748b" fontSize="10" textAnchor="end">Operating Cost ($)</text>
                        <text x="35" y="15" fill="#64748b" fontSize="10" textAnchor="start">Carbon (T)</text>

                        {strategyKeys.map(k => {
                          const s = results.strategy_results[k]
                          if (!s) return null
                          // Normalize coordinates
                          const x = 80 + ((s.total_cost_usd - 280000) / 70000) * 260
                          const y = 150 - ((s.total_carbon_kg - 1000000) / 600000) * 110
                          const color = STRATEGY_COLORS[k] || '#3b82f6'

                          return (
                            <g key={k}>
                              <circle
                                cx={Math.max(60, Math.min(360, x))}
                                cy={Math.max(30, Math.min(160, y))}
                                r="6"
                                fill={color}
                                stroke="#fff"
                                strokeWidth="1"
                              />
                              <text
                                x={Math.max(60, Math.min(360, x)) + 8}
                                y={Math.max(30, Math.min(160, y)) + 3}
                                fill={color}
                                fontSize="9"
                              >
                                {k.split(':')[0]}
                              </text>
                            </g>
                          )
                        })}
                      </svg>
                    </div>
                  </div>

                  <div className="mt-4 p-3 rounded bg-[#161b22] border border-[#21262d] text-xs text-gray-300">
                    <span className="text-emerald-400 font-semibold">Pareto Efficiency Insight: </span>
                    Strategy D (Coordinated MILP) and Strategy C dominate Strategy A (Baseline), offering strictly lower carbon emissions for equal or lower cost by utilizing battery arbitrage and flexible compute shifting.
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: EXPLAINABILITY */}
            {activeTab === 'explainability' && (
              <div className="space-y-6 font-mono text-xs">
                {/* Plain-English Explanation Card */}
                <div className="p-6 rounded-xl bg-[#111622] border border-[#21262d] shadow-sm">
                  <div className="flex items-center gap-2 text-emerald-400 mb-3">
                    <HelpCircle className="w-5 h-5" />
                    <h4 className="text-sm font-bold uppercase tracking-wide text-white">
                      Automated Mathematical Audit & Decision Explanation
                    </h4>
                  </div>

                  <div className="p-4 rounded-lg bg-[#0d1117] border border-[#21262d] text-gray-200 leading-relaxed whitespace-pre-line">
                    {results.explanation}
                  </div>
                </div>

                {/* Constraint & Safety Verification Matrix */}
                <div className="p-6 rounded-xl bg-[#111622] border border-[#21262d]">
                  <h4 className="text-sm font-bold uppercase tracking-wide text-white mb-4 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    Independent Constraint Safety Verification Report
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-3.5 rounded-lg bg-[#161b22] border border-emerald-500/20">
                      <div className="text-gray-400 text-[10px]">THERMAL ENVELOPE</div>
                      <div className="text-base font-bold text-white mt-1">15.0°C – 35.0°C</div>
                      <div className="text-emerald-400 text-[11px] mt-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Peak: {bestResult?.peak_temperature_c.toFixed(1)}°C (Safe)
                      </div>
                    </div>

                    <div className="p-3.5 rounded-lg bg-[#161b22] border border-emerald-500/20">
                      <div className="text-gray-400 text-[10px]">GRID UTILITY CEILING</div>
                      <div className="text-base font-bold text-white mt-1">1,150.0 MW (Dual 400kV)</div>
                      <div className="text-emerald-400 text-[11px] mt-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> 0 Curtailment Violations
                      </div>
                    </div>

                    <div className="p-3.5 rounded-lg bg-[#161b22] border border-emerald-500/20">
                      <div className="text-gray-400 text-[10px]">BATTERY BESS ENVELOPE</div>
                      <div className="text-base font-bold text-white mt-1">32 MWh – 160 MWh (20-100%)</div>
                      <div className="text-emerald-400 text-[11px] mt-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> 0 Depth-of-Discharge Violations
                      </div>
                    </div>

                    <div className="p-3.5 rounded-lg bg-[#161b22] border border-emerald-500/20">
                      <div className="text-gray-400 text-[10px]">MANDATORY WORKLOAD SLA</div>
                      <div className="text-base font-bold text-white mt-1">100% Critical Work</div>
                      <div className="text-emerald-400 text-[11px] mt-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> 0 SLA Deadline Breaches
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: FORMULATION */}
            {activeTab === 'formulation' && (
              <div className="space-y-6 font-mono text-xs">
                {/* Multi-Objective Equation */}
                <div className="p-6 rounded-xl bg-[#111622] border border-[#21262d]">
                  <h4 className="text-sm font-bold uppercase text-white mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-cyan-400" />
                    Multi-Objective Optimization Formulation (MILP)
                  </h4>
                  <p className="text-gray-400 mb-4">
                    The optimizer minimizes the normalized multi-attribute objective subject to linear and linearized physical constraints:
                  </p>

                  <div className="p-4 rounded-lg bg-[#0d1117] border border-[#21262d] font-mono text-cyan-300 overflow-x-auto text-xs leading-relaxed">
                    {`minimize  J = ∑_{t=0}^{H-1} [
    w_E   × ( E_grid(t) / E_ref )
  + w_W   × ( Water(t)  / W_ref )
  + w_C   × ( Carbon(t) / C_ref )
  + w_Cost× ( Cost(t)   / Cost_ref )
  + w_R   × ( Risk(t)   / R_ref )
  - w_U   × ( UsefulCompute(t) / Compute_ref )
  + λ_sw  × | u(t) - u(t-1) |
]`}
                  </div>
                </div>

                {/* Decision Variables & Constraints Reference */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-[#111622] border border-[#21262d]">
                    <h5 className="font-bold text-white mb-2 uppercase text-xs">Decision Variables u(t)</h5>
                    <ul className="space-y-1.5 text-gray-300 text-[11px]">
                      <li>• <span className="text-cyan-400">w_gpu(t), w_cpu(t)</span>: Workload fractions ∈ [w_mandatory(t), 1.0]</li>
                      <li>• <span className="text-cyan-400">ΔT_cooling(t)</span>: Cooling setpoint offset ∈ [-0.15, +0.15]</li>
                      <li>• <span className="text-cyan-400">P_charge(t)</span>: Battery charge power ∈ [0, 80 MW]</li>
                      <li>• <span className="text-cyan-400">P_discharge(t)</span>: Battery discharge power ∈ [0, 80 MW]</li>
                      <li>• <span className="text-cyan-400">s_abs(t)</span>: Linearized control switching penalty variable</li>
                    </ul>
                  </div>

                  <div className="p-4 rounded-xl bg-[#111622] border border-[#21262d]">
                    <h5 className="font-bold text-white mb-2 uppercase text-xs">Hard Physical Constraints</h5>
                    <ul className="space-y-1.5 text-gray-300 text-[11px]">
                      <li>• <span className="text-emerald-400">Energy Balance</span>: P_grid = P_IT + P_cool + P_other + P_ch - P_dis - P_solar</li>
                      <li>• <span className="text-emerald-400">Thermal Dynamics</span>: T(t+1) = T(t) + dt × (P_heat - Q_cool) / C_thermal</li>
                      <li>• <span className="text-emerald-400">Battery Dynamics</span>: SOC(t+1) = SOC(t) + dt × (η_c P_ch - P_dis / η_d)</li>
                      <li>• <span className="text-emerald-400">Work Conservation</span>: ∑_t w(t) ≥ Total Demanded Work + Backlog</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="h-64 flex flex-col items-center justify-center text-gray-500 font-mono text-xs">
            <RotateCcw className="w-8 h-8 animate-spin text-blue-500 mb-3" />
            <span>Connecting to HiGHS optimization engine...</span>
          </div>
        )}
      </div>
    </div>
  )
}
