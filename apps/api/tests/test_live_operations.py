"""
NEXUS DC — Live Operations & Manual Thermal Control Test Suite
=============================================================
Tests closed-loop AUTO thermal control, manual cooling overrides, safety interlocks,
emergency protection override, command audit logs, and alarm management.
"""
import time
from simulation.engine import SimulationEngine


def test_topology_loading_and_cdu_rack_linkage():
    """Verify CDUs and racks are loaded with control parameters and linked correctly."""
    engine = SimulationEngine()
    engine.load_topology()

    assert len(engine.topology["cdus"]) > 0, "Must have CDUs loaded"
    assert len(engine.topology["racks"]) > 0, "Must have Racks loaded"

    sample_cdu = next(iter(engine.topology["cdus"].values()))
    assert "operating_mode" in sample_cdu
    assert "fan_speed_percent" in sample_cdu
    assert "setpoint_c" in sample_cdu
    assert sample_cdu["operating_mode"] == "AUTO"
    assert sample_cdu["power_state"] == "ON"
    assert len(sample_cdu["connected_racks"]) > 0, "CDU must have connected racks"


def test_auto_mode_closed_loop_fan_modulation():
    """Verify AUTO mode increases fan speed when temperatures rise."""
    engine = SimulationEngine()
    engine.load_topology()

    cdu_id = next(iter(engine.topology["cdus"].keys()))
    cdu = engine.topology["cdus"][cdu_id]

    # Baseline tick
    engine.tick()
    initial_fan = cdu["fan_speed_percent"]

    # Artificially raise temperatures of connected racks to simulate sudden workload surge
    for r_id in cdu["connected_racks"]:
        engine.topology["racks"][r_id]["temp_c"] = 65.0

    # Execute several ticks in AUTO mode
    for _ in range(5):
        engine.tick()

    assert cdu["fan_speed_percent"] > initial_fan, "AUTO mode must ramp up fan speed when temperatures rise"
    assert cdu["fan_rpm"] == int(cdu["fan_speed_percent"] * 36)


def test_manual_mode_override_persistence():
    """Verify operator manual settings persist across simulation ticks."""
    engine = SimulationEngine()
    engine.load_topology()

    cdu_id = next(iter(engine.topology["cdus"].keys()))

    # Apply manual override: 85% fan speed, 20.0°C setpoint
    res = engine.apply_cooling_command(
        cdu_id=cdu_id,
        mode="MANUAL",
        power_state="ON",
        fan_speed_percent=85.0,
        setpoint_c=20.0,
        operator="Chief Facility Engineer"
    )

    assert res["success"] is True
    assert res["status"] == "APPLIED"
    assert res["cdu"]["operating_mode"] == "MANUAL"
    assert res["cdu"]["fan_speed_percent"] == 85.0

    # Advance 5 simulation ticks
    for _ in range(5):
        engine.tick()

    cdu = engine.topology["cdus"][cdu_id]
    assert cdu["operating_mode"] == "MANUAL", "MANUAL mode must not automatically revert"
    assert cdu["fan_speed_percent"] == 85.0, "Manual fan speed must persist"


def test_shutting_down_cooling_causes_temperature_rise():
    """Verify turning off cooling causes rack temperature to escalate."""
    engine = SimulationEngine()
    engine.load_topology()

    cdu_id = next(iter(engine.topology["cdus"].keys()))
    cdu = engine.topology["cdus"][cdu_id]
    rack_id = cdu["connected_racks"][0]
    initial_temp = engine.topology["racks"][rack_id]["temp_c"]

    # Turn cooling OFF with explicit force_override
    res = engine.apply_cooling_command(
        cdu_id=cdu_id,
        mode="MANUAL",
        power_state="OFF",
        fan_speed_percent=0.0,
        force_override=True,
    )
    assert res["success"] is True

    # Advance simulation ticks
    for _ in range(8):
        engine.tick()

    new_temp = engine.topology["racks"][rack_id]["temp_c"]
    assert new_temp > initial_temp, "Rack temperature must rise when cooling is disabled"


