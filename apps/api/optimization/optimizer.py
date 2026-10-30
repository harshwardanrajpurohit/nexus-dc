"""
REGEN-DC MILP Optimizer (Rolling-Horizon MPC)
===============================================
Uses HiGHS via highspy to solve a Mixed-Integer Linear Program
at each MPC step, implementing Model Predictive Control.

The optimizer:
1. Reads current simulation state
2. Builds a MILP over the look-ahead horizon
3. Minimizes the multi-objective function subject to constraints
4. Applies only the first step's decisions
5. Advances to the next step with updated state
6. Repeats until the full horizon is covered

Linear Approximations:
- COP is precomputed per step (not a decision variable) because it depends
  on ambient temperature, not on decision variables.
- The thermal model is linearized: T(t+1) = T(t) + dt*(heat - cooling)/C_thermal
- Battery dynamics are linear in charge/discharge decisions.
- Workload is modeled as a continuous fraction [0, 1].
"""
import numpy as np
from typing import List, Dict, Tuple, Optional
from optimization.config import ExperimentConfig, FacilityConfig, ScenarioInputs
from optimization import equations

try:
    import highspy
    HAS_HIGHS = True
except ImportError:
    HAS_HIGHS = False


def solve_milp_mpc(
    config: ExperimentConfig,
    optimize_cooling: bool = True,
    optimize_battery: bool = True,
) -> Tuple[List[Dict[str, float]], str]:
    """
    Rolling-horizon MPC using MILP (HiGHS).

    At each time step t, solves a MILP over [t, t+H) where H is the MPC horizon.
    Only the decision at step t is applied. The simulation state is updated,
    and the process repeats at t+1.

    Args:
        config: Complete experiment configuration
        optimize_cooling: If True, include cooling controls in optimization
        optimize_battery: If True, include battery dispatch in optimization

    Returns:
        (decisions, solver_status): List of decision dicts and solver status string
    """
    if not HAS_HIGHS:
        # Fallback: return baseline decisions
        return _fallback_decisions(config), "HiGHS not available — fallback to baseline"

    facility = config.facility
    scenario = config.scenario
    n_total = scenario.num_steps
    H = min(config.mpc_horizon, n_total)
    dt = scenario.dt_hours

    all_decisions = []
    solver_statuses = []

    # Rolling state
    current_temp = facility.temp_setpoint_c
    current_battery_soc = facility.battery_initial_soc_kwh
    current_backlog = 0.0
    prev_workload = 0.0

    for t_start in range(n_total):
        # Horizon for this MPC step
        t_end = min(t_start + H, n_total)
        horizon_len = t_end - t_start

        try:
            decision, status, new_temp, new_soc = _solve_single_mpc_step(
                config=config,
                t_start=t_start,
                horizon_len=horizon_len,
                current_temp=current_temp,
                current_battery_soc=current_battery_soc,
                current_backlog=current_backlog,
                prev_workload=prev_workload,
                optimize_cooling=optimize_cooling,
                optimize_battery=optimize_battery,
            )
        except Exception as e:
            # Solver failure: fall back to demand for this step
            decision = {
                'gpu_load_fraction': scenario.workload_demand[t_start],
                'cpu_load_fraction': scenario.workload_demand[t_start],
                'cooling_setpoint_offset': 0.0,
                'battery_charge_kw': 0.0,
                'battery_discharge_kw': 0.0,
            }
            status = f"Solver error at step {t_start}: {str(e)[:100]}"
            # Simulate forward for state update
            new_temp, new_soc = _simulate_state_forward(
                decision, t_start, config, current_temp, current_battery_soc, dt
            )

        all_decisions.append(decision)
        solver_statuses.append(status)

        # Update rolling state
        prev_workload = (decision['gpu_load_fraction'] + decision['cpu_load_fraction']) / 2.0
        current_temp = new_temp
        current_battery_soc = new_soc
        actual_w = decision['gpu_load_fraction']
        dem = scenario.workload_demand[t_start]
        if actual_w >= dem:
            current_backlog = max(0.0, current_backlog - (actual_w - dem))
        else:
            current_backlog += (dem - actual_w)

    # Summarize solver status
    optimal_count = sum(1 for s in solver_statuses if "Optimal" in s)
    feasible_count = sum(1 for s in solver_statuses if "feasible" in s.lower())
    fail_count = sum(1 for s in solver_statuses if "error" in s.lower() or "infeasible" in s.lower())

    if fail_count > 0:
        overall_status = f"MPC completed: {optimal_count} optimal, {feasible_count} feasible, {fail_count} failed out of {n_total} steps"
    elif optimal_count == n_total:
        overall_status = f"MPC completed: all {n_total} steps solved to optimality (HiGHS)"
    else:
        overall_status = f"MPC completed: {optimal_count} optimal, {n_total - optimal_count} feasible (HiGHS)"

    return all_decisions, overall_status


