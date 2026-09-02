import { create } from 'zustand'

export interface TelemetryData {
  total_servers: number;
  total_racks: number;
  total_buildings: number;
  power_it_mw: number;
  power_facility_mw: number;
  grid_capacity_mw: number;
  pue: number;
  coolant_flow_lpm: number;
  temp_cold_aisle_c: number;
  temp_hot_aisle_c: number;
  temp_gpu_avg_c: number;
  temp_cooling_water_supply_c: number;
  temp_cooling_water_return_c: number;
  network_throughput_tbps: number;
  grid_voltage_kv: number;
  flywheel_rpm: number;
  diesel_gen_status: string;
  cdu_status: string;
  cdu_fault_row: number | null;
  sla_uptime_percent: number;
}

export type TourState = 'MOVING' | 'ARRIVING' | 'FRAMING' | 'READY_TO_NARRATE' | 'NARRATING' | 'POST_HOLD' | 'TRANSITIONING' | 'TOUR_COMPLETE';

export type WallsMode = 'cutaway' | 'solid' | 'glass' | 'hidden';
export type FlowTraceMode = 'none' | 'power' | 'cooling' | 'network';
export type ViewMode = 'orbit' | 'fps' | 'cinematic' | 'topdown';
export type LightingMode = 'daylight' | 'golden_hour' | 'studio' | 'night';
export type VisualMode = 'realism' | 'engineering';

export interface CutawaySettings {
  roofVisible: boolean;
  wallsMode: WallsMode;
  underfloorRaised: boolean;
  showPersonnel: boolean;
  showOverheadTrays: boolean;
  flowTrace: FlowTraceMode;
}

export interface ComponentOverride {
  loadPercent?: number;
  tempC?: number;
  flowLpm?: number;
  rpm?: number;
  isDoorOpen?: boolean;
  isTrayExtended?: boolean;
}

export interface SelectedAssetInfo {
  id: string;
  name: string;
  type: 
    | 'rack_gpu' 
    | 'rack_cpu' 
    | 'cdu' 
    | 'chiller'
    | 'crah'
    | 'substation' 
    | 'cooling_tower' 
    | 'generator' 
    | 'ups_flywheel' 
    | 'switchgear'
    | 'pdu'
    | 'noc_console'
    | 'odf_frame'
    | 'hall' 
    | 'building';
  status: 'OPTIMAL' | 'WARNING' | 'CRITICAL' | 'STANDBY';
  powerKw?: number;
  tempC?: number;
  coolantFlowLpm?: number;
  pueContribution?: number;
  serverCount?: number;
  gpuUtilization?: number;
  nvlinkBandwidth?: string;
  fluidConductivity?: string;
  location?: string;
  details?: Record<string, string | number>;
  health?: number | string;
}

export type WaypointId = 
  | 'campus_overview'
  | 'building_a' 
  | 'building_b' 
  | 'building_c'
  | 'building_d'
  | 'building_e'
  | 'power_substation' 
  | 'generator_yard'
  | 'ups_building'
  | 'cooling_plant'
  | 'water_infrastructure'
  | 'security_gate'
  | 'noc_room' 
  | 'network_mmr' 
  | 'rack_closeup';

export interface DigitalTwinState {
  telemetry: TelemetryData;
  scenario: string;
  playbackSpeed: number;
  isPlaying: boolean;
  timelineProgress: number;
  currentWaypoint: WaypointId;
  viewMode: ViewMode;
  lightingMode: LightingMode;
  visualMode: VisualMode;
  selectedAsset: SelectedAssetInfo | null;
  cutaway: CutawaySettings;
  showInspector: boolean;
  showMinimap: boolean;
  isolatedAssetId: string | null;
  
  // Audio State
  audioVolume: number;
  isAudioMuted: boolean;
  
  // Interactive Hardware State
  openRackId: string | null;
  extendedTrayRackId: string | null;
  componentOverrides: Record<string, ComponentOverride>;
  
  // Player Position for Minimap / Walk Mode
  playerPos: [number, number, number];
  playerRot: number;

  // Tour State
  tourState: TourState;
  tourIndex: number;
  tourTargetId: string | null;
  tourProgress: number;
  isTourPaused: boolean;
  tourDebugMode: boolean;

