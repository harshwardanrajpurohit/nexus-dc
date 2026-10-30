"""
REGEN-DC Strategy Implementations
===================================
Each strategy produces a list of decisions for the simulation runner.

Strategy A: Baseline (existing policy — run at demand, no optimization)
Strategy B: Rule-Based Heuristic (shift load to cheap/clean hours)
Strategy C: Workload-Only Optimization (MILP for workload scheduling only)
Strategy D: Coordinated Optimization (MILP for workload + cooling + battery)
Strategy E: Resource-Priority Scenario (dynamic weights)
"""
import time
import math
from typing import List, Dict, Optional
from optimization.config import (
    ExperimentConfig, FacilityConfig, ScenarioInputs,
    ConstraintLimits, ObjectiveWeights, NormalizationRefs
)
from optimization.simulator import run_simulation, SimulationResult
from optimization import equations


def run_baseline(config: ExperimentConfig) -> SimulationResult:
    """
    Strategy A: Baseline / Existing Policy.

    Run the simulator at the demanded workload level.
    No optimization, no battery use, standard cooling.
    This is the reference against which improvements are measured.
    """
    t_start = time.time()

    # No decisions = simulator uses demand directly
    result = run_simulation(
        facility=config.facility,
        scenario=config.scenario,
        constraints=config.constraints,
        weights=config.weights,
        norm=config.normalization,
        decisions=None,
    )

    result.strategy_name = "A: Baseline (Existing Policy)"
    result.strategy_type = "baseline"
    result.runtime_seconds = time.time() - t_start
    result.solver_status = "N/A (no optimization)"

    return result


def run_heuristic(config: ExperimentConfig) -> SimulationResult:
    """
    Strategy B: Rule-Based Greedy Heuristic.

    Rules:
    1. When electricity price is high (>= peak threshold), defer optional work
       to the next cheapest available step within a 4-hour window.
    2. Use battery discharge during peak price periods.
    3. Charge battery during off-peak periods.
    4. All mandatory work must still be served immediately.

    This is a transparent benchmark — NOT claimed to be optimal.
    """
    t_start = time.time()
    scenario = config.scenario
    facility = config.facility
    n = scenario.num_steps

    # Determine price thresholds
    prices = scenario.electricity_price_usd_per_kwh
    avg_price = sum(prices) / len(prices)
    peak_threshold = avg_price * 1.2  # 20% above average = peak

    decisions = []
    battery_soc = facility.battery_initial_soc_kwh
    dt = scenario.dt_hours

    # Track deferred work
    deferred_pool = 0.0  # Accumulated deferred optional demand

    for t in range(n):
        demand = scenario.workload_demand[t]
        mandatory = demand * scenario.mandatory_fraction[t]
        optional = demand - mandatory
        price = prices[t]

        d = {
            'gpu_load_fraction': demand,
            'cpu_load_fraction': demand,
            'cooling_setpoint_offset': 0.0,
            'battery_charge_kw': 0.0,
            'battery_discharge_kw': 0.0,
        }

        # Rule 1: Defer optional work during peak prices
        if price >= peak_threshold and optional > 0.05:
            # Serve mandatory only
            served = mandatory
            deferred_pool += optional
            d['gpu_load_fraction'] = served
            d['cpu_load_fraction'] = served
        elif deferred_pool > 0 and price < peak_threshold:
            # Serve current demand + some deferred work
            available_headroom = 1.0 - demand
            recover = min(deferred_pool, available_headroom * 0.5)
            d['gpu_load_fraction'] = demand + recover
            d['cpu_load_fraction'] = demand + recover
            deferred_pool -= recover

        # Rule 2: Battery discharge during peak prices
        if price >= peak_threshold and facility.battery_enabled:
            max_discharge = min(
                facility.battery_max_discharge_kw,
                (battery_soc - facility.battery_min_soc_kwh) / dt * facility.battery_efficiency_discharge
            )
            discharge = max(0, min(max_discharge, 50000.0))  # Cap at 50MW
            d['battery_discharge_kw'] = discharge
            battery_soc -= discharge * dt / facility.battery_efficiency_discharge

        # Rule 3: Battery charge during off-peak
        elif price < avg_price * 0.8 and facility.battery_enabled:
            max_charge = min(
                facility.battery_max_charge_kw,
                (facility.battery_capacity_kwh - battery_soc) / (dt * facility.battery_efficiency_charge)
            )
            charge = max(0, min(max_charge, 40000.0))  # Cap at 40MW
            d['battery_charge_kw'] = charge
            battery_soc += charge * dt * facility.battery_efficiency_charge

        decisions.append(d)

    result = run_simulation(
        facility=facility,
        scenario=scenario,
        constraints=config.constraints,
        weights=config.weights,
        norm=config.normalization,
        decisions=decisions,
    )

    result.strategy_name = "B: Rule-Based Heuristic"
    result.strategy_type = "heuristic"
    result.runtime_seconds = time.time() - t_start
    result.solver_status = "Heuristic (no optimality guarantee)"

    return result


