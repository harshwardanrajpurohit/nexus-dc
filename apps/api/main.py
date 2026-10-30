from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import asyncio
import json
import time
from simulation.engine import sim_engine

app = FastAPI(title="Gigawatt-Scale Hyperscale AI Digital Twin API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in list(self.active_connections):
            try:
                await connection.send_text(message)
            except Exception:
                if connection in self.active_connections:
                    self.active_connections.remove(connection)

manager = ConnectionManager()

# Global Simulation State
# We now use sim_engine from simulation.engine

class ScenarioTriggerRequest(BaseModel):
    scenario: str
    params: dict = {}

@app.get("/")
def read_root():
    return {
        "status": "ok",
        "facility": "Gigawatt-Scale AI Hyperscale Data Center",
        "total_servers": "1,000,000+ (800,000 CPUs + 200,000 GPUs)",
        "racks": "22,778 (20,000 CPU + 2,778 GB200 NVL72)",
        "substation_capacity_mw": 1150.0,
        "cooling_capacity_lpm": 527820
    }

@app.post("/api/scenario")
def set_scenario(req: ScenarioTriggerRequest):
    sim_engine.set_scenario(req.scenario.upper(), req.params)
    return {"status": "success", "current_scenario": sim_engine.state["scenario"]}

@app.get("/api/assets/{asset_id}")
def get_asset(asset_id: str):
    asset = sim_engine.get_asset(asset_id)
    if asset:
        return asset
    raise HTTPException(status_code=404, detail="Asset not found")

@app.get("/api/facility/stats")
def get_facility_stats():
    return {
        "facility_name": "Titan-1 Gigawatt AI Campus",
        "total_servers": 1000000,
        "cpu_servers": 800000,
        "gpu_servers": 200000,
        "total_racks": 22778,
        "cpu_racks": 20000,
        "gpu_racks": 2778,
        "buildings": 5,
        "data_halls": 20,
        "cooling_loop_lpm": 527820,
        "substation_grid": "400kV MSETCL Dual Feeds",
        "flywheel_ups_count": 20,
        "backup_gensets_count": 20
    }


# ============================================================================
# REGEN-DC Optimization & Comparison API Endpoints
# ============================================================================

class OptimizationRequest(BaseModel):
    strategies: list = ["A", "B", "C", "D"]
    priority: str = "water"
    num_steps: int = 24
    dt_hours: float = 1.0
    mpc_horizon: int = 6
    weights: dict = {}
    battery_enabled: bool = True

class SensitivityRequest(BaseModel):
    presets: list = ["balanced", "energy_cost", "water", "carbon"]
    num_steps: int = 24

@app.post("/api/optimization/compare")
async def run_optimization_comparison(req: OptimizationRequest):
    """
    Run a full REGEN-DC strategy comparison experiment.
    Returns computed metrics for all strategies with identical conditions.
    """
    import concurrent.futures
    from optimization.config import (
        ExperimentConfig, FacilityConfig, ObjectiveWeights,
        NormalizationRefs, ScenarioInputs, ConstraintLimits
    )
    from optimization.comparator import run_comparison

    # Build config from request
    config = ExperimentConfig()
    config.scenario = ScenarioInputs(num_steps=req.num_steps, dt_hours=req.dt_hours)
    config.mpc_horizon = req.mpc_horizon
    config.facility.battery_enabled = req.battery_enabled

    # Apply custom weights if provided
    if req.weights:
        for key, val in req.weights.items():
            if hasattr(config.weights, f"w_{key}"):
                setattr(config.weights, f"w_{key}", float(val))
        config.weights.validate()

    # Run in thread pool to avoid blocking the event loop
    loop = asyncio.get_event_loop()
    with concurrent.futures.ThreadPoolExecutor() as pool:
        comparison = await loop.run_in_executor(
            pool,
            lambda: run_comparison(config, req.strategies, req.priority)
        )

    return {
        "experiment_id": comparison.experiment_id,
        "timestamp": comparison.timestamp,
        "config_summary": comparison.config_summary,
        "strategy_results": comparison.strategy_results,
        "metric_comparisons": comparison.metric_comparisons,
        "rankings": comparison.rankings,
        "explanation": comparison.explanation,
        "best_strategy": comparison.best_strategy,
        "total_runtime_seconds": round(comparison.total_runtime_seconds, 3),
    }

@app.get("/api/optimization/config")
def get_optimization_config():
    """Get the default REGEN-DC optimization configuration."""
    from optimization.config import ExperimentConfig
    config = ExperimentConfig()
    return {
        "facility": {
            "gpu_racks": config.facility.num_gpu_racks,
            "cpu_racks": config.facility.num_cpu_racks,
            "total_it_capacity_kw": config.facility.total_it_capacity_kw,
            "grid_capacity_mw": config.facility.grid_capacity_mw,
            "pue_base": config.facility.pue_base,
            "cop_nominal": config.facility.cop_nominal,
            "battery_capacity_kwh": config.facility.battery_capacity_kwh,
            "battery_enabled": config.facility.battery_enabled,
            "temp_max_c": config.facility.temp_max_c,
        },
        "weights": {
            "energy": config.weights.w_energy,
            "water": config.weights.w_water,
            "carbon": config.weights.w_carbon,
            "cost": config.weights.w_cost,
            "risk": config.weights.w_risk,
            "useful_compute": config.weights.w_useful_compute,
            "switching": config.weights.w_switching,
        },
        "normalization": {
            "energy_ref_kwh": config.normalization.energy_ref_kwh,
            "water_ref_litres": config.normalization.water_ref_litres,
            "carbon_ref_kg": config.normalization.carbon_ref_kg,
            "cost_ref_usd": config.normalization.cost_ref_usd,
        },
        "constraints": {
            "max_facility_power_kw": config.constraints.max_facility_power_kw,
            "temp_max_c": config.constraints.temp_max_c,
            "temp_min_c": config.constraints.temp_min_c,
            "min_battery_soc_kwh": config.constraints.min_battery_soc_kwh,
        },
        "strategies_available": ["A", "B", "C", "D", "E"],
        "strategy_descriptions": {
            "A": "Baseline (Existing Policy)",
            "B": "Rule-Based Heuristic",
            "C": "Workload-Only MILP Optimization",
            "D": "Coordinated Resource Optimization (MILP)",
            "E": "Resource-Priority Scenario",
        },
    }

@app.post("/api/optimization/sensitivity")
async def run_weight_sensitivity(req: SensitivityRequest):
    """
    Run weight sensitivity analysis with multiple weight presets.
    Shows how the recommended strategy changes under different priorities.
    """
    import concurrent.futures
    from optimization.config import ExperimentConfig, ScenarioInputs, ObjectiveWeights
    from optimization.comparator import run_comparison

    weight_presets = {
        "balanced": ObjectiveWeights(w_energy=1.0, w_water=1.0, w_carbon=1.0, w_cost=1.0),
        "energy_cost": ObjectiveWeights(w_energy=2.0, w_water=0.5, w_carbon=0.5, w_cost=2.0),
        "water": ObjectiveWeights(w_energy=0.5, w_water=3.0, w_carbon=0.5, w_cost=0.5),
        "carbon": ObjectiveWeights(w_energy=0.5, w_water=0.5, w_carbon=3.0, w_cost=0.5),
    }

    results = {}
    loop = asyncio.get_event_loop()

    for preset_name in req.presets:
        if preset_name not in weight_presets:
            continue

        config = ExperimentConfig()
        config.scenario = ScenarioInputs(num_steps=req.num_steps)
        config.weights = weight_presets[preset_name]

        with concurrent.futures.ThreadPoolExecutor() as pool:
            comparison = await loop.run_in_executor(
                pool,
                lambda c=config: run_comparison(c, ["A", "D"], "water")
            )

        results[preset_name] = {
            "weights": {
                "energy": config.weights.w_energy,
                "water": config.weights.w_water,
                "carbon": config.weights.w_carbon,
                "cost": config.weights.w_cost,
            },
            "best_strategy": comparison.best_strategy,
            "strategy_results": comparison.strategy_results,
            "explanation": comparison.explanation,
        }

    return {"sensitivity_results": results}


# ============================================================================
# NEXUS DC — Live Operations & Manual Thermal Control API Endpoints
# ============================================================================

class ManualCoolingRequest(BaseModel):
    mode: str = None                 # "AUTO" or "MANUAL"
    power_state: str = None          # "ON" or "OFF"
    fan_speed_percent: float = None  # 0.0 to 100.0 %
    setpoint_c: float = None         # 15.0 to 30.0 °C
    operator: str = "Control Room Operator"
    force_override: bool = False

class SimClockRequest(BaseModel):
    action: str                      # "PAUSE", "RESUME", "STEP", "SET_SPEED"
    speed: float = 1.0


@app.get("/api/control/cooling-units")
def get_cooling_units():
    """Returns summary list of all cooling units (CDUs) across the facility."""
    units = sim_engine.get_cooling_units()
    summary = []
    for u in units:
        summary.append({
            "id": u["id"],
            "name": u["name"],
            "parent_id": u["parent_id"],
            "status": u["status"],
            "operating_mode": u.get("operating_mode", "AUTO"),
            "power_state": u.get("power_state", "ON"),
            "fan_speed_percent": u.get("fan_speed_percent", 60.0),
            "fan_rpm": u.get("fan_rpm", 2160),
            "setpoint_c": u.get("setpoint_c", 22.0),
            "measured_temp_c": u.get("measured_temp_c", 22.0),
            "airflow_cfm": u.get("airflow_cfm", 15000.0),
            "cooling_power_kw": u.get("cooling_power_kw", 18.5),
            "emergency_override": u.get("emergency_override", False),
            "override_reason": u.get("override_reason"),
            "connected_racks_count": len(u.get("connected_racks", [])),
            "last_updated": u.get("last_updated"),
        })
    return {"cooling_units": summary, "count": len(summary)}


@app.get("/api/control/cooling-units/{unit_id}")
def get_cooling_unit_detail(unit_id: str):
    """Returns detailed state of a specific cooling unit and all connected racks."""
    detail = sim_engine.get_cooling_unit_detail(unit_id)
    if detail:
        return detail
    raise HTTPException(status_code=404, detail=f"Cooling unit '{unit_id}' not found")


@app.post("/api/control/cooling-units/{unit_id}")
def apply_cooling_command(unit_id: str, req: ManualCoolingRequest):
    """
    Executes an operator cooling control command (AUTO/MANUAL, fan speed, setpoint, power).
    Validates safety limits and returns before/after impact analysis.
    """
    result = sim_engine.apply_cooling_command(
        cdu_id=unit_id,
        mode=req.mode,
        power_state=req.power_state,
        fan_speed_percent=req.fan_speed_percent,
        setpoint_c=req.setpoint_c,
        operator=req.operator,
        force_override=req.force_override,
    )
    if not result["success"] and result["status"] == "CONFIRMATION_REQUIRED":
        return result
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["reason"])
    return result