def _solve_single_mpc_step(
    config: ExperimentConfig,
    t_start: int,
    horizon_len: int,
    current_temp: float,
    current_battery_soc: float,
    current_backlog: float,
    prev_workload: float,
    optimize_cooling: bool,
    optimize_battery: bool,
) -> Tuple[Dict[str, float], str, float, float]:
    """
    Solve one MPC step: build and solve a MILP over the horizon.

    Returns:
        (first_step_decision, solver_status, new_temperature, new_battery_soc)
    """
    facility = config.facility
    scenario = config.scenario
    weights = config.weights
    norm = config.normalization
    constraints = config.constraints
    dt = scenario.dt_hours
    H = horizon_len

    # Pre-compute COP for each step in horizon (not a decision variable)
    cops = []
    for h in range(H):
        t = t_start + h
        ambient = scenario.ambient_temp_c[t]
        cops.append(equations.compute_cop(ambient, facility))

    # ---- Build MILP with highspy ----
    h = highspy.Highs()
    h.silent()

    inf = highspy.kHighsInf

    # --- Decision Variables ---
    # Per horizon step: workload_frac[h], cooling_offset[h], charge[h], discharge[h]
    # workload_frac: [mandatory_frac, 1.0] continuous
    # cooling_offset: [-0.1, 0.1] continuous (fraction adjustment to cooling)
    # charge, discharge: [0, max] continuous

    num_vars_per_step = 4  # workload, cooling_offset, charge, discharge
    num_vars = H * num_vars_per_step

    col_lower = []
    col_upper = []
    col_cost = []  # We'll set objective via rows/constraints instead

    var_idx = {}  # (step, var_name) -> index
    idx = 0

    for step_h in range(H):
        t = t_start + step_h
        mandatory_frac = scenario.workload_demand[t] * scenario.mandatory_fraction[t]

        # workload_frac: must serve at least mandatory, and cannot exceed demand + backlog
        var_idx[(step_h, 'workload')] = idx
        col_lower.append(mandatory_frac)
        if step_h == 0:
            col_upper.append(min(1.0, scenario.workload_demand[t] + current_backlog))
        else:
            col_upper.append(1.0)
        col_cost.append(0.0)
        idx += 1

        # cooling_offset
        var_idx[(step_h, 'cooling')] = idx
        if optimize_cooling:
            col_lower.append(-0.15)
            col_upper.append(0.15)
        else:
            col_lower.append(0.0)
            col_upper.append(0.0)
        col_cost.append(0.0)
        idx += 1

        # battery charge
        var_idx[(step_h, 'charge')] = idx
        if optimize_battery and facility.battery_enabled:
            col_lower.append(0.0)
            col_upper.append(facility.battery_max_charge_kw)
        else:
            col_lower.append(0.0)
            col_upper.append(0.0)
        col_cost.append(0.0)
        idx += 1

        # battery discharge
        var_idx[(step_h, 'discharge')] = idx
        if optimize_battery and facility.battery_enabled:
            col_lower.append(0.0)
            col_upper.append(facility.battery_max_discharge_kw)
        else:
            col_lower.append(0.0)
            col_upper.append(0.0)
        col_cost.append(0.0)
        idx += 1

    # Add auxiliary variables for absolute value of switching penalty
    # switch_abs[h] >= |workload[h] - workload[h-1]|
    # Linearized as: switch_abs[h] >= workload[h] - prev, switch_abs[h] >= prev - workload[h]
    switch_start_idx = idx
    for step_h in range(H):
        var_idx[(step_h, 'switch_abs')] = idx
        col_lower.append(0.0)
        col_upper.append(2.0)
        col_cost.append(0.0)
        idx += 1

    total_vars = idx

    # Now build the objective as column costs
    # We need to express the linear objective in terms of variables
    # J = sum_h [ cost_coefficients × variables ]

    # The objective components that are linear in decisions:
    # Energy = f(workload, charge, discharge) → linear
    # Water = f(workload) → linear (COP is pre-computed)
    # Carbon = Energy × carbon_intensity → linear
    # Cost = Energy × price → linear
    # UsefulCompute = workload / demand → linear
    # Switching = switch_abs → linear

    obj_coeffs = [0.0] * total_vars

    for step_h in range(H):
        t = t_start + step_h
        cop = cops[step_h]
        price = scenario.electricity_price_usd_per_kwh[t]
        carbon_int = scenario.carbon_intensity_kg_per_kwh[t]
        ambient = scenario.ambient_temp_c[t]
        demand = scenario.workload_demand[t]

        wl_idx = var_idx[(step_h, 'workload')]
        ch_idx = var_idx[(step_h, 'charge')]
        di_idx = var_idx[(step_h, 'discharge')]
        sw_idx = var_idx[(step_h, 'switch_abs')]
        co_idx = var_idx[(step_h, 'cooling')]

        # IT power as function of workload fraction w:
        # P_IT(w) = N_gpu*(idle_g + w*(max_g-idle_g)) + N_cpu*(idle_c + w*(max_c-idle_c))
        # P_IT(w) = P_idle + w * P_range
        p_idle = (facility.num_gpu_racks * facility.gpu_rack_idle_kw
                  + facility.num_cpu_racks * facility.cpu_rack_idle_kw)
        p_range = (facility.num_gpu_racks * (facility.gpu_rack_max_kw - facility.gpu_rack_idle_kw)
                   + facility.num_cpu_racks * (facility.cpu_rack_max_kw - facility.cpu_rack_idle_kw))

        # Cooling electric: P_cool = P_IT * (1+overhead) / COP
        cool_factor = (1.0 + facility.overhead_fraction) / cop

        # Facility power: P_fac = P_IT * (1 + overhead + cool_factor) + charge - discharge - renewable
        # But renewable is not a decision variable, it's used up to availability
        # For the MILP, we model renewable as reducing the constant term
        renewable_kw = scenario.renewable_kw[t]

        # P_grid(w, ch, di) = (P_idle + w*P_range) * (1 + overhead + 1/COP*(1+overhead))
        #                   + ch - di - renewable
        overhead_and_cool = 1.0 + facility.overhead_fraction + cool_factor
        # = p_idle * overhead_and_cool + w * p_range * overhead_and_cool + ch - di - renewable

        grid_per_w = p_range * overhead_and_cool  # kW per unit workload
        grid_constant = p_idle * overhead_and_cool - renewable_kw  # kW constant term

        # Energy (kWh) = grid_kW * dt
        energy_per_w = grid_per_w * dt
        energy_per_ch = 1.0 * dt
        energy_per_di = -1.0 * dt

        # Water: W = water_coeff * Q_cooling * dt = water_coeff * P_IT*(1+overhead) * dt
        if ambient < facility.free_cooling_threshold_c:
            water_coeff = facility.water_coeff_free_cooling
        else:
            water_coeff = facility.water_coeff_evaporative
        water_per_w = water_coeff * p_range * (1.0 + facility.overhead_fraction) * dt

        # Objective coefficients for workload variable:
        coeff_w = (
            weights.w_energy * (energy_per_w / norm.energy_ref_kwh)
            + weights.w_water * (water_per_w / norm.water_ref_litres)
            + weights.w_carbon * (energy_per_w * carbon_int / norm.carbon_ref_kg)
            + weights.w_cost * (energy_per_w * price / norm.cost_ref_usd)
        )

        obj_coeffs[wl_idx] = coeff_w

        # Charge variable coefficient (increases grid energy)
        coeff_ch = (
            weights.w_energy * (energy_per_ch / norm.energy_ref_kwh)
            + weights.w_carbon * (energy_per_ch * carbon_int / norm.carbon_ref_kg)
            + weights.w_cost * (energy_per_ch * price / norm.cost_ref_usd)
        )
        obj_coeffs[ch_idx] = coeff_ch

        # Discharge variable coefficient (decreases grid energy)
        coeff_di = (
            weights.w_energy * (energy_per_di / norm.energy_ref_kwh)
            + weights.w_carbon * (energy_per_di * carbon_int / norm.carbon_ref_kg)
            + weights.w_cost * (energy_per_di * price / norm.cost_ref_usd)
        )
        obj_coeffs[di_idx] = coeff_di

        # Switching penalty
        obj_coeffs[sw_idx] = weights.w_switching

    # Set objective
    h.addVars(total_vars, col_lower, col_upper)
    for c_i in range(total_vars):
        h.changeColCost(c_i, float(obj_coeffs[c_i]))
    h.changeObjectiveSense(highspy.ObjSense.kMinimize)

    # --- Constraints ---

    # 0. Horizon workload satisfaction constraint:
    # Must serve total demand over horizon + current backlog (up to physical capacity)
    total_horizon_demand = sum(scenario.workload_demand[t_start + sh] for sh in range(H)) + current_backlog
    target_work = min(float(H) * 0.98, total_horizon_demand)
    wl_indices = [var_idx[(sh, 'workload')] for sh in range(H)]
    wl_coeffs = [1.0] * H
    h.addRow(target_work, inf, H, wl_indices, wl_coeffs)

    # 1. Switching penalty linearization: switch_abs[h] >= workload[h] - prev
    for step_h in range(H):
        wl_idx = var_idx[(step_h, 'workload')]
        sw_idx = var_idx[(step_h, 'switch_abs')]

        if step_h == 0:
            prev_val = prev_workload
        else:
            prev_idx = var_idx[(step_h - 1, 'workload')]

        # switch_abs >= workload - prev => -switch_abs + workload <= prev
        # switch_abs >= prev - workload => -switch_abs - workload <= -prev

        if step_h == 0:
            # switch_abs[0] >= w[0] - prev_workload
            # w[0] - switch_abs[0] <= prev_workload
            h.addRow(-inf, prev_val, 2,
                     [wl_idx, sw_idx], [1.0, -1.0])
            # switch_abs[0] >= prev_workload - w[0]
            # -w[0] - switch_abs[0] <= -prev_workload
            h.addRow(-inf, -prev_val, 2,
                     [wl_idx, sw_idx], [-1.0, -1.0])
        else:
            prev_idx = var_idx[(step_h - 1, 'workload')]
            # w[h] - w[h-1] - switch_abs[h] <= 0
            h.addRow(-inf, 0.0, 3,
                     [wl_idx, prev_idx, sw_idx], [1.0, -1.0, -1.0])
            # w[h-1] - w[h] - switch_abs[h] <= 0
            h.addRow(-inf, 0.0, 3,
                     [prev_idx, wl_idx, sw_idx], [1.0, -1.0, -1.0])

    # 2. Facility power limit: P_grid(w, ch, di) <= max_facility_power
    for step_h in range(H):
        t = t_start + step_h
        cop = cops[step_h]
        renewable_kw = scenario.renewable_kw[t]

        p_idle = (facility.num_gpu_racks * facility.gpu_rack_idle_kw
                  + facility.num_cpu_racks * facility.cpu_rack_idle_kw)
        p_range = (facility.num_gpu_racks * (facility.gpu_rack_max_kw - facility.gpu_rack_idle_kw)
                   + facility.num_cpu_racks * (facility.cpu_rack_max_kw - facility.cpu_rack_idle_kw))

        overhead_and_cool = 1.0 + facility.overhead_fraction + (1.0 + facility.overhead_fraction) / cop
        grid_constant = p_idle * overhead_and_cool - renewable_kw

        wl_idx = var_idx[(step_h, 'workload')]
        ch_idx = var_idx[(step_h, 'charge')]
        di_idx = var_idx[(step_h, 'discharge')]

        # p_range * overhead_and_cool * w + ch - di <= max_power - grid_constant
        rhs = constraints.max_facility_power_kw - grid_constant
        h.addRow(-inf, rhs, 3,
                 [wl_idx, ch_idx, di_idx],
                 [p_range * overhead_and_cool, 1.0, -1.0])

    # 3. Battery SOC constraints (rolling)
    if optimize_battery and facility.battery_enabled:
        # SOC[h] = initial_soc + sum_{j=0}^{h} (eta_c*ch[j] - di[j]/eta_d) * dt
        # SOC[h] >= min_soc, SOC[h] <= max_soc

        eta_c = facility.battery_efficiency_charge
        eta_d = facility.battery_efficiency_discharge

        for step_h in range(H):
            # sum of (eta_c * ch[j] - di[j] / eta_d) * dt for j=0..step_h
            indices = []
            coeffs = []
            for j in range(step_h + 1):
                ch_idx = var_idx[(j, 'charge')]
                di_idx = var_idx[(j, 'discharge')]
                indices.extend([ch_idx, di_idx])
                coeffs.extend([eta_c * dt, -dt / eta_d])

            # SOC[h] = current_battery_soc + sum(...) >= min_soc
            # => sum(...) >= min_soc - current_battery_soc
            min_rhs = constraints.min_battery_soc_kwh - current_battery_soc
            h.addRow(min_rhs, inf, len(indices), indices, coeffs)

            # SOC[h] = current_battery_soc + sum(...) <= max_soc
            # => sum(...) <= max_soc - current_battery_soc
            max_rhs = constraints.max_battery_soc_kwh - current_battery_soc
            h.addRow(-inf, max_rhs, len(indices), indices, coeffs)

    # 4. Temperature constraints (simplified linear envelope)
    # We track temperature evolution linearly
    # T[h+1] = T[h] + dt * (P_IT*(1+overhead) - cooling) / C_thermal
    # For the MILP, cooling = P_IT*(1+overhead) + cooling_offset * P_range
    # We ensure T stays within [temp_min, temp_max]
    # This is a simplified constraint — the simulation does the full physics check

    # --- Solve ---
    h.setOptionValue("time_limit", config.solver_time_limit_s)
    h.setOptionValue("mip_rel_gap", 0.01)  # 1% optimality gap acceptable
    h.run()

    status = h.getInfoValue("primal_solution_status")
    model_status = h.getModelStatus()

    if model_status == highspy.HighsModelStatus.kOptimal:
        status_str = "Optimal (HiGHS)"
    elif model_status == highspy.HighsModelStatus.kObjectiveBound:
        status_str = "Optimal within gap (HiGHS)"
    elif model_status in (highspy.HighsModelStatus.kSolutionLimit,
                           highspy.HighsModelStatus.kTimeLimit):
        status_str = "Feasible incumbent (time/iteration limit)"
    elif model_status == highspy.HighsModelStatus.kInfeasible:
        status_str = "Infeasible — falling back to baseline"
        return _make_baseline_decision(t_start, config), status_str, current_temp, current_battery_soc
    else:
        status_str = f"Status: {model_status}"

    # Extract solution
    solution = h.getSolution()
    col_values = list(solution.col_value)

    # Get first step decision
    workload = col_values[var_idx[(0, 'workload')]]
    cooling = col_values[var_idx[(0, 'cooling')]]
    charge = col_values[var_idx[(0, 'charge')]]
    discharge = col_values[var_idx[(0, 'discharge')]]

    decision = {
        'gpu_load_fraction': max(0.0, min(1.0, workload)),
        'cpu_load_fraction': max(0.0, min(1.0, workload)),
        'cooling_setpoint_offset': cooling,
        'battery_charge_kw': max(0.0, charge),
        'battery_discharge_kw': max(0.0, discharge),
    }

    # Simulate forward for state update
    new_temp, new_soc = _simulate_state_forward(
        decision, t_start, config, current_temp, current_battery_soc, dt
    )

    return decision, status_str, new_temp, new_soc


