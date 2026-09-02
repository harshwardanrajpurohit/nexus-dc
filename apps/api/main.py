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

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Handle incoming control commands
            try:
                cmd = json.loads(data)
                if cmd.get("action") == "SET_SCENARIO":
                    sim_engine.set_scenario(cmd.get("scenario", "NORMAL"), {})
            except Exception:
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
            await manager.broadcast(json.dumps(sim_engine.telemetry))
            
        await asyncio.sleep(1.0)

@app.on_event("startup")
async def startup_event():
    sim_engine.load_topology()
    asyncio.create_task(stream_telemetry())