@app.post("/api/control/cooling-units/{unit_id}/reset")
def reset_cooling_unit(unit_id: str):
    """Resets cooling unit to AUTO mode and normal parameters."""
    result = sim_engine.reset_cdu_auto(unit_id)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["reason"])
    return result


@app.get("/api/control/events")
def get_telemetry_events(
    limit: int = 100,
    severity: str = None,
    source: str = None,
    search: str = None,
):
    """Retrieves live incoming telemetry event stream from the ring buffer."""
    events = list(sim_engine.events_log)
    if severity:
        events = [e for e in events if e["severity"].upper() == severity.upper()]
    if source:
        events = [e for e in events if source.lower() in e["source"].lower()]
    if search:
        search_lower = search.lower()
        events = [e for e in events if search_lower in e["message"].lower() or search_lower in e["source"].lower()]

    return {
        "events": events[:limit],
        "total_buffered": len(sim_engine.events_log),
        "returned": len(events[:limit])
    }


@app.get("/api/control/alarms")
def get_alarms(active_only: bool = False):
    """Returns operational alarms (thermal, mechanical, grid)."""
    return {
        "active_alarms": list(sim_engine.active_alarms.values()),
        "alarm_history": list(sim_engine.alarm_history[:50]) if not active_only else [],
    }