def test_safety_interlock_emergency_override():
    """Verify automated emergency protection kicks in when temperature hits critical emergency limit."""
    engine = SimulationEngine()
    engine.load_topology()

    cdu_id = next(iter(engine.topology["cdus"].keys()))
    cdu = engine.topology["cdus"][cdu_id]

    # Force manual minimum fan
    engine.apply_cooling_command(cdu_id=cdu_id, mode="MANUAL", fan_speed_percent=10.0, force_override=True)

    # Force connected rack to breach emergency limit (95.0 C)
    rack_id = cdu["connected_racks"][0]
    engine.topology["racks"][rack_id]["temp_c"] = 96.5

    # Run tick: safety interlock should trigger!
    engine.tick()

    assert cdu["emergency_override"] is True, "Emergency override flag must be True"
    assert cdu["operating_mode"] == "AUTO", "Mode must be forced to AUTO"
    assert cdu["power_state"] == "ON", "Power must be forced ON"
    assert cdu["fan_speed_percent"] == 100.0, "Fan speed must be forced to 100%"
    assert "SAFETY OVERRIDE" in cdu["override_reason"]


def test_command_validation_rejects_out_of_range_values():
    """Verify validator rejects invalid fan speed and temperature setpoints."""
    engine = SimulationEngine()
    engine.load_topology()

    cdu_id = next(iter(engine.topology["cdus"].keys()))

    # Fan speed > 100%
    res = engine.apply_cooling_command(cdu_id=cdu_id, fan_speed_percent=145.0)
    assert res["success"] is False
    assert "out of valid range" in res["reason"]

    # Setpoint < 15 C
    res = engine.apply_cooling_command(cdu_id=cdu_id, setpoint_c=5.0)
    assert res["success"] is False
    assert "outside safety limits" in res["reason"]


def test_command_history_and_impact_metrics():
    """Verify command audit history captures before/after impact snapshots."""
    engine = SimulationEngine()
    engine.load_topology()

    cdu_id = next(iter(engine.topology["cdus"].keys()))
    res = engine.apply_cooling_command(cdu_id=cdu_id, mode="MANUAL", fan_speed_percent=75.0)

    assert "before" in res
    assert "after" in res
    assert "cooling_power_delta_kw" in res["after"]
    assert len(engine.command_history) > 0
    assert engine.command_history[0]["cdu_id"] == cdu_id


def test_alarm_management_and_acknowledgement():
    """Verify alarms trigger properly and can be acknowledged."""
    engine = SimulationEngine()
    engine.load_topology()

    engine._trigger_alarm(
        source="TEST-CDU-01",
        severity="WARNING",
        title="Test Thermal Warning",
        message="Simulated warning condition"
    )

    alarm_id = "ALM-TEST-CDU-01-WARNING"
    assert alarm_id in engine.active_alarms
    assert engine.active_alarms[alarm_id]["acknowledged"] is False

    ack_ok = engine.acknowledge_alarm(alarm_id)
    assert ack_ok is True
    assert engine.active_alarms[alarm_id]["acknowledged"] is True


if __name__ == "__main__":
    tests = [
        test_topology_loading_and_cdu_rack_linkage,
        test_auto_mode_closed_loop_fan_modulation,
        test_manual_mode_override_persistence,
        test_shutting_down_cooling_causes_temperature_rise,
        test_safety_interlock_emergency_override,
        test_command_validation_rejects_out_of_range_values,
        test_command_history_and_impact_metrics,
        test_alarm_management_and_acknowledgement,
    ]
    print(f"Executing {len(tests)} Live Operations & Thermal Control tests...")
    for t in tests:
        t()
        print(f" [PASS] {t.__name__}")
    print("\nALL 8 LIVE OPERATIONS & THERMAL CONTROL TESTS PASSED SUCCESSFULLY!")

