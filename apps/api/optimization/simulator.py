"""
REGEN-DC Simulation Runner
============================
Forward simulation of the data center over a horizon.
Used by all strategies to produce comparable results.
"""
import copy
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from optimization.config import FacilityConfig, ScenarioInputs, ConstraintLimits
from optimization import equations


@dataclass
class TimeStepResult:
    """Results for a single simulation time step."""
    step: int = 0
    hour: float = 0.0

    # Decisions (controls)
    gpu_load_fraction: float = 0.0
    cpu_load_fraction: float = 0.0
    cooling_setpoint_offset: float = 0.0  # Offset from baseline cooling
    battery_charge_kw: float = 0.0
    battery_discharge_kw: float = 0.0
    renewable_used_kw: float = 0.0

    # Computed outputs
    it_power_kw: float = 0.0
    cooling_thermal_kw: float = 0.0
    cooling_electric_kw: float = 0.0
    facility_power_kw: float = 0.0
    grid_energy_kwh: float = 0.0
    pue: float = 1.0
    cop: float = 5.5
    temperature_c: float = 22.0
    water_litres: float = 0.0
    carbon_kg: float = 0.0
    cost_usd: float = 0.0
    battery_soc_kwh: float = 80000.0
    risk_score: float = 0.0
    useful_compute: float = 1.0
    switching_penalty: float = 0.0
    objective_score: float = 0.0

    # Inputs (recorded for comparison)
    workload_demand: float = 0.0
    mandatory_demand: float = 0.0
    ambient_temp_c: float = 30.0
    carbon_intensity: float = 0.45
    electricity_price: float = 0.08
    renewable_available_kw: float = 0.0

    # Constraint status
    temp_violation: bool = False
    power_violation: bool = False
    workload_violation: bool = False
    battery_violation: bool = False


@dataclass
class SimulationResult:
    """Complete simulation results for a strategy run."""
    strategy_name: str = ""
    strategy_type: str = ""  # "baseline", "heuristic", "optimizer"
    steps: List[TimeStepResult] = field(default_factory=list)
    runtime_seconds: float = 0.0
    solver_status: str = "N/A"
    is_feasible: bool = True
    infeasibility_reason: str = ""

    # Aggregated metrics
    total_energy_kwh: float = 0.0
    total_water_litres: float = 0.0
    total_carbon_kg: float = 0.0
    total_cost_usd: float = 0.0
    total_objective_score: float = 0.0
    peak_temperature_c: float = 0.0
    avg_useful_compute: float = 0.0
    mandatory_work_completed: float = 0.0
    deadline_violations: int = 0
    total_battery_discharged_kwh: float = 0.0
    total_battery_charged_kwh: float = 0.0
    safety_passed: bool = True
    constraint_violations: List[Dict[str, Any]] = field(default_factory=list)

    def aggregate(self):
        """Compute aggregate metrics from step results."""
        if not self.steps:
            return

        self.total_energy_kwh = sum(s.grid_energy_kwh for s in self.steps)
        self.total_water_litres = sum(s.water_litres for s in self.steps)
        self.total_carbon_kg = sum(s.carbon_kg for s in self.steps)
        self.total_cost_usd = sum(s.cost_usd for s in self.steps)
        self.total_objective_score = sum(s.objective_score for s in self.steps)
        self.peak_temperature_c = max(s.temperature_c for s in self.steps)
        total_demand = sum(s.workload_demand for s in self.steps)
        total_useful = sum(s.useful_compute * s.workload_demand for s in self.steps)
        self.avg_useful_compute = min(1.0, total_useful / max(total_demand, 1e-9))
        self.total_battery_discharged_kwh = sum(
            s.battery_discharge_kw * 1.0 for s in self.steps  # dt=1hr
        )
        self.total_battery_charged_kwh = sum(
            s.battery_charge_kw * 1.0 for s in self.steps
        )

        # Check mandatory work
        total_mandatory = sum(s.mandatory_demand for s in self.steps)
        total_served = sum(
            min(s.gpu_load_fraction + s.cpu_load_fraction,
                s.workload_demand) * s.workload_demand
            for s in self.steps
        )
        # Simpler: use useful_compute which already accounts for this
        mandatory_steps_met = sum(
            1 for s in self.steps
            if s.useful_compute >= s.mandatory_demand / max(s.workload_demand, 1e-9) - 0.001
        )
        self.mandatory_work_completed = mandatory_steps_met / max(len(self.steps), 1)

        # Deadline violations
        self.deadline_violations = sum(1 for s in self.steps if s.workload_violation)

        # Safety check
        self.safety_passed = all(
            not s.temp_violation and not s.power_violation
            and not s.battery_violation
            for s in self.steps
        )
        self.is_feasible = self.safety_passed and self.deadline_violations == 0

        # Collect violations
        self.constraint_violations = []
        for s in self.steps:
            if s.temp_violation:
                self.constraint_violations.append({
                    "step": s.step,
                    "constraint": "Temperature",
                    "value": s.temperature_c,
                    "limit": 35.0,
                    "type": "hard"
                })
            if s.power_violation:
                self.constraint_violations.append({
                    "step": s.step,
                    "constraint": "Facility Power",
                    "value": s.facility_power_kw,
                    "limit": 1150000.0,
                    "type": "hard"
                })


