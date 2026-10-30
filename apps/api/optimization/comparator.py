"""
REGEN-DC Comparison Engine
============================
Runs all strategies under identical conditions and produces comparison metrics.
"""
import time
import copy
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field, asdict
from optimization.config import ExperimentConfig
from optimization.simulator import SimulationResult
from optimization.strategies import (
    run_baseline, run_heuristic, run_workload_only_milp,
    run_coordinated_milp, run_resource_priority
)
from optimization.validator import validate_result
from optimization.explainer import generate_explanation


@dataclass
class MetricComparison:
    """Comparison of a single metric across strategies."""
    metric_name: str
    unit: str
    direction: str  # "lower_is_better" or "higher_is_better"
    values: Dict[str, float] = field(default_factory=dict)
    baseline_value: float = 0.0

    def get_changes(self) -> Dict[str, Dict[str, Any]]:
        """Calculate absolute and percentage changes from baseline."""
        changes = {}
        for strategy, value in self.values.items():
            if strategy == "A: Baseline (Existing Policy)":
                continue

            abs_change = self.baseline_value - value
            if self.direction == "higher_is_better":
                abs_change = value - self.baseline_value

            if abs(self.baseline_value) > 1e-9:
                pct_change = 100.0 * abs_change / abs(self.baseline_value)
            else:
                pct_change = None  # Undefined for zero baseline

            is_improvement = abs_change > 0

            changes[strategy] = {
                "baseline_value": round(self.baseline_value, 4),
                "strategy_value": round(value, 4),
                "absolute_change": round(abs_change, 4),
                "percentage_change": round(pct_change, 2) if pct_change is not None else None,
                "is_improvement": is_improvement,
                "direction": self.direction,
                "unit": self.unit,
            }
        return changes


@dataclass
class ComparisonResult:
    """Complete comparison experiment results."""
    experiment_id: str = ""
    timestamp: float = 0.0
    config_summary: Dict[str, Any] = field(default_factory=dict)
    strategy_results: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    metric_comparisons: Dict[str, Dict] = field(default_factory=dict)
    rankings: Dict[str, Any] = field(default_factory=dict)
    explanation: str = ""
    best_strategy: str = ""
    total_runtime_seconds: float = 0.0