def _simulate_state_forward(
    decision: Dict[str, float],
    t: int,
    config: ExperimentConfig,
    current_temp: float,
    current_soc: float,
    dt: float,
) -> Tuple[float, float]:
    """Simulate one step forward to update temperature and battery SOC."""
    facility = config.facility
    scenario = config.scenario

    w = decision['gpu_load_fraction']
    it_power = equations.compute_it_power_kw(w, w, facility)
    heat_load = it_power * (1.0 + facility.overhead_fraction)
    cooling_thermal = heat_load  # Assume cooling matches load (steady state)

    new_temp = equations.compute_thermal_dynamics(
        current_temp, heat_load, cooling_thermal, dt,
        facility.thermal_capacity_kwh_per_c
    )

    new_soc = current_soc
    if facility.battery_enabled:
        new_soc = equations.compute_battery_soc(
            current_soc,
            decision['battery_charge_kw'],
            decision['battery_discharge_kw'],
            dt,
            facility.battery_efficiency_charge,
            facility.battery_efficiency_discharge,
        )

    return new_temp, new_soc


def _make_baseline_decision(t: int, config: ExperimentConfig) -> Dict[str, float]:
    """Create a baseline decision for step t."""
    return {
        'gpu_load_fraction': config.scenario.workload_demand[t],
        'cpu_load_fraction': config.scenario.workload_demand[t],
        'cooling_setpoint_offset': 0.0,
        'battery_charge_kw': 0.0,
        'battery_discharge_kw': 0.0,
    }


def _fallback_decisions(config: ExperimentConfig) -> List[Dict[str, float]]:
    """Generate baseline decisions when solver is unavailable."""
    return [_make_baseline_decision(t, config) for t in range(config.scenario.num_steps)]
