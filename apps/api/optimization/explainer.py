"""
REGEN-DC Explainer
===================
Generates human-readable explanations of optimization results.
All text is derived from computed values — never hardcoded.
"""
from typing import Dict
from optimization.config import ExperimentConfig
from optimization.simulator import SimulationResult


def generate_explanation(
    results: Dict[str, SimulationResult],
    best_strategy_name: str,
    config: ExperimentConfig,
) -> str:
    """
    Generate an explanation of the optimization results.

    The explanation answers:
    1. Which strategy was selected?
    2. Was it proven optimal, feasible, or heuristic?
    3. Baseline vs selected strategy results
    4. Which metrics improved / worsened?
    5. Trade-off justification
    """
    if not results:
        return "No strategies were evaluated."

    baseline = None
    selected = None

    for key, res in results.items():
        if res.strategy_type == "baseline":
            baseline = res
        if res.strategy_name == best_strategy_name:
            selected = res

    if baseline is None:
        return "No baseline strategy was included in the comparison."

    if selected is None or best_strategy_name == "No feasible strategy found":
        return (
            "No feasible optimized strategy was found. All candidate strategies "
            "violated one or more hard constraints. The baseline remains the only "
            "feasible option. Review the constraint violation details for diagnostics."
        )

    # Build explanation
    lines = []

    # 1. Selection
    lines.append(
        f"**{selected.strategy_name}** was selected as the best strategy "
        f"because it achieved the lowest multi-objective score among feasible candidates."
    )

    # 2. Optimality
    if "Optimal" in selected.solver_status:
        lines.append(
            f"The solver (HiGHS) reported this solution as **optimal** "
            f"({selected.solver_status})."
        )
    elif "Heuristic" in selected.solver_status:
        lines.append(
            f"This result was produced by a **heuristic** algorithm — "
            f"no global optimality guarantee is claimed ({selected.solver_status})."
        )
    else:
        lines.append(
            f"Solver status: {selected.solver_status}. "
            f"The solution is feasible but may not be globally optimal."
        )

    # 3. Comparison metrics
    lines.append("\n**Comparison with Baseline:**\n")

    metrics = [
        ("Grid electricity consumption", "total_energy_kwh", "kWh", "lower"),
        ("Water consumption", "total_water_litres", "L", "lower"),
        ("Carbon emissions", "total_carbon_kg", "kg CO2e", "lower"),
        ("Operating cost", "total_cost_usd", "USD", "lower"),
        ("Useful work completed", "avg_useful_compute", "fraction", "higher"),
        ("Peak temperature", "peak_temperature_c", "°C", "lower"),
        ("Optimization score", "total_objective_score", "score", "lower"),
    ]

    improved = []
    worsened = []

    for label, attr, unit, direction in metrics:
        b_val = getattr(baseline, attr)
        s_val = getattr(selected, attr)

        if abs(b_val) > 1e-9:
            pct = 100.0 * (b_val - s_val) / abs(b_val)
            if direction == "higher":
                pct = -pct  # Invert for metrics where higher is better
        else:
            pct = 0.0

        b_str = f"{b_val:,.2f}" if b_val >= 100 else f"{b_val:.4f}"
        s_str = f"{s_val:,.2f}" if s_val >= 100 else f"{s_val:.4f}"

        if direction == "lower":
            is_better = s_val < b_val - 0.001
            is_worse = s_val > b_val + 0.001
            change_str = f"reduced by {abs(pct):.1f}%" if is_better else f"increased by {abs(pct):.1f}%"
        else:
            is_better = s_val > b_val + 0.001
            is_worse = s_val < b_val - 0.001
            change_str = f"improved by {abs(pct):.1f}%" if is_better else f"decreased by {abs(pct):.1f}%"

        if abs(pct) < 0.05:
            change_str = "unchanged"
            lines.append(f"- {label}: {b_str} → {s_str} {unit} ({change_str})")
        else:
            lines.append(f"- {label}: {b_str} → {s_str} {unit} ({change_str})")
            if is_better:
                improved.append(label)
            elif is_worse:
                worsened.append(label)

    # 4. Summary
    lines.append("")
    if improved:
        lines.append(f"✅ **Improved:** {', '.join(improved)}")
    if worsened:
        lines.append(f"⚠️ **Worsened:** {', '.join(worsened)}")
    if not improved and not worsened:
        lines.append("The optimized strategy produced results similar to the baseline.")

    # 5. Safety
    if selected.safety_passed:
        lines.append(
            "\n✅ All hard constraints (temperature, power, battery, workload) "
            "passed independent safety validation."
        )
    else:
        violations_summary = ", ".join(set(
            v.get("constraint", "unknown") for v in selected.constraint_violations
        ))
        lines.append(
            f"\n⚠️ Safety validation flagged constraint violations: {violations_summary}. "
            f"Review the constraint comparison table for details."
        )

    # 6. Trade-off
    if worsened and improved:
        lines.append(
            f"\nThe recommendation reflects the configured trade-off between objectives. "
            f"While {', '.join(worsened)} increased slightly, the improvement in "
            f"{', '.join(improved)} produced a net lower multi-objective score "
            f"under the current weight configuration."
        )

    # 7. Limitations
    lines.append(
        "\n**Note:** These results are from modeled simulations with the configured "
        "facility parameters and scenario inputs. Real-world performance depends on "
        "actual equipment characteristics, weather conditions, and grid carbon intensity. "
        "The thermal model uses a first-order approximation. COP is ambient-dependent "
        "and pre-computed per time step."
    )

    return "\n".join(lines)
