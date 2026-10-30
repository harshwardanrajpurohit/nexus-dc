"""
REGEN-DC Resource Equations Module
===================================
All physical and economic calculations for the data center.

Every equation is documented with units and assumptions.
These equations are used by both the simulation (forward pass)
and the optimizer (constraint/objective construction).
"""
import math
from typing import Optional
from optimization.config import FacilityConfig


def compute_it_power_kw(
    gpu_load_fraction: float,
    cpu_load_fraction: float,
    facility: FacilityConfig,
) -> float:
    """
    Total IT power consumption.

    P_IT = N_gpu × (idle_gpu + load_gpu × (max_gpu - idle_gpu))
         + N_cpu × (idle_cpu + load_cpu × (max_cpu - idle_cpu))

    Args:
        gpu_load_fraction: GPU utilization [0, 1]
        cpu_load_fraction: CPU utilization [0, 1]
        facility: Facility configuration

    Returns:
        Total IT power in kW
    """
    gpu_power = facility.num_gpu_racks * (
        facility.gpu_rack_idle_kw
        + gpu_load_fraction * (facility.gpu_rack_max_kw - facility.gpu_rack_idle_kw)
    )
    cpu_power = facility.num_cpu_racks * (
        facility.cpu_rack_idle_kw
        + cpu_load_fraction * (facility.cpu_rack_max_kw - facility.cpu_rack_idle_kw)
    )
    return gpu_power + cpu_power


def compute_cooling_thermal_load_kw(
    it_power_kw: float,
    facility: FacilityConfig,
) -> float:
    """
    Thermal heat that must be removed by the cooling system.

    Q_cooling = P_IT × (1 + overhead_fraction)

    Assumption: all electrical energy consumed by IT is converted to heat.
    Overhead adds lighting/networking heat.

    Args:
        it_power_kw: IT power in kW
        facility: Facility configuration

    Returns:
        Thermal cooling load in kW (thermal)
    """
    return it_power_kw * (1.0 + facility.overhead_fraction)


def compute_cop(
    ambient_temp_c: float,
    facility: FacilityConfig,
) -> float:
    """
    Coefficient of Performance based on ambient temperature.

    When ambient < free_cooling_threshold: COP = cop_free_cooling
    Otherwise: COP = cop_nominal × (1 - 0.02 × (ambient - 25))

    COP is clamped to [2.0, cop_free_cooling] for physical validity.

    Args:
        ambient_temp_c: Outside air temperature in °C
        facility: Facility configuration

    Returns:
        COP (dimensionless, > 1.0)
    """
    if ambient_temp_c < facility.free_cooling_threshold_c:
        return facility.cop_free_cooling

    # COP degrades with higher ambient temperature
    cop = facility.cop_nominal * (1.0 - 0.02 * max(0, ambient_temp_c - 25.0))
    return max(2.0, min(cop, facility.cop_free_cooling))


def compute_cooling_electric_kw(
    q_cooling_kw: float,
    cop: float,
) -> float:
    """
    Electrical power consumed by the cooling system.

    P_cooling_electric = Q_cooling / COP

    Args:
        q_cooling_kw: Thermal cooling load in kW
        cop: Coefficient of Performance

    Returns:
        Electrical power for cooling in kW
    """
    if cop <= 0:
        raise ValueError(f"COP must be positive, got {cop}")
    return q_cooling_kw / cop


def compute_facility_power_kw(
    it_power_kw: float,
    cooling_electric_kw: float,
    other_kw: float = 0.0,
    battery_charge_kw: float = 0.0,
    battery_discharge_kw: float = 0.0,
    renewable_used_kw: float = 0.0,
) -> float:
    """
    Total facility power drawn from the grid.

    P_grid = P_IT + P_cooling_electric + P_other + P_charge - P_discharge - P_renewable

    Result is clamped to >= 0 (no grid export).

    Args:
        it_power_kw: IT load in kW
        cooling_electric_kw: Cooling electrical load in kW
        other_kw: Miscellaneous loads in kW
        battery_charge_kw: Battery charging power in kW
        battery_discharge_kw: Battery discharging power in kW
        renewable_used_kw: On-site renewable power used in kW

    Returns:
        Grid power import in kW
    """
    grid_kw = (
        it_power_kw
        + cooling_electric_kw
        + other_kw
        + battery_charge_kw
        - battery_discharge_kw
        - renewable_used_kw
    )
    return max(0.0, grid_kw)


