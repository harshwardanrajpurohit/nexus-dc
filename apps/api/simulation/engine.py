"""
NEXUS DC — Simulation Engine & Thermal Control Core
===================================================
Manages in-memory data center digital twin topology, closed-loop thermal
modeling, manual cooling overrides, safety interlocks, live event streaming,
and command audit logging.
"""
import time
import random
import math
from typing import Dict, List, Optional, Any
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine

DB_URL = "sqlite:///./digitaltwin.db"


class SimulationEngine:
    def __init__(self):
        self.engine = create_engine(DB_URL, connect_args={"check_same_thread": False})
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)

        # Simulation Clock & State
        self.is_paused = False
        self.speed_multiplier = 1.0
        self.tick_count = 0
        self.sim_start_time = time.time()
        self.last_tick_time = time.time()

        # Operational Scenarios
        self.state = {
            "scenario": "NORMAL",
            "grid_voltage_kv": 400.0,
            "diesel_gen_running": False,
            "cdu_pump_failed": False,
            "cdu_fault_row": 2,
            "active_ai_burst": False,
        }

        # Safety & Thermal Thresholds
        self.thresholds = {
            "temp_normal_max_c": 70.0,        # Normal operating upper bound
            "temp_warning_c": 75.0,           # Warning alarm threshold
            "temp_critical_c": 85.0,          # Critical alarm threshold
            "temp_emergency_protection_c": 95.0, # Automated safety interlock override
            "inlet_temp_normal_max_c": 27.0,  # ASHRAE A1 upper recommended
            "inlet_temp_critical_c": 35.0,
            "min_fan_speed_auto": 25.0,       # 25% minimum floor in AUTO mode
            "max_fan_speed": 100.0,
            "min_setpoint_c": 15.0,
            "max_setpoint_c": 30.0,
        }

        # In-Memory Topology
        self.topology: Dict[str, Any] = {
            "campus": None,
            "buildings": {},
            "halls": {},
            "rows": {},
            "racks": {},
            "cdus": {},
            "generators": {},
            "cooling_towers": {},
        }

        # Live Streams & History Buffers
        self.telemetry: Dict[str, Any] = {}
        self.events_log: List[Dict[str, Any]] = []      # Max 1000 events ring buffer
        self.active_alarms: Dict[str, Dict[str, Any]] = {}
        self.alarm_history: List[Dict[str, Any]] = []
        self.command_history: List[Dict[str, Any]] = [] # Audit log of manual commands
        self.event_counter = 0

    def load_topology(self):
        """Loads assets from SQLite database into high-performance in-memory model."""
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
                "health": 100.0,
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
                is_gpu = (a.type == "rack_gpu")
                node.update({
                    "power_kw": 120.0 if is_gpu else 15.0,
                    "temp_c": 42.0 if is_gpu else 28.0,
                    "inlet_temp_c": 21.5,
                    "exhaust_temp_c": 36.5 if is_gpu else 31.0,
                    "cpu_utilization": 72.0 if is_gpu else 45.0,
                    "gpu_utilization": 85.0 if is_gpu else 0.0,
                    "memory_utilization": 64.0,
                    "fan_speed_percent": 60.0,
                    "fan_rpm": 3200,
                    "airflow_cfm": 1450.0 if is_gpu else 950.0,
                    "humidity_rh": 48.5,
                    "cdu_id": f"{a.parent_id}-CDU",
                    "thermal_throttled": False,
                })
                self.topology["racks"][a.id] = node
            elif a.type == "cdu":
                # Initialize advanced cooling controller state
                node.update({
                    "operating_mode": "AUTO",       # "AUTO" or "MANUAL"
                    "power_state": "ON",             # "ON" or "OFF"
                    "fan_speed_percent": 60.0,       # 0.0 to 100.0 %
                    "fan_rpm": 2160,                 # 0 to 3600 RPM
                    "setpoint_c": 22.0,              # Target inlet/return fluid temp
                    "measured_temp_c": 22.2,
                    "airflow_cfm": 15000.0,          # Airflow delivered
                    "cooling_power_kw": 18.5,        # Parasitic electric power consumed
                    "cooling_capacity_kw": 180.0,    # Max heat extraction capacity
                    "last_updated": time.time(),
                    "connected_racks": [],
                    "emergency_override": False,
                    "override_reason": None,
                    "command_status": "NORMAL_AUTO",
                })
                self.topology["cdus"][a.id] = node
            elif a.type == "generator":
                self.topology["generators"][a.id] = node
            elif a.type == "cooling_tower":
                self.topology["cooling_towers"][a.id] = node

        # Link racks to their corresponding CDU
        for rack_id, rack in self.topology["racks"].items():
            cdu_id = rack.get("cdu_id")
            if cdu_id and cdu_id in self.topology["cdus"]:
                self.topology["cdus"][cdu_id]["connected_racks"].append(rack_id)

        db.close()
        print(f"Loaded {len(self.topology['racks'])} racks, {len(self.topology['cdus'])} CDUs into control engine.")

        # Log initial system boot event
        self._record_event(
            source="NEXUS-CORE-SIM",
            event_type="SYSTEM_BOOT",
            metric="topology_nodes",
            value=len(self.topology["racks"]),
            unit="nodes",
            severity="INFO",
            message=f"Topology loaded: {len(self.topology['racks'])} racks across {len(self.topology['cdus'])} CDUs. Control system ONLINE."
        )

    def set_scenario(self, scenario: str, params: dict):
        """Switches global scenario conditions."""
        self.state["scenario"] = scenario

        if scenario == "CDU_FAILURE":
            self.state["cdu_pump_failed"] = True
            self.state["cdu_fault_row"] = params.get("row", 2)
            row_id = f"CAMPUS-GIGA-01-BLD1-H1-ROW-GPU{self.state['cdu_fault_row']}"
            cdu_id = f"{row_id}-CDU"
            if cdu_id in self.topology["cdus"]:
                cdu = self.topology["cdus"][cdu_id]
                cdu["status"] = "CRITICAL"
                cdu["cooling_lpm"] = 0.0
                cdu["fan_speed_percent"] = 0.0
                cdu["fan_rpm"] = 0
                cdu["power_state"] = "OFF"
                cdu["command_status"] = "EQUIPMENT_FAULT"

                self._trigger_alarm(
                    source=cdu_id,
                    severity="CRITICAL",
                    title="CDU Pump Mechanical Failure",
                    message=f"Primary coolant pump on {cdu['name']} seized. Flow rate dropped to 0 LPM."
                )
        else:
            self.state["cdu_pump_failed"] = False
            for cdu in self.topology["cdus"].values():
                if cdu.get("operating_mode") == "AUTO":
                    cdu["status"] = "ONLINE"
                    cdu["power_state"] = "ON"

        if scenario == "GRID_LOSS":
            self.state["grid_voltage_kv"] = 0.0
            self.state["diesel_gen_running"] = True
            for g in self.topology["generators"].values():
                g["status"] = "ACTIVE"
            self._trigger_alarm(
                source="SUBSTATION-400KV",
                severity="CRITICAL",
                title="MSETCL 400kV Grid Curtailment",
                message="Utility feeder offline. Emergency diesel gensets and flywheel UPS online."
            )
        else:
            self.state["grid_voltage_kv"] = 400.0
            self.state["diesel_gen_running"] = False
            for g in self.topology["generators"].values():
                g["status"] = "STANDBY"

        if scenario == "PEAK_AI":
            self.state["active_ai_burst"] = True
            self._record_event(
                source="AI-CLUSTER-SCHEDULER",
                event_type="WORKLOAD_BURST",
                metric="workload_surge",
                value=100.0,
                unit="%",
                severity="WARNING",
                message="Large LLM training batch dispatched across GPU racks. Thermal load escalating."
            )
        else:
            self.state["active_ai_burst"] = False

    def tick(self):
        """Simulation tick cycle: updates thermal physics, controllers, alarms, and telemetry."""
        if self.is_paused:
            return

        self.tick_count += 1
        dt = 1.0 * self.speed_multiplier
        t_now = time.time()

        total_it_kw = 0.0
        total_cooling_kw = 0.0

        # -------------------------------------------------------------
        # 1. Closed-Loop Cooling Unit Controller (CDUs & CRACs)
        # -------------------------------------------------------------
        for cdu_id, cdu in self.topology["cdus"].items():
            connected_racks = [self.topology["racks"][r] for r in cdu.get("connected_racks", []) if r in self.topology["racks"]]

            # Compute average measured rack temp for this CDU's row
            if connected_racks:
                measured_temp = sum(r["temp_c"] for r in connected_racks) / len(connected_racks)
                max_rack_temp = max(r["temp_c"] for r in connected_racks)
            else:
                measured_temp = cdu.get("setpoint_c", 22.0)
                max_rack_temp = measured_temp

            cdu["measured_temp_c"] = round(measured_temp, 2)

            # --- Safety Interlock & Emergency Protection ---
            # If any connected rack breaches emergency limit, trigger override
            if max_rack_temp >= self.thresholds["temp_emergency_protection_c"]:
                if cdu["operating_mode"] == "MANUAL" or cdu["power_state"] == "OFF" or cdu["fan_speed_percent"] < 95.0:
                    cdu["emergency_override"] = True
                    cdu["operating_mode"] = "AUTO"
                    cdu["power_state"] = "ON"
                    cdu["fan_speed_percent"] = 100.0
                    cdu["fan_rpm"] = 3600
                    cdu["override_reason"] = (
                        f"CRITICAL SAFETY OVERRIDE: Rack temperature reached {max_rack_temp:.1f}°C "
                        f"(Emergency limit: {self.thresholds['temp_emergency_protection_c']}°C). "
                        f"Cooling forced to 100% to prevent thermal runaway."
                    )
                    cdu["command_status"] = "SAFETY_OVERRIDE_ACTIVE"

                    self._trigger_alarm(
                        source=cdu_id,
                        severity="CRITICAL",
                        title="Thermal Emergency Safety Interlock Engaged",
                        message=cdu["override_reason"]
                    )
                    self._record_event(
                        source=cdu_id,
                        event_type="SAFETY_INTERLOCK_ENGAGED",
                        metric="fan_speed_override",
                        value=100.0,
                        unit="%",
                        severity="CRITICAL",
                        message=cdu["override_reason"]
                    )

            # --- AUTO Mode Closed-Loop PID / Proportional Controller ---
            if cdu["operating_mode"] == "AUTO" and cdu["power_state"] == "ON" and cdu["status"] != "CRITICAL":
                error = measured_temp - cdu["setpoint_c"]
                # Slew target: 50% baseline + 4% per degC of error
                target_fan_speed = 50.0 + error * 4.5
                target_fan_speed = max(self.thresholds["min_fan_speed_auto"], min(100.0, target_fan_speed))

                # Smoothly ramp fan speed to avoid high-frequency mechanical hunting
                cdu["fan_speed_percent"] += (target_fan_speed - cdu["fan_speed_percent"]) * 0.12
                cdu["fan_speed_percent"] = round(cdu["fan_speed_percent"], 1)
                cdu["fan_rpm"] = int(cdu["fan_speed_percent"] * 36)
                cdu["airflow_cfm"] = round(cdu["fan_speed_percent"] * 250.0, 1)

            elif cdu["power_state"] == "OFF":
                cdu["fan_speed_percent"] = 0.0
                cdu["fan_rpm"] = 0
                cdu["airflow_cfm"] = 0.0

            # Power consumed by cooling fan/pumps according to Fan Affinity Law: P ~ (RPM)^3
            if cdu["power_state"] == "ON":
                fraction = cdu["fan_speed_percent"] / 100.0
                cdu["cooling_power_kw"] = round(4.0 + 36.0 * (fraction ** 3), 2)
            else:
                cdu["cooling_power_kw"] = 0.0

            total_cooling_kw += cdu["cooling_power_kw"]

        # -------------------------------------------------------------
        # 2. Physics & Thermal Update for Racks & Servers
        # -------------------------------------------------------------
        for rack in self.topology["racks"].values():
            if rack["status"] == "OFFLINE":
                continue

            is_gpu = (rack["type"] == "rack_gpu")

            # Workload dynamics
            if is_gpu:
                target_power = 125.0 if self.state["active_ai_burst"] else 65.0
                target_power += random.uniform(-2.5, 2.5)
                rack["power_kw"] += (target_power - rack["power_kw"]) * 0.2
                rack["gpu_utilization"] = round(min(100.0, (rack["power_kw"] / 132.0) * 100.0), 1)
                rack["cpu_utilization"] = round(min(100.0, rack["gpu_utilization"] * 0.85 + random.uniform(-2, 2)), 1)
            else:
                target_power = 14.0
                target_power += random.uniform(-0.6, 0.6)
                rack["power_kw"] += (target_power - rack["power_kw"]) * 0.2
                rack["cpu_utilization"] = round(min(100.0, (rack["power_kw"] / 15.0) * 100.0), 1)
                rack["gpu_utilization"] = 0.0

            total_it_kw += rack["power_kw"]

            # Lookup controlling CDU
            cdu_id = rack.get("cdu_id")
            cdu = self.topology["cdus"].get(cdu_id)

            if cdu and cdu["power_state"] == "ON" and cdu["status"] != "CRITICAL":
                cooling_fraction = cdu["fan_speed_percent"] / 100.0
                setpoint = cdu["setpoint_c"]
            else:
                cooling_fraction = 0.05  # Natural convection only when cooling is shut off
                setpoint = 30.0

            # Thermal Equilibrium target
            # Higher cooling fraction pulls rack temperature down closer to setpoint
            if is_gpu:
                # NVL72 132kW direct liquid cooling model
                heat_rise = (rack["power_kw"] / 132.0) * (40.0 / max(0.1, cooling_fraction))
                target_temp = setpoint + heat_rise
            else:
                heat_rise = (rack["power_kw"] / 15.0) * (20.0 / max(0.1, cooling_fraction))
                target_temp = setpoint + heat_rise

            # First-order thermal decay (dT = dt * (P_heat - Q_cooling) / C_thermal)
            thermal_time_constant = 0.12 if cooling_fraction > 0.3 else 0.06
            rack["temp_c"] += (target_temp - rack["temp_c"]) * thermal_time_constant
            rack["temp_c"] = round(rack["temp_c"], 2)

            # Airflow & temperatures
            rack["inlet_temp_c"] = round(setpoint + (cooling_fraction < 0.3 and 6.0 or 0.5), 1)
            rack["exhaust_temp_c"] = round(rack["inlet_temp_c"] + (rack["power_kw"] / (is_gpu and 6.5 or 1.8)), 1)
            rack["airflow_cfm"] = round(cooling_fraction * (is_gpu and 2200.0 or 1200.0), 1)
            rack["fan_speed_percent"] = round(cooling_fraction * 100.0, 1)
            rack["fan_rpm"] = int(cooling_fraction * 5000)

            # Thermal Status & Throttling
            if rack["temp_c"] >= self.thresholds["temp_critical_c"]:
                rack["status"] = "CRITICAL"
                if rack["temp_c"] >= self.thresholds["temp_emergency_protection_c"]:
                    rack["thermal_throttled"] = True
                    rack["power_kw"] *= 0.5  # Throttling limits damage
            elif rack["temp_c"] >= self.thresholds["temp_warning_c"]:
                rack["status"] = "WARNING"
                rack["thermal_throttled"] = False
            else:
                rack["status"] = "ONLINE"
                rack["thermal_throttled"] = False

        # -------------------------------------------------------------
        # 3. Aggregations & Global KPIs
        # -------------------------------------------------------------
        it_load_mw = total_it_kw / 1000.0
        cooling_mw = total_cooling_kw / 1000.0
        # PUE = (IT + Cooling + Overhead) / IT
        pue = round(1.0 + (cooling_mw + it_load_mw * 0.05) / max(0.1, it_load_mw), 3)
        facility_mw = round(it_load_mw * pue, 1)

        # Average GPU die temperature
        gpu_racks = [r for r in self.topology["racks"].values() if r["type"] == "rack_gpu"]
        avg_gpu_temp = (sum(r["temp_c"] for r in gpu_racks) / len(gpu_racks)) if gpu_racks else 45.0

        # Count active alarms
        alarm_counts = {
            "critical": sum(1 for a in self.active_alarms.values() if a["severity"] == "CRITICAL"),
            "warning": sum(1 for a in self.active_alarms.values() if a["severity"] == "WARNING"),
            "info": sum(1 for a in self.active_alarms.values() if a["severity"] == "INFO"),
        }

        self.telemetry = {
            "type": "TELEMETRY",
            "timestamp": t_now,
            "scenario": self.state["scenario"],
            "simulation_clock": {
                "tick_count": self.tick_count,
                "is_paused": self.is_paused,
                "speed_multiplier": self.speed_multiplier,
            },
            "global": {
                "total_servers": 1000000,
                "total_racks": len(self.topology["racks"]),
                "power_it_kw": round(total_it_kw, 1),
                "power_it_mw": round(it_load_mw, 1),
                "power_cooling_kw": round(total_cooling_kw, 1),
                "power_cooling_mw": round(cooling_mw, 2),
                "power_facility_kw": round(facility_mw * 1000.0, 1),
                "power_facility_mw": round(facility_mw, 1),
                "grid_capacity_mw": 1150.0,
                "pue": pue,
                "coolant_flow_lpm": 527000 if not self.state["cdu_pump_failed"] else 400000,
                "temp_cold_aisle_c": 21.5,
                "temp_hot_aisle_c": 35.0,
                "temp_gpu_avg_c": round(avg_gpu_temp, 1),
                "temp_cooling_water_supply_c": 20.0,
                "temp_cooling_water_return_c": 35.0 if not self.state["cdu_pump_failed"] else 55.0,
                "network_throughput_tbps": 200.0 if self.state["active_ai_burst"] else 150.0,
                "grid_voltage_kv": self.state["grid_voltage_kv"],
                "flywheel_rpm": 12000 if not self.state["diesel_gen_running"] else 9500,
                "diesel_gen_status": "ACTIVE (1500 RPM)" if self.state["diesel_gen_running"] else "STANDBY (READY)",
                "cdu_status": "CRITICAL ALARM" if self.state["cdu_pump_failed"] else "OPTIMAL (N+1)",
                "cdu_fault_row": self.state["cdu_fault_row"] if self.state["cdu_pump_failed"] else None,
                "sla_uptime_percent": 99.999,
                "alarm_counts": alarm_counts,
            }
        }

        # Sample occasional telemetry events for the live inspector
        self._sample_periodic_events(avg_gpu_temp, total_it_kw, total_cooling_kw)

    def _sample_periodic_events(self, avg_gpu_temp: float, it_kw: float, cool_kw: float):
        """Generates realistic structured telemetry events for the incoming inspector."""
        # Pick 2-3 sample racks and CDUs each tick
        sample_racks = random.sample(list(self.topology["racks"].values()), min(2, len(self.topology["racks"])))
        for r in sample_racks:
            sev = "CRITICAL" if r["temp_c"] >= 85.0 else ("WARNING" if r["temp_c"] >= 75.0 else "INFO")
            self._record_event(
                source=r["id"],
                event_type="TEMPERATURE_UPDATE",
                metric="temp_c",
                value=r["temp_c"],
                unit="°C",
                severity=sev,
                message=f"Rack sensor report: Core {r['temp_c']}°C, Inlet {r['inlet_temp_c']}°C, Exhaust {r['exhaust_temp_c']}°C (Load: {r['gpu_utilization']}%)"
            )

        # Pick a sample CDU
        if self.topology["cdus"]:
            cdu = random.choice(list(self.topology["cdus"].values()))
            self._record_event(
                source=cdu["id"],
                event_type="COOLING_TELEMETRY",
                metric="cooling_power_kw",
                value=cdu["cooling_power_kw"],
                unit="kW",
                severity="INFO" if cdu["status"] == "ONLINE" else "WARNING",
                message=f"CDU status: Mode {cdu['operating_mode']}, Fan {cdu['fan_speed_percent']}%, {cdu['fan_rpm']} RPM, Return {cdu['measured_temp_c']}°C"
            )

    def _record_event(self, source: str, event_type: str, metric: str, value: Any,
                      unit: str, severity: str, message: str):
        """Appends an event to the circular event log buffer."""
        self.event_counter += 1
        event = {
            "event_id": f"evt-{self.event_counter}",
            "timestamp": time.strftime("%H:%M:%S", time.localtime()),
            "source": source,
            "event_type": event_type,
            "metric": metric,
            "value": round(value, 2) if isinstance(value, float) else value,
            "unit": unit,
            "severity": severity,
            "message": message,
            "processing_status": "PROCESSED",
        }
        self.events_log.insert(0, event)
        if len(self.events_log) > 1000:
            self.events_log.pop()

    def _trigger_alarm(self, source: str, severity: str, title: str, message: str):
        """Triggers or updates an active operational alarm."""
        alarm_id = f"ALM-{source}-{severity}"
        alarm = {
            "alarm_id": alarm_id,
            "timestamp": time.strftime("%H:%M:%S", time.localtime()),
            "source": source,
            "severity": severity,
            "title": title,
            "message": message,
            "acknowledged": False,
            "cleared": False,
        }
        self.active_alarms[alarm_id] = alarm
        self.alarm_history.insert(0, dict(alarm))
        if len(self.alarm_history) > 500:
            self.alarm_history.pop()

    def acknowledge_alarm(self, alarm_id: str) -> bool:
        """Acknowledge an active alarm."""
        if alarm_id in self.active_alarms:
            self.active_alarms[alarm_id]["acknowledged"] = True
            return True
        return False

    def clear_alarm(self, alarm_id: str) -> bool:
        """Clear an active alarm."""
        if alarm_id in self.active_alarms:
            del self.active_alarms[alarm_id]
            return True
        return False

    def apply_cooling_command(
        self,
        cdu_id: str,
        mode: Optional[str] = None,
        power_state: Optional[str] = None,
        fan_speed_percent: Optional[float] = None,
        setpoint_c: Optional[float] = None,
        operator: str = "Control Room Operator",
        force_override: bool = False,
    ) -> Dict[str, Any]:
        """
        Applies a validated manual command to a specific cooling unit,
        capturing before and after impact metrics and verifying safety interlocks.
        """
        if cdu_id not in self.topology["cdus"]:
            return {
                "success": False,
                "status": "REJECTED",
                "reason": f"Cooling unit '{cdu_id}' not found in topology."
            }

        cdu = self.topology["cdus"][cdu_id]

        # Validation
        if fan_speed_percent is not None:
            if fan_speed_percent < 0.0 or fan_speed_percent > 100.0:
                return {
                    "success": False,
                    "status": "REJECTED",
                    "reason": f"Fan speed {fan_speed_percent}% is out of valid range [0.0%, 100.0%]."
                }

        if setpoint_c is not None:
            if setpoint_c < self.thresholds["min_setpoint_c"] or setpoint_c > self.thresholds["max_setpoint_c"]:
                return {
                    "success": False,
                    "status": "REJECTED",
                    "reason": f"Temperature setpoint {setpoint_c}°C is outside safety limits [{self.thresholds['min_setpoint_c']}°C, {self.thresholds['max_setpoint_c']}°C]."
                }

        # Snapshot BEFORE state
        before_snapshot = {
            "fan_speed_percent": cdu["fan_speed_percent"],
            "fan_rpm": cdu["fan_rpm"],
            "cooling_power_kw": cdu["cooling_power_kw"],
            "measured_temp_c": cdu["measured_temp_c"],
            "operating_mode": cdu["operating_mode"],
            "power_state": cdu["power_state"],
            "setpoint_c": cdu["setpoint_c"],
            "total_facility_kw": self.telemetry.get("global", {}).get("power_facility_kw", 80000.0),
            "pue": self.telemetry.get("global", {}).get("pue", 1.118),
        }

        # Safety Interlock Warnings & Checks
        connected_racks = [self.topology["racks"][r] for r in cdu.get("connected_racks", []) if r in self.topology["racks"]]
        max_rack_temp = max((r["temp_c"] for r in connected_racks), default=25.0)

        # Safety rule: Prevent turning OFF cooling if racks are already hot without explicit force
        if power_state == "OFF" and max_rack_temp >= self.thresholds["temp_normal_max_c"] and not force_override:
            return {
                "success": False,
                "status": "CONFIRMATION_REQUIRED",
                "reason": (
                    f"SAFETY INTERLOCK: Racks on {cdu_id} are currently operating at {max_rack_temp:.1f}°C. "
                    f"Shutting down cooling will trigger thermal runaway within 30-45 seconds. "
                    f"Explicit operator confirmation required."
                )
            }

        # Apply changes
        if mode:
            cdu["operating_mode"] = mode.upper()
        if power_state:
            cdu["power_state"] = power_state.upper()
        if fan_speed_percent is not None:
            cdu["fan_speed_percent"] = round(fan_speed_percent, 1)
            cdu["fan_rpm"] = int(cdu["fan_speed_percent"] * 36)
            cdu["airflow_cfm"] = round(cdu["fan_speed_percent"] * 250.0, 1)
        if setpoint_c is not None:
            cdu["setpoint_c"] = round(setpoint_c, 1)

        cdu["last_updated"] = time.time()
        cdu["emergency_override"] = False
        cdu["override_reason"] = None
        cdu["command_status"] = f"MANUAL_SET_{cdu['fan_speed_percent']}PCT" if cdu["operating_mode"] == "MANUAL" else "NORMAL_AUTO"

        # Calculate AFTER projected impact
        new_cooling_fraction = cdu["fan_speed_percent"] / 100.0 if cdu["power_state"] == "ON" else 0.05
        new_cooling_kw = round(4.0 + 36.0 * (new_cooling_fraction ** 3), 2) if cdu["power_state"] == "ON" else 0.0
        power_delta_kw = new_cooling_kw - before_snapshot["cooling_power_kw"]

        # Estimated temperature shift over 5 minutes (300 ticks)
        temp_delta_c = (0.60 - new_cooling_fraction) * 12.0
        projected_temp_c = round(max(18.0, min(100.0, cdu["measured_temp_c"] + temp_delta_c)), 1)
        projected_facility_kw = before_snapshot["total_facility_kw"] + power_delta_kw
        projected_pue = round(projected_facility_kw / max(1.0, self.telemetry.get("global", {}).get("power_it_kw", 65000.0)), 3)

        after_snapshot = {
            "fan_speed_percent": cdu["fan_speed_percent"],
            "fan_rpm": cdu["fan_rpm"],
            "cooling_power_kw": new_cooling_kw,
            "projected_temp_c": projected_temp_c,
            "operating_mode": cdu["operating_mode"],
            "power_state": cdu["power_state"],
            "setpoint_c": cdu["setpoint_c"],
            "projected_facility_kw": projected_facility_kw,
            "projected_pue": projected_pue,
            "cooling_power_delta_kw": round(power_delta_kw, 2),
            "estimated_hourly_energy_delta_kwh": round(power_delta_kw * 1.0, 2), # kW * 1 hr
        }

        # Log to audit history
        command_log = {
            "command_id": f"CMD-{int(time.time()*1000)}",
            "timestamp": time.strftime("%H:%M:%S", time.localtime()),
            "operator": operator,
            "cdu_id": cdu_id,
            "action": f"SET mode={cdu['operating_mode']}, pwr={cdu['power_state']}, fan={cdu['fan_speed_percent']}%, sp={cdu['setpoint_c']}°C",
            "status": "APPLIED",
            "before": before_snapshot,
            "after": after_snapshot,
        }
        self.command_history.insert(0, command_log)
        if len(self.command_history) > 200:
            self.command_history.pop()

        # Log telemetry event
        self._record_event(
            source=cdu_id,
            event_type="MANUAL_COMMAND_APPLIED",
            metric="fan_speed_override",
            value=cdu["fan_speed_percent"],
            unit="%",
            severity="WARNING" if cdu["operating_mode"] == "MANUAL" else "INFO",
            message=f"Operator '{operator}' set {cdu_id} to {cdu['fan_speed_percent']}% fan speed (Power delta: {power_delta_kw:+.1f} kW)"
        )

        return {
            "success": True,
            "status": "APPLIED",
            "cdu": cdu,
            "before": before_snapshot,
            "after": after_snapshot,
            "message": f"Successfully applied control settings to {cdu_id}."
        }

    def reset_cdu_auto(self, cdu_id: str, operator: str = "Operator") -> Dict[str, Any]:
        """Resets cooling unit to AUTO closed-loop control."""
        return self.apply_cooling_command(
            cdu_id=cdu_id,
            mode="AUTO",
            power_state="ON",
            setpoint_c=22.0,
            operator=operator,
        )

    def get_cooling_units(self) -> List[Dict[str, Any]]:
        """Returns summary list of all cooling units."""
        return list(self.topology["cdus"].values())

    def get_cooling_unit_detail(self, cdu_id: str) -> Optional[Dict[str, Any]]:
        """Returns complete state for a single CDU including connected rack telemetry."""
        if cdu_id not in self.topology["cdus"]:
            return None
        cdu = dict(self.topology["cdus"][cdu_id])
        connected_racks = [
            self.topology["racks"][r] for r in cdu.get("connected_racks", [])
            if r in self.topology["racks"]
        ]
        cdu["racks_detail"] = connected_racks
        return cdu

    def get_asset(self, asset_id: str):
        """Search all collections for specified asset."""
        for coll in [
            self.topology["racks"], self.topology["cdus"], self.topology["rows"],
            self.topology["halls"], self.topology["buildings"], self.topology["generators"],
            self.topology["cooling_towers"]
        ]:
            if asset_id in coll:
                return coll[asset_id]
        if self.topology["campus"] and asset_id == self.topology["campus"]["id"]:
            return self.topology["campus"]
        return None


sim_engine = SimulationEngine()