def run_simulation(
    facility: FacilityConfig,
    scenario: ScenarioInputs,
    constraints: ConstraintLimits,
    weights: 'ObjectiveWeights',
    norm: 'NormalizationRefs',
    decisions: Optional[List[Dict[str, float]]] = None,
) -> SimulationResult:
    """
    Run forward simulation with given decisions.

    If decisions is None, uses the workload demand directly (baseline).

    Each decision dict can contain:
        gpu_load_fraction, cpu_load_fraction,
        cooling_setpoint_offset, battery_charge_kw, battery_discharge_kw

    Returns:
        SimulationResult with all step-by-step metrics
    """
    result = SimulationResult()
    dt = scenario.dt_hours

    # Initial state
    temp_c = facility.temp_setpoint_c
    battery_soc = facility.battery_initial_soc_kwh
    prev_workload = 0.0
    backlog_pool = 0.0

    for t in range(scenario.num_steps):
        step = TimeStepResult()
        step.step = t
        step.hour = t * dt

        # Record inputs
        step.workload_demand = scenario.workload_demand[t]
        step.mandatory_demand = step.workload_demand * scenario.mandatory_fraction[t]
        step.ambient_temp_c = scenario.ambient_temp_c[t]
        step.carbon_intensity = scenario.carbon_intensity_kg_per_kwh[t]
        step.electricity_price = scenario.electricity_price_usd_per_kwh[t]
        step.renewable_available_kw = scenario.renewable_kw[t]

        # Get decisions
        if decisions and t < len(decisions):
            d = decisions[t]
            # GPU and CPU load fractions determine how much work is done
            # The total workload capacity is normalized so that
            # demand=1.0 means using total IT capacity
            gpu_cap_fraction = (facility.num_gpu_racks * facility.gpu_rack_max_kw) / facility.total_it_capacity_kw
            cpu_cap_fraction = (facility.num_cpu_racks * facility.cpu_rack_max_kw) / facility.total_it_capacity_kw

            step.gpu_load_fraction = d.get('gpu_load_fraction', step.workload_demand)
            step.cpu_load_fraction = d.get('cpu_load_fraction', step.workload_demand)
            step.cooling_setpoint_offset = d.get('cooling_setpoint_offset', 0.0)
            step.battery_charge_kw = d.get('battery_charge_kw', 0.0)
            step.battery_discharge_kw = d.get('battery_discharge_kw', 0.0)
        else:
            # Baseline: run at demanded workload
            step.gpu_load_fraction = step.workload_demand
            step.cpu_load_fraction = step.workload_demand
            step.cooling_setpoint_offset = 0.0
            step.battery_charge_kw = 0.0
            step.battery_discharge_kw = 0.0

        # --- Compute physics ---

        # 1. IT Power
        step.it_power_kw = equations.compute_it_power_kw(
            step.gpu_load_fraction, step.cpu_load_fraction, facility
        )

        # 2. Cooling
        step.cooling_thermal_kw = equations.compute_cooling_thermal_load_kw(
            step.it_power_kw, facility
        )
        step.cop = equations.compute_cop(step.ambient_temp_c, facility)
        step.cooling_electric_kw = equations.compute_cooling_electric_kw(
            step.cooling_thermal_kw, step.cop
        )

        # 3. Renewable usage (capped at available)
        step.renewable_used_kw = min(
            step.renewable_available_kw,
            step.it_power_kw + step.cooling_electric_kw
        )

        # 4. Facility power
        other_kw = step.it_power_kw * facility.overhead_fraction
        step.facility_power_kw = equations.compute_facility_power_kw(
            step.it_power_kw,
            step.cooling_electric_kw,
            other_kw,
            step.battery_charge_kw,
            step.battery_discharge_kw,
            step.renewable_used_kw,
        )

        # 5. Grid energy
        step.grid_energy_kwh = equations.compute_grid_energy_kwh(
            step.facility_power_kw, dt
        )

        # 6. PUE
        step.pue = equations.compute_pue(step.it_power_kw, step.facility_power_kw)

        # 7. Thermal dynamics
        heat_load = step.it_power_kw * (1.0 + facility.overhead_fraction)
        temp_c = equations.compute_thermal_dynamics(
            temp_c, heat_load, step.cooling_thermal_kw, dt,
            facility.thermal_capacity_kwh_per_c
        )
        step.temperature_c = temp_c

        # 8. Water
        step.water_litres = equations.compute_water_litres(
            step.cooling_thermal_kw, dt, step.ambient_temp_c, facility
        )

        # 9. Carbon
        step.carbon_kg = equations.compute_carbon_kg(
            step.grid_energy_kwh, step.carbon_intensity
        )

        # 10. Cost
        step.cost_usd = equations.compute_cost_usd(
            step.grid_energy_kwh, step.electricity_price
        )

        # 11. Battery
        if facility.battery_enabled:
            battery_soc = equations.compute_battery_soc(
                battery_soc,
                step.battery_charge_kw,
                step.battery_discharge_kw,
                dt,
                facility.battery_efficiency_charge,
                facility.battery_efficiency_discharge,
            )
            step.battery_soc_kwh = battery_soc

            # Battery constraint check
            if battery_soc < constraints.min_battery_soc_kwh - 0.1:
                step.battery_violation = True
            if battery_soc > constraints.max_battery_soc_kwh + 0.1:
                step.battery_violation = True
        else:
            step.battery_soc_kwh = 0.0

        # 12. Useful work with backlog tracking
        actual_work = (step.gpu_load_fraction + step.cpu_load_fraction) / 2.0
        if actual_work >= step.workload_demand:
            useful_work = step.workload_demand
            excess = actual_work - step.workload_demand
            cleared = min(backlog_pool, excess)
            backlog_pool -= cleared
            useful_work += cleared
        else:
            useful_work = actual_work
            backlog_pool += (step.workload_demand - actual_work)

        step.useful_compute = useful_work / max(step.workload_demand, 1e-9)

        # 13. Risk
        step.risk_score = equations.compute_risk_score(
            temp_c, battery_soc, facility
        )

        # 14. Switching penalty
        current_action = (step.gpu_load_fraction + step.cpu_load_fraction) / 2.0
        step.switching_penalty = equations.compute_switching_penalty(
            current_action, prev_workload
        )
        prev_workload = current_action

        # 15. Objective score
        step.objective_score = equations.compute_objective_score(
            step.grid_energy_kwh, step.water_litres, step.carbon_kg,
            step.cost_usd, step.risk_score, step.useful_compute,
            step.switching_penalty, weights, norm,
        )

        # 16. Constraint checks
        if step.temperature_c > constraints.temp_max_c:
            step.temp_violation = True
        if step.temperature_c < constraints.temp_min_c:
            step.temp_violation = True
        if step.facility_power_kw > constraints.max_facility_power_kw:
            step.power_violation = True
        if step.useful_compute < step.mandatory_demand / max(step.workload_demand, 1e-9) - 0.01:
            step.workload_violation = True

        result.steps.append(step)

    result.aggregate()
    return result
