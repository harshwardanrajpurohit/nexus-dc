"""
REGEN-DC Safety Validator
==========================
Independent validation of simulation results against hard constraints.
Runs AFTER simulation, separate from the optimizer's constraints.
"""
from typing import List, Dict, Any
from optimization.config import ExperimentConfig
from optimization.simulator import SimulationResult


def validate_result(
    result: SimulationResult,
    config: ExperimentConfig,
) -> List[Dict[str, Any]]:
    """
    Independently validate a simulation result against all hard constraints.

    This validation is separate from the optimizer's constraints.
    A result that passes optimizer constraints but fails here is rejected.

    Returns:
        List of violation dicts. Empty list means all constraints passed.
    """
    violations = []
    constraints = config.constraints
    facility = config.facility

    for step in result.steps:
        t = step.step

        # 1. Temperature bounds
        if step.temperature_c > constraints.temp_max_c:
            violations.append({
                "step": t,
                "constraint": "Maximum Temperature",
                "limit": constraints.temp_max_c,
                "actual": round(step.temperature_c, 2),
                "violation_amount": round(step.temperature_c - constraints.temp_max_c, 2),
                "type": "hard",
                "severity": "CRITICAL" if step.temperature_c > constraints.temp_max_c + 5 else "WARNING",
            })

        if step.temperature_c < constraints.temp_min_c:
            violations.append({
                "step": t,
                "constraint": "Minimum Temperature",
                "limit": constraints.temp_min_c,
                "actual": round(step.temperature_c, 2),
                "violation_amount": round(constraints.temp_min_c - step.temperature_c, 2),
                "type": "hard",
                "severity": "WARNING",
            })

        # 2. Facility power limit
        if step.facility_power_kw > constraints.max_facility_power_kw:
            violations.append({
                "step": t,
                "constraint": "Maximum Facility Power",
                "limit": constraints.max_facility_power_kw,
                "actual": round(step.facility_power_kw, 2),
                "violation_amount": round(step.facility_power_kw - constraints.max_facility_power_kw, 2),
                "type": "hard",
                "severity": "CRITICAL",
            })

        # 3. Battery SOC bounds
        if facility.battery_enabled:
            if step.battery_soc_kwh < constraints.min_battery_soc_kwh - 1.0:
                violations.append({
                    "step": t,
                    "constraint": "Minimum Battery SOC",
                    "limit": constraints.min_battery_soc_kwh,
                    "actual": round(step.battery_soc_kwh, 2),
                    "violation_amount": round(constraints.min_battery_soc_kwh - step.battery_soc_kwh, 2),
                    "type": "hard",
                    "severity": "WARNING",
                })

            if step.battery_soc_kwh > constraints.max_battery_soc_kwh + 1.0:
                violations.append({
                    "step": t,
                    "constraint": "Maximum Battery SOC",
                    "limit": constraints.max_battery_soc_kwh,
                    "actual": round(step.battery_soc_kwh, 2),
                    "violation_amount": round(step.battery_soc_kwh - constraints.max_battery_soc_kwh, 2),
                    "type": "hard",
                    "severity": "WARNING",
                })

        # 4. Mandatory workload completion
        if step.workload_demand > 0:
            mandatory_demand = step.workload_demand * step.mandatory_demand / max(step.workload_demand, 1e-9)
            served = step.useful_compute * step.workload_demand
            if served < mandatory_demand - 0.01:
                violations.append({
                    "step": t,
                    "constraint": "Mandatory Workload",
                    "limit": round(mandatory_demand, 4),
                    "actual": round(served, 4),
                    "violation_amount": round(mandatory_demand - served, 4),
                    "type": "hard",
                    "severity": "CRITICAL",
                })

        # 5. Cooling capacity
        if step.cooling_thermal_kw > constraints.max_cooling_capacity_kw:
            violations.append({
                "step": t,
                "constraint": "Cooling Capacity",
                "limit": constraints.max_cooling_capacity_kw,
                "actual": round(step.cooling_thermal_kw, 2),
                "violation_amount": round(step.cooling_thermal_kw - constraints.max_cooling_capacity_kw, 2),
                "type": "hard",
                "severity": "CRITICAL",
            })

    return violations


def build_constraint_comparison_table(
    results: Dict[str, SimulationResult],
    config: ExperimentConfig,
) -> List[Dict[str, Any]]:
    """
    Build a constraint comparison table across all strategies.

    For each constraint, shows:
    - Constraint name and configured limit
    - Each strategy's result (worst case over all steps)
    - Pass/fail status
    """
    constraints_table = []
    limits = config.constraints

    constraint_defs = [
        ("Max Temperature (°C)", limits.temp_max_c, "temperature_c", "max"),
        ("Min Temperature (°C)", limits.temp_min_c, "temperature_c", "min"),
        ("Max Facility Power (kW)", limits.max_facility_power_kw, "facility_power_kw", "max"),
        ("Min Battery SOC (kWh)", limits.min_battery_soc_kwh, "battery_soc_kwh", "min"),
        ("Max Battery SOC (kWh)", limits.max_battery_soc_kwh, "battery_soc_kwh", "max"),
    ]

    for name, limit, attr, check_type in constraint_defs:
        row = {
            "constraint": name,
            "limit": limit,
            "strategies": {},
        }

        for strategy_name, sim_res in results.items():
            values = [getattr(s, attr) for s in sim_res.steps]
            if check_type == "max":
                worst = max(values) if values else 0
                passed = worst <= limit + 0.1
                violation = max(0, worst - limit)
            else:
                worst = min(values) if values else 0
                passed = worst >= limit - 0.1
                violation = max(0, limit - worst)

            row["strategies"][strategy_name] = {
                "value": round(worst, 2),
                "passed": passed,
                "violation_amount": round(violation, 2),
            }

        constraints_table.append(row)

    return constraints_table