def run_comparison(
    config: Optional[ExperimentConfig] = None,
    strategies: Optional[List[str]] = None,
    priority: str = "water",
) -> ComparisonResult:
    """
    Run a complete comparison experiment.

    Args:
        config: Experiment configuration (uses defaults if None)
        strategies: List of strategy keys to run ["A", "B", "C", "D", "E"]
        priority: Priority for Strategy E ("water", "carbon", "cost")

    Returns:
        ComparisonResult with all metrics and comparisons
    """
    t_total_start = time.time()

    if config is None:
        config = ExperimentConfig()

    if strategies is None:
        strategies = ["A", "B", "C", "D"]

    result = ComparisonResult()
    result.experiment_id = f"exp_{int(time.time())}"
    result.timestamp = time.time()
    result.config_summary = {
        "num_steps": config.scenario.num_steps,
        "dt_hours": config.scenario.dt_hours,
        "total_hours": config.scenario.num_steps * config.scenario.dt_hours,
        "gpu_racks": config.facility.num_gpu_racks,
        "cpu_racks": config.facility.num_cpu_racks,
        "total_it_capacity_kw": config.facility.total_it_capacity_kw,
        "battery_enabled": config.facility.battery_enabled,
        "battery_capacity_kwh": config.facility.battery_capacity_kwh,
        "mpc_horizon": config.mpc_horizon,
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
    }

    # Run each strategy
    sim_results: Dict[str, SimulationResult] = {}

    if "A" in strategies:
        sim_results["A"] = run_baseline(config)
    if "B" in strategies:
        sim_results["B"] = run_heuristic(config)
    if "C" in strategies:
        sim_results["C"] = run_workload_only_milp(config)
    if "D" in strategies:
        sim_results["D"] = run_coordinated_milp(config)
    if "E" in strategies:
        sim_results["E"] = run_resource_priority(config, priority)

    # Validate each result
    for key, sim_res in sim_results.items():
        violations = validate_result(sim_res, config)
        if violations:
            sim_res.constraint_violations.extend(violations)
            sim_res.safety_passed = False

    # Build strategy results dict
    for key, sim_res in sim_results.items():
        result.strategy_results[sim_res.strategy_name] = {
            "strategy_key": key,
            "strategy_name": sim_res.strategy_name,
            "strategy_type": sim_res.strategy_type,
            "total_energy_kwh": round(sim_res.total_energy_kwh, 2),
            "total_water_litres": round(sim_res.total_water_litres, 2),
            "total_carbon_kg": round(sim_res.total_carbon_kg, 2),
            "total_cost_usd": round(sim_res.total_cost_usd, 2),
            "total_objective_score": round(sim_res.total_objective_score, 4),
            "peak_temperature_c": round(sim_res.peak_temperature_c, 2),
            "avg_useful_compute": round(sim_res.avg_useful_compute, 4),
            "mandatory_work_completed": round(sim_res.mandatory_work_completed, 4),
            "deadline_violations": sim_res.deadline_violations,
            "total_battery_discharged_kwh": round(sim_res.total_battery_discharged_kwh, 2),
            "total_battery_charged_kwh": round(sim_res.total_battery_charged_kwh, 2),
            "safety_passed": sim_res.safety_passed,
            "is_feasible": sim_res.is_feasible,
            "solver_status": sim_res.solver_status,
            "runtime_seconds": round(sim_res.runtime_seconds, 3),
            "constraint_violations": sim_res.constraint_violations[:10],  # Limit
            "timeseries": _extract_timeseries(sim_res),
        }

    # Build metric comparisons
    if "A" in sim_results:
        baseline = sim_results["A"]
        metrics = [
            ("Grid Electricity", "kWh", "lower_is_better", "total_energy_kwh"),
            ("Water Consumed", "L", "lower_is_better", "total_water_litres"),
            ("Carbon Emissions", "kg CO2e", "lower_is_better", "total_carbon_kg"),
            ("Operating Cost", "USD", "lower_is_better", "total_cost_usd"),
            ("Peak Temperature", "°C", "lower_is_better", "peak_temperature_c"),
            ("Useful Work Completed", "fraction", "higher_is_better", "avg_useful_compute"),
            ("Optimization Score", "score", "lower_is_better", "total_objective_score"),
            ("Battery Discharged", "kWh", "neutral", "total_battery_discharged_kwh"),
            ("Runtime", "seconds", "lower_is_better", "runtime_seconds"),
        ]

        for name, unit, direction, attr in metrics:
            mc = MetricComparison(metric_name=name, unit=unit, direction=direction)
            mc.baseline_value = getattr(baseline, attr)
            for key, sr in sim_results.items():
                mc.values[sr.strategy_name] = getattr(sr, attr)

            result.metric_comparisons[name] = {
                "metric_name": name,
                "unit": unit,
                "direction": direction,
                "baseline_value": mc.baseline_value,
                "values": {k: round(v, 4) for k, v in mc.values.items()},
                "changes": mc.get_changes(),
            }

    # Rankings
    feasible_results = {k: v for k, v in sim_results.items() if v.is_feasible}

    if feasible_results:
        # Ranking 1: By multi-objective score
        by_score = sorted(feasible_results.items(), key=lambda x: x[1].total_objective_score)
        result.rankings["by_objective_score"] = [
            {"rank": i+1, "strategy": v.strategy_name,
             "score": round(v.total_objective_score, 4)}
            for i, (k, v) in enumerate(by_score)
        ]

        # Ranking 2: Best by individual metric
        result.rankings["best_by_metric"] = {}
        for attr, name, direction in [
            ("total_energy_kwh", "Lowest Energy", "min"),
            ("total_water_litres", "Lowest Water", "min"),
            ("total_carbon_kg", "Lowest Carbon", "min"),
            ("total_cost_usd", "Lowest Cost", "min"),
            ("avg_useful_compute", "Highest Work", "max"),
        ]:
            if direction == "min":
                best = min(feasible_results.items(), key=lambda x: getattr(x[1], attr))
            else:
                best = max(feasible_results.items(), key=lambda x: getattr(x[1], attr))
            result.rankings["best_by_metric"][name] = {
                "strategy": best[1].strategy_name,
                "value": round(getattr(best[1], attr), 4),
            }

        # Best overall
        best_overall = by_score[0]
        result.best_strategy = best_overall[1].strategy_name
    else:
        result.best_strategy = "No feasible strategy found"

    # Generate explanation
    result.explanation = generate_explanation(sim_results, result.best_strategy, config)

    result.total_runtime_seconds = time.time() - t_total_start

    return result


def _extract_timeseries(sim_res: SimulationResult) -> Dict[str, List]:
    """Extract time-series data for charting."""
    return {
        "hours": [s.hour for s in sim_res.steps],
        "it_power_kw": [round(s.it_power_kw, 1) for s in sim_res.steps],
        "facility_power_kw": [round(s.facility_power_kw, 1) for s in sim_res.steps],
        "cooling_electric_kw": [round(s.cooling_electric_kw, 1) for s in sim_res.steps],
        "temperature_c": [round(s.temperature_c, 2) for s in sim_res.steps],
        "water_litres": [round(s.water_litres, 1) for s in sim_res.steps],
        "battery_soc_kwh": [round(s.battery_soc_kwh, 1) for s in sim_res.steps],
        "grid_energy_kwh": [round(s.grid_energy_kwh, 1) for s in sim_res.steps],
        "carbon_kg": [round(s.carbon_kg, 1) for s in sim_res.steps],
        "cost_usd": [round(s.cost_usd, 2) for s in sim_res.steps],
        "useful_compute": [round(s.useful_compute, 4) for s in sim_res.steps],
        "workload_demand": [round(s.workload_demand, 4) for s in sim_res.steps],
        "gpu_load_fraction": [round(s.gpu_load_fraction, 4) for s in sim_res.steps],
        "electricity_price": [s.electricity_price for s in sim_res.steps],
        "carbon_intensity": [round(s.carbon_intensity, 4) for s in sim_res.steps],
        "cop": [round(s.cop, 2) for s in sim_res.steps],
        "objective_score": [round(s.objective_score, 4) for s in sim_res.steps],
        "risk_score": [round(s.risk_score, 2) for s in sim_res.steps],
    }
