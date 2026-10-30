"""
REGEN-DC Optimization & Simulation Engine Test Suite
===================================================
Tests physics equations, MILP solver, safety validator, strategy comparator, and API responses.
"""
import math
from optimization.config import ExperimentConfig, FacilityConfig, ObjectiveWeights, ScenarioInputs
from optimization import equations
from optimization.simulator import run_simulation
from optimization.strategies import (
    run_baseline, run_heuristic, run_workload_only_milp,
    run_coordinated_milp, run_resource_priority
)
from optimization.comparator import run_comparison
from optimization.validator import validate_result


def test_equations_conservation_and_physical_bounds():
    """Verify core physical laws and equation bounds."""
    facility = FacilityConfig()

    # 1. IT Power bounds
    p_min = equations.compute_it_power_kw(0.0, 0.0, facility)
    p_max = equations.compute_it_power_kw(1.0, 1.0, facility)
    assert p_min > 0, "Idle power must be positive"
    assert p_max > p_min, "Max power must exceed idle power"
    assert p_max <= facility.total_it_capacity_kw + 1e-3

    # 2. COP behavior
    cop_cold = equations.compute_cop(15.0, facility)
    cop_hot = equations.compute_cop(40.0, facility)
    assert cop_cold > cop_hot, "COP should degrade with higher ambient temperature"
    assert cop_hot >= 2.0, "COP should not drop below minimum floor"

    # 3. Cooling electric load
    q_heat = 100000.0  # 100 MW thermal
    p_cool = equations.compute_cooling_electric_kw(q_heat, cop_cold)
    assert 0 < p_cool < q_heat, "Cooling electric should be positive and less than thermal load"

    # 4. Battery SOC conservation
    dt = 1.0
    soc_0 = 80000.0
    charge_kw = 20000.0
    soc_1 = equations.compute_battery_soc(
        soc_0, charge_kw, 0.0, dt,
        facility.battery_efficiency_charge,
        facility.battery_efficiency_discharge
    )
    assert soc_1 > soc_0, "Charging must increase SOC"
    discharge_kw = 20000.0
    soc_2 = equations.compute_battery_soc(
        soc_1, 0.0, discharge_kw, dt,
        facility.battery_efficiency_charge,
        facility.battery_efficiency_discharge
    )
    assert soc_2 < soc_1, "Discharging must decrease SOC"


def test_all_strategies_run_and_produce_valid_results():
    """Verify all 5 strategies execute properly and output realistic metrics."""
    config = ExperimentConfig()
    config.scenario.num_steps = 12  # Fast run 12 hours

    res_a = run_baseline(config)
    assert res_a.total_energy_kwh > 0
    assert res_a.total_water_litres > 0
    assert res_a.total_cost_usd > 0
    assert res_a.avg_useful_compute > 0.99

    res_b = run_heuristic(config)
    assert res_b.total_energy_kwh > 0
    assert res_b.safety_passed

    res_c = run_workload_only_milp(config)
    assert res_c.total_energy_kwh > 0
    assert "optimal" in res_c.solver_status.lower() or "feasible" in res_c.solver_status.lower()

    res_d = run_coordinated_milp(config)
    assert res_d.total_energy_kwh > 0
    assert res_d.safety_passed

    res_e = run_resource_priority(config, "water")
    assert res_e.total_water_litres > 0


def test_independent_validator_detects_violations():
    """Verify safety validator catches hard constraint violations."""
    config = ExperimentConfig()
    config.scenario.num_steps = 4
    res = run_baseline(config)

    # Force artificial temperature violation
    res.steps[2].temperature_c = 42.0  # Limit is 35.0 C
    violations = validate_result(res, config)
    assert len(violations) > 0
    assert any("Temperature" in v["constraint"] for v in violations)


def test_comparison_engine_produces_rankings_and_deltas():
    """Verify comparator aggregates all strategies and calculates deltas."""
    config = ExperimentConfig()
    config.scenario.num_steps = 12

    comp = run_comparison(config, ["A", "B", "C", "D"])
    assert len(comp.strategy_results) == 4
    assert len(comp.rankings["by_objective_score"]) == 4
    assert comp.best_strategy != ""

    # Check metrics diff
    energy_comp = comp.metric_comparisons.get("Grid Electricity")
    assert energy_comp is not None
    assert "changes" in energy_comp