def run_workload_only_milp(config: ExperimentConfig) -> SimulationResult:
    """
    Strategy C: Workload-Only MILP Optimization.

    Uses rolling-horizon MPC with HiGHS to optimally schedule workloads.
    Cooling and battery remain at baseline policy.

    The MILP minimizes the weighted objective over the horizon while
    respecting computing capacity and mandatory workload constraints.
    """
    from optimization.optimizer import solve_milp_mpc

    t_start = time.time()

    decisions, solver_status = solve_milp_mpc(
        config=config,
        optimize_cooling=False,
        optimize_battery=False,
    )

    result = run_simulation(
        facility=config.facility,
        scenario=config.scenario,
        constraints=config.constraints,
        weights=config.weights,
        norm=config.normalization,
        decisions=decisions,
    )

    result.strategy_name = "C: Workload-Only Optimization (MILP)"
    result.strategy_type = "optimizer"
    result.runtime_seconds = time.time() - t_start
    result.solver_status = solver_status

    return result


def run_coordinated_milp(config: ExperimentConfig) -> SimulationResult:
    """
    Strategy D: Coordinated Resource Optimization (MILP).

    Jointly optimizes workload scheduling, cooling controls, and battery
    dispatch using rolling-horizon MPC with HiGHS.
    """
    from optimization.optimizer import solve_milp_mpc

    t_start = time.time()

    decisions, solver_status = solve_milp_mpc(
        config=config,
        optimize_cooling=True,
        optimize_battery=True,
    )

    result = run_simulation(
        facility=config.facility,
        scenario=config.scenario,
        constraints=config.constraints,
        weights=config.weights,
        norm=config.normalization,
        decisions=decisions,
    )

    result.strategy_name = "D: Coordinated Optimization (MILP)"
    result.strategy_type = "optimizer"
    result.runtime_seconds = time.time() - t_start
    result.solver_status = solver_status

    return result


def run_resource_priority(config: ExperimentConfig, priority: str = "water") -> SimulationResult:
    """
    Strategy E: Resource-Priority Scenario.

    Same optimization as D but with adjusted weights emphasizing one resource.
    The weight adjustment is derived from scenario conditions, not arbitrarily changed.

    priority: "water", "carbon", or "cost"
    """
    from optimization.optimizer import solve_milp_mpc
    import copy

    t_start = time.time()

    # Create modified config with adjusted weights
    modified_config = copy.deepcopy(config)

    if priority == "water":
        modified_config.weights.w_water = config.weights.w_water * 3.0
        modified_config.weights.w_energy = config.weights.w_energy * 0.7
    elif priority == "carbon":
        modified_config.weights.w_carbon = config.weights.w_carbon * 3.0
        modified_config.weights.w_energy = config.weights.w_energy * 0.7
    elif priority == "cost":
        modified_config.weights.w_cost = config.weights.w_cost * 3.0
        modified_config.weights.w_energy = config.weights.w_energy * 0.7

    decisions, solver_status = solve_milp_mpc(
        config=modified_config,
        optimize_cooling=True,
        optimize_battery=True,
    )

    # IMPORTANT: Evaluate with ORIGINAL weights for fair comparison
    result = run_simulation(
        facility=config.facility,
        scenario=config.scenario,
        constraints=config.constraints,
        weights=config.weights,       # Original weights for comparison
        norm=config.normalization,     # Original normalization
        decisions=decisions,
    )

    result.strategy_name = f"E: {priority.title()}-Priority Scenario"
    result.strategy_type = "optimizer"
    result.runtime_seconds = time.time() - t_start
    result.solver_status = solver_status

    return result