def compute_grid_energy_kwh(
    grid_power_kw: float,
    dt_hours: float,
) -> float:
    """
    Grid electricity consumption for a time step.

    E_grid = P_grid × Δt

    Args:
        grid_power_kw: Grid power in kW
        dt_hours: Time step duration in hours

    Returns:
        Energy in kWh
    """
    return grid_power_kw * dt_hours


def compute_pue(
    it_power_kw: float,
    facility_power_kw: float,
) -> float:
    """
    Power Usage Effectiveness.

    PUE = P_facility / P_IT

    Returns 1.0 if IT power is zero to avoid division by zero.
    """
    if it_power_kw <= 0:
        return 1.0
    return facility_power_kw / it_power_kw


def compute_water_litres(
    q_cooling_kw: float,
    dt_hours: float,
    ambient_temp_c: float,
    facility: FacilityConfig,
) -> float:
    """
    Water consumption for cooling.

    W = WaterCoeff(mode) × Q_cooling × Δt

    Evaporative cooling uses more water than free cooling.

    Args:
        q_cooling_kw: Thermal cooling load in kW
        dt_hours: Time step hours
        ambient_temp_c: Ambient temperature
        facility: Facility config

    Returns:
        Water consumed in litres
    """
    if ambient_temp_c < facility.free_cooling_threshold_c:
        coeff = facility.water_coeff_free_cooling
    else:
        coeff = facility.water_coeff_evaporative

    return coeff * q_cooling_kw * dt_hours


def compute_carbon_kg(
    grid_energy_kwh: float,
    carbon_intensity_kg_per_kwh: float,
) -> float:
    """
    Carbon emissions.

    C = E_grid × CarbonIntensity

    Args:
        grid_energy_kwh: Grid energy in kWh
        carbon_intensity_kg_per_kwh: Grid carbon intensity in kg CO2e/kWh

    Returns:
        Carbon emissions in kg CO2e
    """
    return grid_energy_kwh * carbon_intensity_kg_per_kwh


def compute_cost_usd(
    grid_energy_kwh: float,
    electricity_price_usd_per_kwh: float,
    other_costs_usd: float = 0.0,
) -> float:
    """
    Operating cost.

    Cost = E_grid × Price + OtherCosts

    Args:
        grid_energy_kwh: Grid energy in kWh
        electricity_price_usd_per_kwh: Electricity price
        other_costs_usd: Additional operating costs

    Returns:
        Cost in USD
    """
    return grid_energy_kwh * electricity_price_usd_per_kwh + other_costs_usd


def compute_thermal_dynamics(
    current_temp_c: float,
    heat_load_kw: float,
    cooling_thermal_kw: float,
    dt_hours: float,
    thermal_capacity_kwh_per_c: float,
) -> float:
    """
    First-order thermal dynamics.

    T(t+1) = T(t) + Δt × (P_heat - Q_cooling) / C_thermal

    Args:
        current_temp_c: Current temperature in °C
        heat_load_kw: Thermal heat load in kW
        cooling_thermal_kw: Thermal heat removal in kW
        dt_hours: Time step in hours
        thermal_capacity_kwh_per_c: Thermal capacity in kWh/°C

    Returns:
        New temperature in °C
    """
    if thermal_capacity_kwh_per_c <= 0:
        raise ValueError("Thermal capacity must be positive")

    delta_t = dt_hours * (heat_load_kw - cooling_thermal_kw) / thermal_capacity_kwh_per_c
    return current_temp_c + delta_t


