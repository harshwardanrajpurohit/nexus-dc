"""
REGEN-DC Configuration Module
=============================
All constants, normalization references, objective weights, and constraint limits.

Units:
  - Power: kW
  - Energy: kWh
  - Temperature: °C
  - Water: litres (L)
  - Carbon: kg CO2e
  - Cost: USD (modeled)
  - Time step: hours (default 1 hour)
"""
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class FacilityConfig:
    """Physical parameters of the data center facility."""
    # --- IT Load ---
    num_gpu_racks: int = 1400          # Simplified: 10 buildings × 2 GPU halls × 14 rows × 10 racks = 1400 modeled
    num_cpu_racks: int = 2000          # Simplified: 10 CPU halls × 20 rows × 10 racks = 2000 modeled
    gpu_rack_max_kw: float = 132.0     # GB200 NVL72 max
    gpu_rack_idle_kw: float = 30.0     # Idle power
    cpu_rack_max_kw: float = 15.0
    cpu_rack_idle_kw: float = 5.0
    total_it_capacity_kw: float = 0.0  # Computed on init

    # --- Facility ---
    grid_capacity_mw: float = 1150.0
    pue_base: float = 1.118
    pue_degraded: float = 1.25         # Under CDU failure
    overhead_fraction: float = 0.02    # Lighting, networking, misc as fraction of IT

    # --- Cooling ---
    cop_nominal: float = 5.5           # Coefficient of Performance (electric chiller)
    cop_free_cooling: float = 15.0     # When ambient allows free cooling
    ambient_temp_c: float = 30.0       # Default ambient
    free_cooling_threshold_c: float = 18.0  # Ambient below this enables free cooling
    max_cooling_capacity_kw: float = 300000.0  # Thermal capacity
    coolant_flow_nominal_lpm: float = 527820.0

    # --- Thermal ---
    thermal_capacity_kwh_per_c: float = 50000.0  # Effective thermal mass
    temp_setpoint_c: float = 22.0
    temp_max_c: float = 35.0           # Hard constraint: max inlet temperature
    temp_min_c: float = 15.0           # Hard constraint: min inlet temperature

    # --- Water ---
    water_coeff_evaporative: float = 2.5   # litres per kWh of thermal cooling
    water_coeff_free_cooling: float = 0.1  # litres per kWh (dry cooler, minimal)
    water_budget_litres: Optional[float] = None  # None = unlimited

    # --- Battery / Energy Storage ---
    battery_enabled: bool = True
    battery_capacity_kwh: float = 160000.0   # 160 MWh
    battery_max_charge_kw: float = 80000.0   # 80 MW
    battery_max_discharge_kw: float = 80000.0
    battery_efficiency_charge: float = 0.92
    battery_efficiency_discharge: float = 0.92
    battery_min_soc_kwh: float = 32000.0     # 20% minimum reserve
    battery_initial_soc_kwh: float = 80000.0 # 50% initial

    def __post_init__(self):
        self.total_it_capacity_kw = (
            self.num_gpu_racks * self.gpu_rack_max_kw
            + self.num_cpu_racks * self.cpu_rack_max_kw
        )


@dataclass
class ObjectiveWeights:
    """
    Multi-objective weights. All non-negative.
    UsefulCompute weight is subtracted (we want to maximize it).
    """
    w_energy: float = 1.0
    w_water: float = 1.0
    w_carbon: float = 1.0
    w_cost: float = 1.0
    w_risk: float = 0.5
    w_useful_compute: float = 2.0   # Higher weight encourages work completion
    w_switching: float = 0.1        # Penalize excessive control changes

    def validate(self):
        for attr in ['w_energy', 'w_water', 'w_carbon', 'w_cost', 'w_risk',
                      'w_useful_compute', 'w_switching']:
            val = getattr(self, attr)
            if val < 0:
                raise ValueError(f"Weight {attr} must be non-negative, got {val}")


@dataclass
class NormalizationRefs:
    """
    Reference values for normalizing heterogeneous metrics.
    Derived from facility capacity at full load for 1 hour.
    Must remain identical across all strategies in an experiment.
    """
    energy_ref_kwh: float = 300000.0     # ~300 MW-hr (facility at moderate load × 1 hr)
    water_ref_litres: float = 500000.0   # Reference water per step
    carbon_ref_kg: float = 150000.0      # At ~0.5 kg/kWh grid intensity
    cost_ref_usd: float = 30000.0        # At ~$0.10/kWh
    risk_ref: float = 100.0              # Risk score reference
    compute_ref: float = 1.0             # Fraction: 1.0 = all demand met

    def validate(self):
        for attr in ['energy_ref_kwh', 'water_ref_litres', 'carbon_ref_kg',
                      'cost_ref_usd', 'risk_ref', 'compute_ref']:
            val = getattr(self, attr)
            if val <= 0:
                raise ValueError(f"Normalization ref {attr} must be positive, got {val}")


