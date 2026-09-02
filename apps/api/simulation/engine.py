import time
import random
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
import json

DB_URL = "sqlite:///./digitaltwin.db"

class SimulationEngine:
    def __init__(self):
        self.engine = create_engine(DB_URL, connect_args={"check_same_thread": False})
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        
        self.state = {
            "scenario": "NORMAL",
            "grid_voltage_kv": 400.0,
            "diesel_gen_running": False,
            "cdu_pump_failed": False,
            "cdu_fault_row": 2,
            "active_ai_burst": False,
        }
        
        self.topology = {
            "campus": None,
            "buildings": {},
            "halls": {},
            "rows": {},
            "racks": {},
            "cdus": {},
            "generators": {},
            "cooling_towers": {},
        }
        
        self.telemetry = {}
        
    def load_topology(self):
        print("Loading topology into in-memory simulation engine...")
        db = self.SessionLocal()
        from models import Asset
        
        assets = db.query(Asset).all()
        for a in assets:
            node = {
                "id": a.id,
                "type": a.type,
                "name": a.name,
                "parent_id": a.parent_id,
                "status": "ONLINE",
                "power_kw": 0.0,
                "temp_c": 22.0,
                "cooling_lpm": 0.0,
                "health": 100.0
            }
            
            if a.type == "campus":
                self.topology["campus"] = node
            elif a.type == "building":
                self.topology["buildings"][a.id] = node
            elif a.type == "hall":
                self.topology["halls"][a.id] = node
            elif a.type in ["row_gpu", "row_cpu"]:
                self.topology["rows"][a.id] = node
            elif a.type in ["rack_gpu", "rack_cpu"]:
                if a.type == "rack_gpu":
                    node["power_kw"] = 132.0 # Base NVL72 max is 132kW, idle is ~30kW
                    node["temp_c"] = 35.0
                else:
                    node["power_kw"] = 15.0
                    node["temp_c"] = 25.0
                self.topology["racks"][a.id] = node
            elif a.type == "cdu":
                self.topology["cdus"][a.id] = node
            elif a.type == "generator":
                self.topology["generators"][a.id] = node
            elif a.type == "cooling_tower":
                self.topology["cooling_towers"][a.id] = node

        db.close()
        print(f"Loaded {len(self.topology['racks'])} racks, {len(self.topology['cdus'])} CDUs.")

    def set_scenario(self, scenario: str, params: dict):
        self.state["scenario"] = scenario
        
        if scenario == "CDU_FAILURE":
            self.state["cdu_pump_failed"] = True
            self.state["cdu_fault_row"] = params.get("row", 2)
            # Find the CDU for this row and set to CRITICAL
            row_id = f"CAMPUS-GIGA-01-BLD1-H1-ROW-GPU{self.state['cdu_fault_row']}"
            cdu_id = f"{row_id}-CDU"
            if cdu_id in self.topology["cdus"]:
                self.topology["cdus"][cdu_id]["status"] = "CRITICAL"
                self.topology["cdus"][cdu_id]["cooling_lpm"] = 0.0
        else:
            self.state["cdu_pump_failed"] = False
            for cdu in self.topology["cdus"].values():
                cdu["status"] = "ONLINE"
                
        if scenario == "GRID_LOSS":
            self.state["grid_voltage_kv"] = 0.0
            self.state["diesel_gen_running"] = True
            for g in self.topology["generators"].values():
                g["status"] = "ACTIVE"
        else:
            self.state["grid_voltage_kv"] = 400.0
            self.state["diesel_gen_running"] = False
            for g in self.topology["generators"].values():
                g["status"] = "STANDBY"
                
        if scenario == "PEAK_AI":
            self.state["active_ai_burst"] = True
        else:
            self.state["active_ai_burst"] = False

    def tick(self):
        # 1. Physics update for Racks
        total_it_kw = 0.0
        
        for rack in self.topology["racks"].values():
            if rack["status"] == "OFFLINE":
                continue
                
            is_gpu = (rack["type"] == "rack_gpu")
            
            # Compute load simulation
            if is_gpu:
                target_power = 120.0 if self.state["active_ai_burst"] else 60.0
                # Fluctuate
                target_power += random.uniform(-2.0, 2.0)
                rack["power_kw"] += (target_power - rack["power_kw"]) * 0.2
            else:
                target_power = 12.0
                target_power += random.uniform(-0.5, 0.5)
                rack["power_kw"] += (target_power - rack["power_kw"]) * 0.2
                
            total_it_kw += rack["power_kw"]
            
            # Thermal Model
            row_id = rack["parent_id"]
            
            # If CDU has failed on this row, temperatures spike for GPU racks
            cooling_efficiency = 1.0
            if is_gpu and self.state["cdu_pump_failed"]:
                cdu_id = f"{row_id}-CDU"
                if cdu_id in self.topology["cdus"] and self.topology["cdus"][cdu_id]["status"] == "CRITICAL":
                    cooling_efficiency = 0.0
            
            if cooling_efficiency < 0.5:
                # Temperature rises based on power
                temp_rise_rate = (rack["power_kw"] / 132.0) * 1.5 # 1.5 deg per tick at max power
                rack["temp_c"] += temp_rise_rate
                if rack["temp_c"] > 95.0:
                    rack["status"] = "WARNING"
                if rack["temp_c"] > 105.0:
                    rack["status"] = "CRITICAL"
                    rack["power_kw"] *= 0.1 # Thermal throttling
            else:
                target_temp = 35.0 + (rack["power_kw"] / 132.0) * 15.0 if is_gpu else 25.0 + (rack["power_kw"] / 15.0) * 10.0
                rack["temp_c"] += (target_temp - rack["temp_c"]) * 0.1
                rack["status"] = "ONLINE"
                
        # 2. Aggregations
        it_load_mw = total_it_kw / 1000.0
        pue = 1.118 if not self.state["cdu_pump_failed"] else 1.25
        if self.state["active_ai_burst"]: pue += 0.05
        if self.state["diesel_gen_running"]: pue += 0.15
        
        facility_mw = it_load_mw * pue
        
        self.telemetry = {
            "type": "TELEMETRY",
            "timestamp": time.time(),
            "scenario": self.state["scenario"],
            "global": {
                "total_servers": 1000000,
                "total_racks": len(self.topology["racks"]),
                "power_it_mw": round(it_load_mw, 1),
                "power_facility_mw": round(facility_mw, 1),
                "grid_capacity_mw": 1150.0,
                "pue": round(pue, 3),
                "coolant_flow_lpm": 527000 if not self.state["cdu_pump_failed"] else 400000,
                "temp_cold_aisle_c": 21.5,
                "temp_hot_aisle_c": 35.0,
                "temp_gpu_avg_c": 52.0 if not self.state["cdu_pump_failed"] else 85.0,
                "temp_cooling_water_supply_c": 20.0,
                "temp_cooling_water_return_c": 35.0 if not self.state["cdu_pump_failed"] else 55.0,
                "network_throughput_tbps": 200.0 if self.state["active_ai_burst"] else 150.0,
                "grid_voltage_kv": self.state["grid_voltage_kv"],
                "flywheel_rpm": 12000 if not self.state["diesel_gen_running"] else 9500,
                "diesel_gen_status": "ACTIVE (1500 RPM)" if self.state["diesel_gen_running"] else "STANDBY (READY)",
                "cdu_status": "CRITICAL ALARM" if self.state["cdu_pump_failed"] else "OPTIMAL (N+1)",
                "cdu_fault_row": self.state["cdu_fault_row"] if self.state["cdu_pump_failed"] else None,
                "sla_uptime_percent": 99.999
            }
        }
        
    def get_asset(self, asset_id: str):
        # Search all collections
        for coll in [self.topology["racks"], self.topology["cdus"], self.topology["rows"], 
                     self.topology["halls"], self.topology["buildings"], self.topology["generators"],
                     self.topology["cooling_towers"]]:
            if asset_id in coll:
                return coll[asset_id]
        if asset_id == self.topology["campus"]["id"]:
            return self.topology["campus"]
        return None

sim_engine = SimulationEngine()