@app.post("/api/control/alarms/{alarm_id}/ack")
def acknowledge_alarm(alarm_id: str):
    """Acknowledges an active alarm."""
    success = sim_engine.acknowledge_alarm(alarm_id)
    if success:
        return {"status": "success", "message": f"Alarm {alarm_id} acknowledged"}
    raise HTTPException(status_code=404, detail="Alarm not found")


@app.get("/api/control/history")
def get_command_history(limit: int = 50):
    """Returns audit log of all manual operator cooling commands with Before/After impact."""
    return {
        "command_history": sim_engine.command_history[:limit],
        "total_commands": len(sim_engine.command_history)
    }


@app.post("/api/control/simulation")
def control_simulation(req: SimClockRequest):
    """Start, pause, resume, or change speed of the simulation clock."""
    action = req.action.upper()
    if action == "PAUSE":
        sim_engine.is_paused = True
    elif action == "RESUME":
        sim_engine.is_paused = False
    elif action == "STEP":
        sim_engine.is_paused = False
        sim_engine.tick()
        sim_engine.is_paused = True
    elif action == "SET_SPEED":
        sim_engine.speed_multiplier = max(0.1, min(10.0, req.speed))

    return {
        "status": "success",
        "clock": {
            "is_paused": sim_engine.is_paused,
            "speed_multiplier": sim_engine.speed_multiplier,
            "tick_count": sim_engine.tick_count,
        }
    }


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                cmd = json.loads(data)
                action = cmd.get("action")
                if action == "SET_SCENARIO":
                    sim_engine.set_scenario(cmd.get("scenario", "NORMAL"), {})
                elif action == "COOLING_COMMAND":
                    sim_engine.apply_cooling_command(
                        cdu_id=cmd.get("unit_id"),
                        mode=cmd.get("mode"),
                        power_state=cmd.get("power_state"),
                        fan_speed_percent=cmd.get("fan_speed_percent"),
                        setpoint_c=cmd.get("setpoint_c"),
                        force_override=cmd.get("force_override", False),
                    )
                elif action == "ACK_ALARM":
                    sim_engine.acknowledge_alarm(cmd.get("alarm_id"))
            except Exception as e:
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)

# Background telemetry broadcaster
async def stream_telemetry():
    while True:
        sim_engine.tick()

        if manager.active_connections:
            # Package combined telemetry with latest events and active alarms count
            payload = dict(sim_engine.telemetry)
            payload["recent_events"] = sim_engine.events_log[:5]
            payload["active_alarms"] = list(sim_engine.active_alarms.values())[:5]
            await manager.broadcast(json.dumps(payload))

        # Sleep interval adapts to speed multiplier
        sleep_time = max(0.1, 1.0 / max(0.1, sim_engine.speed_multiplier))
        await asyncio.sleep(sleep_time)

@app.on_event("startup")
async def startup_event():
    sim_engine.load_topology()
    asyncio.create_task(stream_telemetry())