def compute_battery_soc(
    current_soc_kwh: float,
    charge_kw: float,
    discharge_kw: float,
    dt_hours: float,
    eta_charge: float,
    eta_discharge: float,
) -> float:
    """
    Battery state of charge update.

    B(t+1) = B(t) + η_charge × P_charge × Δt - P_discharge × Δt / η_discharge

    Args:
        current_soc_kwh: Current state of charge in kWh
        charge_kw: Charging power in kW
        discharge_kw: Discharging power in kW
        dt_hours: Time step in hours
        eta_charge: Charging efficiency (0-1)
        eta_discharge: Discharging efficiency (0-1)

    Returns:
        New state of charge in kWh
    """
    if eta_discharge <= 0:
        raise ValueError("Discharge efficiency must be positive")

    energy_in = eta_charge * charge_kw * dt_hours
    energy_out = discharge_kw * dt_hours / eta_discharge
    return current_soc_kwh + energy_in - energy_out


def compute_useful_work_fraction(
    workload_served: float,
    workload_demanded: float,
) -> float:
    """
    Fraction of demanded workload that was actually served.

    UsefulCompute = served / demanded

    Returns 1.0 if demand is zero (no work requested = fully satisfied).
    """
    if workload_demanded <= 0:
        return 1.0
    return min(1.0, workload_served / workload_demanded)


def compute_risk_score(
    temp_c: float,
    battery_soc_kwh: float,
    facility: FacilityConfig,
) -> float:
    """
    Operational risk score (0 = safe, higher = riskier).

    Risk increases as temperature approaches limits or battery SOC drops.

    Risk = max(0, (T - T_setpoint) / (T_max - T_setpoint)) × 50
         + max(0, (min_soc - B) / min_soc) × 50

    Score is 0-100 scale.
    """
    # Temperature risk component
    temp_range = facility.temp_max_c - facility.temp_setpoint_c
    if temp_range > 0:
        temp_risk = max(0.0, (temp_c - facility.temp_setpoint_c) / temp_range) * 50.0
    else:
        temp_risk = 0.0

    # Battery risk component
    if facility.battery_enabled and facility.battery_min_soc_kwh > 0:
        soc_deficit = max(0.0, facility.battery_min_soc_kwh * 1.5 - battery_soc_kwh)
        battery_risk = (soc_deficit / (facility.battery_min_soc_kwh * 1.5)) * 50.0
    else:
        battery_risk = 0.0

    return min(100.0, temp_risk + battery_risk)


def compute_switching_penalty(
    current_action: float,
    previous_action: float,
) -> float:
    """
    Penalty for unnecessary switching of controls.

    SwitchingPenalty = |current - previous|

    Applied to workload fraction and cooling setpoint changes.
    """
    return abs(current_action - previous_action)


def compute_objective_score(
    energy_kwh: float,
    water_litres: float,
    carbon_kg: float,
    cost_usd: float,
    risk_score: float,
    useful_compute: float,
    switching_penalty: float,
    weights: 'ObjectiveWeights',
    norm: 'NormalizationRefs',
) -> float:
    """
    Multi-objective score for a single time step.

    J = wE × E/E_ref + wW × W/W_ref + wC × C/C_ref
      + wCost × Cost/Cost_ref + wR × Risk/Risk_ref
      - wU × UsefulCompute/Compute_ref
      + λ × SwitchingPenalty

    Lower is better.
    """
    score = (
        weights.w_energy * (energy_kwh / norm.energy_ref_kwh)
        + weights.w_water * (water_litres / norm.water_ref_litres)
        + weights.w_carbon * (carbon_kg / norm.carbon_ref_kg)
        + weights.w_cost * (cost_usd / norm.cost_ref_usd)
        + weights.w_risk * (risk_score / norm.risk_ref)
        - weights.w_useful_compute * (useful_compute / norm.compute_ref)
        + weights.w_switching * switching_penalty
    )
    return score