@dataclass
class ScenarioInputs:
    """
    Time-varying external inputs for the simulation horizon.
    Each list has length = num_steps.
    """
    num_steps: int = 24
    dt_hours: float = 1.0               # Time step duration

    # Workload demand per step (as fraction of IT capacity, 0.0 to 1.0)
    workload_demand: list = field(default_factory=list)
    # Which fraction of demand is mandatory (must be served)
    mandatory_fraction: list = field(default_factory=list)
    # Workload deadlines: by which step must deferred work be completed (None=flexible)
    workload_deadlines: list = field(default_factory=list)

    # External conditions
    ambient_temp_c: list = field(default_factory=list)
    carbon_intensity_kg_per_kwh: list = field(default_factory=list)
    electricity_price_usd_per_kwh: list = field(default_factory=list)

    # Renewable generation available (kW)
    renewable_kw: list = field(default_factory=list)

    # Random seed for reproducibility
    random_seed: int = 42

    def __post_init__(self):
        if not self.workload_demand:
            self._generate_defaults()

    def _generate_defaults(self):
        """Generate a realistic 24-hour profile."""
        import math
        n = self.num_steps

        self.workload_demand = []
        self.mandatory_fraction = []
        self.workload_deadlines = []
        self.ambient_temp_c = []
        self.carbon_intensity_kg_per_kwh = []
        self.electricity_price_usd_per_kwh = []
        self.renewable_kw = []

        for t in range(n):
            hour = (t * self.dt_hours) % 24

            # Workload: higher during business hours
            base_load = 0.4  # 40% base
            business_surge = 0.25 * max(0, math.sin(math.pi * (hour - 6) / 12)) if 6 <= hour <= 18 else 0
            ai_burst = 0.15 * max(0, math.sin(math.pi * (hour - 20) / 8)) if hour >= 20 or hour <= 4 else 0
            demand = min(1.0, base_load + business_surge + ai_burst)
            self.workload_demand.append(round(demand, 4))
            self.mandatory_fraction.append(0.7)  # 70% mandatory
            self.workload_deadlines.append(None)  # No strict deadline for deferred

            # Ambient temperature: diurnal cycle
            temp = 28.0 + 7.0 * math.sin(math.pi * (hour - 6) / 12) if 6 <= hour <= 18 else 22.0
            self.ambient_temp_c.append(round(temp, 1))

            # Carbon intensity: higher during peak, lower at night (wind)
            carbon = 0.45 + 0.15 * math.sin(math.pi * (hour - 8) / 10) if 8 <= hour <= 18 else 0.35
            self.carbon_intensity_kg_per_kwh.append(round(carbon, 4))

            # Electricity price: time-of-use
            if 8 <= hour <= 12 or 17 <= hour <= 21:
                price = 0.12  # Peak
            elif 6 <= hour <= 22:
                price = 0.08  # Shoulder
            else:
                price = 0.05  # Off-peak
            self.electricity_price_usd_per_kwh.append(price)

            # Renewable: solar bell curve
            solar = 50000 * max(0, math.sin(math.pi * (hour - 6) / 12)) if 6 <= hour <= 18 else 0
            self.renewable_kw.append(round(solar, 0))


@dataclass
class ConstraintLimits:
    """Hard constraint limits that cannot be violated."""
    max_facility_power_kw: float = 1150000.0  # 1.15 GW grid capacity
    max_it_power_kw: float = 0.0              # Computed from facility config
    temp_max_c: float = 35.0
    temp_min_c: float = 15.0
    min_battery_soc_kwh: float = 32000.0
    max_battery_soc_kwh: float = 160000.0
    max_battery_charge_kw: float = 80000.0
    max_battery_discharge_kw: float = 80000.0
    min_workload_completion: float = 1.0       # 100% of mandatory work
    max_cooling_capacity_kw: float = 300000.0  # Thermal


@dataclass
class ExperimentConfig:
    """Complete configuration for a comparison experiment."""
    facility: FacilityConfig = field(default_factory=FacilityConfig)
    weights: ObjectiveWeights = field(default_factory=ObjectiveWeights)
    normalization: NormalizationRefs = field(default_factory=NormalizationRefs)
    scenario: ScenarioInputs = field(default_factory=ScenarioInputs)
    constraints: ConstraintLimits = field(default_factory=ConstraintLimits)
    mpc_horizon: int = 6               # MPC look-ahead steps
    solver_time_limit_s: float = 30.0   # Per MPC solve

    def __post_init__(self):
        self.constraints.max_it_power_kw = self.facility.total_it_capacity_kw
        self.weights.validate()
        self.normalization.validate()