  // Actions
  setTelemetry: (data: TelemetryData) => void;
  setScenario: (scenario: string) => void;
  setPlaybackSpeed: (speed: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setTimelineProgress: (progress: number) => void;
  setWaypoint: (waypoint: WaypointId) => void;
  setViewMode: (mode: ViewMode) => void;
  setLightingMode: (mode: LightingMode) => void;
  setVisualMode: (mode: VisualMode) => void;
  setSelectedAsset: (asset: SelectedAssetInfo | null) => void;
  fetchAndSetSelectedAsset: (assetId: string) => Promise<void>;
  setRoofVisible: (visible: boolean) => void;
  setWallsMode: (mode: WallsMode) => void;
  setUnderfloorRaised: (raised: boolean) => void;
  setShowPersonnel: (show: boolean) => void;
  setShowOverheadTrays: (show: boolean) => void;
  setFlowTrace: (trace: FlowTraceMode) => void;
  setShowInspector: (show: boolean) => void;
  setShowMinimap: (show: boolean) => void;
  setIsolatedAssetId: (id: string | null) => void;
  setAudioVolume: (volume: number) => void;
  setIsAudioMuted: (muted: boolean) => void;
  toggleRackDoor: (rackId: string) => void;
  toggleServerTray: (rackId: string) => void;
  setComponentOverride: (id: string, override: Partial<ComponentOverride>) => void;
  setPlayerTransform: (pos: [number, number, number], rot: number) => void;

  setTourState: (state: TourState) => void;
  setTourIndex: (index: number) => void;
  setTourTargetId: (id: string | null) => void;
  setTourProgress: (progress: number) => void;
  setIsTourPaused: (paused: boolean) => void;
  setTourDebugMode: (debug: boolean) => void;
}

export const useStore = create<DigitalTwinState>((set) => ({
  telemetry: {
    total_servers: 100000,
    total_racks: 8000,
    total_buildings: 5,
    power_it_mw: 40.0,
    power_facility_mw: 80.0,
    grid_capacity_mw: 120.0,
    pue: 1.118,
    coolant_flow_lpm: 1250000,
    temp_cold_aisle_c: 21.2,
    temp_hot_aisle_c: 33.4,
    temp_gpu_avg_c: 52.8,
    temp_cooling_water_supply_c: 18.0,
    temp_cooling_water_return_c: 32.0,
    network_throughput_tbps: 480.0,
    grid_voltage_kv: 230.0,
    flywheel_rpm: 12000,
    diesel_gen_status: '60 MW STANDBY (16 GENSETS READY)',
    cdu_status: 'OPTIMAL (30,000 TONS CHILLERS)',
    cdu_fault_row: null,
    sla_uptime_percent: 99.999
  },
  scenario: 'NORMAL',
  playbackSpeed: 1.0,
  isPlaying: true,
  timelineProgress: 35,
  currentWaypoint: 'campus_overview',
  viewMode: 'orbit',
  lightingMode: 'daylight',
  visualMode: 'realism',
  selectedAsset: null,
  showInspector: false,
  showMinimap: true,
  isolatedAssetId: null,
  audioVolume: 0.5,
  isAudioMuted: false,
  openRackId: null,
  extendedTrayRackId: null,
  componentOverrides: {},
  playerPos: [0, 2.75, 260],
  playerRot: 0,
  cutaway: {
    roofVisible: false,
    wallsMode: 'cutaway',
    underfloorRaised: false,
    showPersonnel: true,
    showOverheadTrays: true,
    flowTrace: 'none',
  },
  tourState: 'MOVING',
  tourIndex: 0,
  tourTargetId: null,
  tourProgress: 0,
  isTourPaused: false,
  tourDebugMode: false,

  setTelemetry: (data) => set({ telemetry: data }),
  setScenario: (scenario) => set({ scenario }),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setTimelineProgress: (progress) => set({ timelineProgress: progress }),
  setWaypoint: (waypoint) => set({ currentWaypoint: waypoint, viewMode: 'orbit' }),
  setViewMode: (viewMode) => set({ viewMode }),
  setLightingMode: (lightingMode) => set({ lightingMode }),
  setVisualMode: (visualMode) => set({ visualMode }),
  setSelectedAsset: (asset) => set({ selectedAsset: asset, showInspector: !!asset }),
  fetchAndSetSelectedAsset: async (assetId: string) => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const res = await fetch(`${API_URL}/api/assets/${assetId}`)
      if (res.ok) {
        const data = await res.json()
        set({ 
          selectedAsset: {
            id: data.id,
            name: data.name,
            type: data.type as any,
            status: data.status,
            powerKw: data.power_kw,
            tempC: data.temp_c,
            coolantFlowLpm: data.cooling_lpm,
            health: data.health
          }, 
          showInspector: true 
        })
      }
    } catch (e) {
      console.error("Failed to fetch asset", e)
    }
  },
  setRoofVisible: (roofVisible) => set((state) => ({ cutaway: { ...state.cutaway, roofVisible } })),
  setWallsMode: (wallsMode) => set((state) => ({ cutaway: { ...state.cutaway, wallsMode } })),
  setUnderfloorRaised: (underfloorRaised) => set((state) => ({ cutaway: { ...state.cutaway, underfloorRaised } })),
  setShowPersonnel: (showPersonnel) => set((state) => ({ cutaway: { ...state.cutaway, showPersonnel } })),
  setShowOverheadTrays: (showOverheadTrays) => set((state) => ({ cutaway: { ...state.cutaway, showOverheadTrays } })),
  setFlowTrace: (flowTrace) => set((state) => ({ cutaway: { ...state.cutaway, flowTrace } })),
  setShowInspector: (show) => set({ showInspector: show }),
  setShowMinimap: (show) => set({ showMinimap: show }),
  setIsolatedAssetId: (id) => set({ isolatedAssetId: id }),
  setAudioVolume: (volume) => set({ audioVolume: volume }),
  setIsAudioMuted: (muted) => set({ isAudioMuted: muted }),
  toggleRackDoor: (rackId) => set((state) => ({
    openRackId: state.openRackId === rackId ? null : rackId
  })),
  toggleServerTray: (rackId) => set((state) => ({
    extendedTrayRackId: state.extendedTrayRackId === rackId ? null : rackId
  })),
  setComponentOverride: (id, override) => set((state) => ({
    componentOverrides: {
      ...state.componentOverrides,
      [id]: { ...state.componentOverrides[id], ...override }
    }
  })),
  setPlayerTransform: (pos, rot) => set({ playerPos: pos, playerRot: rot }),
  
  setTourState: (tourState) => set({ tourState }),
  setTourIndex: (tourIndex) => set({ tourIndex }),
  setTourTargetId: (tourTargetId) => set({ tourTargetId }),
  setTourProgress: (tourProgress) => set({ tourProgress }),
  setIsTourPaused: (isTourPaused) => set({ isTourPaused }),
  setTourDebugMode: (tourDebugMode) => set({ tourDebugMode }),
}))
