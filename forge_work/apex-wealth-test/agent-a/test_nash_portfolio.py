#!/usr/bin/env python3
"""
test_nash_portfolio.py
HYPOTHESIS: Nash product (multiplicative) portfolio optimization produces
more balanced allocations than additive weighted-sum.

Compares:
  ADDITIVE: max Σ(w_i * r_i) - 0.5 * w^T Σ w
  NASH:     max Σ(w_i * ln(r_i * w_i + ε)) - 0.5 * w^T Σ w

Solvers: IPOPT (nonlinear), GLPK (linear), CBC (MILP)
DITEMPA BUKAN DIBERI
"""

import sys
import json
import numpy as np
from datetime import datetime, timezone

# ── Check Pyomo + IPOPT ──────────────────────────────────────────────
try:
    import pyomo.environ as pyo
    from pyomo.opt import SolverStatus, TerminationCondition
except ImportError:
    print("ERROR: Pyomo not installed. Run: pip install pyomo")
    sys.exit(1)

# Check IPOPT availability
_ipopt_available = False
try:
    _ipopt_solver = pyo.SolverFactory("ipopt")
    if _ipopt_solver.available():
        _ipopt_available = True
except Exception:
    pass

if not _ipopt_available:
    print(
        "ERROR: IPOPT solver not available. Run: apt install coinor-ipopt || pip install idaes-pse"
    )
    sys.exit(1)

# ── Problem Data ──────────────────────────────────────────────────────
N = 5
RETURNS = np.array([0.12, 0.08, 0.15, 0.06, 0.10])
COV_DIAG = np.array([0.04, 0.02, 0.06, 0.01, 0.03])
COV = np.diag(COV_DIAG)
W_MAX = 0.4
W_MIN = 0.0
EPS = 1e-8  # log safety

np.random.seed(42)
N_SCENARIOS = 1000

# Monte Carlo: sample returns from multivariate normal
scenarios = np.random.multivariate_normal(RETURNS, COV, size=N_SCENARIOS)


def build_additive_model():
    """ADDITIVE: max Σ(w_i * r_i) - 0.5 * w^T Σ w"""
    m = pyo.ConcreteModel("additive_portfolio")
    m.I = pyo.RangeSet(0, N - 1)
    m.w = pyo.Var(m.I, bounds=(W_MIN, W_MAX))

    def obj_rule(m):
        linear = sum(m.w[i] * RETURNS[i] for i in m.I)
        risk = 0.5 * sum(m.w[i] * COV[i, j] * m.w[j] for i in m.I for j in m.I)
        return linear - risk

    m.obj = pyo.Objective(rule=obj_rule, sense=pyo.maximize)

    def budget_rule(m):
        return sum(m.w[i] for i in m.I) == 1.0

    m.budget = pyo.Constraint(rule=budget_rule)
    return m


def build_nash_model():
    """NASH: max Σ(w_i * ln(r_i * w_i + ε)) - 0.5 * w^T Σ w"""
    m = pyo.ConcreteModel("nash_portfolio")
    m.I = pyo.RangeSet(0, N - 1)
    # Lower bound > 0 for log feasibility
    m.w = pyo.Var(m.I, bounds=(1e-6, W_MAX))

    def obj_rule(m):
        nash_term = sum(m.w[i] * pyo.log(RETURNS[i] * m.w[i] + EPS) for i in m.I)
        risk = 0.5 * sum(m.w[i] * COV[i, j] * m.w[j] for i in m.I for j in m.I)
        return nash_term - risk

    m.obj = pyo.Objective(rule=obj_rule, sense=pyo.maximize)

    def budget_rule(m):
        return sum(m.w[i] for i in m.I) == 1.0

    m.budget = pyo.Constraint(rule=budget_rule)
    return m


def solve_model(model, label):
    """Solve with IPOPT, return weights dict."""
    solver = pyo.SolverFactory("ipopt")
    solver.options["max_iter"] = 5000
    solver.options["tol"] = 1e-10
    result = solver.solve(model, tee=False)

    status = result.solver.status
    tc = result.solver.termination_condition
    if tc not in (TerminationCondition.optimal, TerminationCondition.feasible):
        print(f"  WARNING [{label}]: solver status={status}, tc={tc}")

    weights = {i: pyo.value(model.w[i]) for i in model.I}
    return weights


def compute_metrics(weights_arr, label):
    """Compute portfolio metrics from weight array."""
    exp_ret = weights_arr @ RETURNS
    port_var = weights_arr @ COV @ weights_arr
    port_std = np.sqrt(port_var)
    sharpe = exp_ret / port_std if port_std > 1e-12 else 0.0
    hhi = np.sum(weights_arr**2)
    max_weight = np.max(weights_arr)
    min_weight = np.min(weights_arr)

    # Monte Carlo scenario returns
    mc_returns = scenarios @ weights_arr
    mc_mean = np.mean(mc_returns)
    mc_std = np.std(mc_returns)
    mc_sharpe = mc_mean / mc_std if mc_std > 1e-12 else 0.0
    mc_worst = np.min(mc_returns)
    mc_var_5 = np.percentile(mc_returns, 5)  # 5th percentile (VaR)

    return {
        "label": label,
        "weights": weights_arr.tolist(),
        "exp_return": exp_ret,
        "port_vol": port_std,
        "analytic_sharpe": sharpe,
        "hhi": hhi,
        "max_weight": max_weight,
        "min_weight": min_weight,
        "mc_mean_return": mc_mean,
        "mc_vol": mc_std,
        "mc_sharpe": mc_sharpe,
        "mc_worst_case": mc_worst,
        "mc_var_5pct": mc_var_5,
        "n_effective": 1.0 / hhi if hhi > 1e-12 else 0.0,
    }


def print_table(add_metrics, nash_metrics):
    """Print comparison table."""
    rows = [
        ("Expected Return", "exp_return", ".4f"),
        ("Portfolio Volatility", "port_vol", ".4f"),
        ("Analytic Sharpe", "analytic_sharpe", ".4f"),
        ("HHI (concentration)", "hhi", ".4f"),
        ("Max Weight", "max_weight", ".4f"),
        ("Min Weight", "min_weight", ".4f"),
        ("Effective # Assets (1/HHI)", "n_effective", ".2f"),
        ("MC Mean Return", "mc_mean_return", ".4f"),
        ("MC Volatility", "mc_vol", ".4f"),
        ("MC Sharpe", "mc_sharpe", ".4f"),
        ("MC Worst Case", "mc_worst_case", ".4f"),
        ("MC 5% VaR", "mc_var_5pct", ".4f"),
    ]

    hdr = f"{'Metric':<30} {'ADDITIVE':>12} {'NASH':>12} {'Delta':>12} {'Verdict':>10}"
    sep = "─" * 80
    print(sep)
    print(hdr)
    print(sep)

    verdicts = {"nash_wins": 0, "add_wins": 0, "tie": 0}

    for name, key, fmt in rows:
        av = add_metrics[key]
        nv = nash_metrics[key]
        delta = nv - av

        # For HHI, max_weight: lower is better (more balanced)
        if key in ("hhi", "max_weight", "mc_worst_case"):
            if delta < -1e-4:
                verdict = "NASH ✓"
                verdicts["nash_wins"] += 1
            elif delta > 1e-4:
                verdict = "ADD ✓"
                verdicts["add_wins"] += 1
            else:
                verdict = "TIE"
                verdicts["tie"] += 1
        elif key == "min_weight":
            if delta > 1e-4:
                verdict = "NASH ✓"
                verdicts["nash_wins"] += 1
            elif delta < -1e-4:
                verdict = "ADD ✓"
                verdicts["add_wins"] += 1
            else:
                verdict = "TIE"
                verdicts["tie"] += 1
        else:
            # Higher is better
            if delta > 1e-4:
                verdict = "NASH ✓"
                verdicts["nash_wins"] += 1
            elif delta < -1e-4:
                verdict = "ADD ✓"
                verdicts["add_wins"] += 1
            else:
                verdict = "TIE"
                verdicts["tie"] += 1

        print(f"{name:<30} {av:>12{fmt}} {nv:>12{fmt}} {delta:>+12{fmt}} {verdict:>10}")

    print(sep)
    return verdicts


def main():
    print("=" * 80)
    print("NASH PRODUCT vs ADDITIVE PORTFOLIO OPTIMIZATION")
    print(f"Assets: {N} | Scenarios: {N_SCENARIOS} | Solver: IPOPT")
    print(f"Returns: {RETURNS.tolist()}")
    print(f"Covariance (diagonal): {COV_DIAG.tolist()}")
    print(f"Constraints: Σw=1, 0≤w_i≤{W_MAX}")
    print("=" * 80)
    print()

    # ── Solve ADDITIVE ────────────────────────────────────────────
    print("[1/4] Solving ADDITIVE portfolio...")
    add_model = build_additive_model()
    add_weights_dict = solve_model(add_model, "ADDITIVE")
    add_weights = np.array([add_weights_dict[i] for i in range(N)])
    add_metrics = compute_metrics(add_weights, "ADDITIVE")

    print(f"  Weights: {np.round(add_weights, 4).tolist()}")
    print(f"  Sum: {np.sum(add_weights):.6f}")
    print()

    # ── Solve NASH ────────────────────────────────────────────────
    print("[2/4] Solving NASH product portfolio...")
    nash_model = build_nash_model()
    nash_weights_dict = solve_model(nash_model, "NASH")
    nash_weights = np.array([nash_weights_dict[i] for i in range(N)])
    nash_metrics = compute_metrics(nash_weights, "NASH")

    print(f"  Weights: {np.round(nash_weights, 4).tolist()}")
    print(f"  Sum: {np.sum(nash_weights):.6f}")
    print()

    # ── Comparison Table ──────────────────────────────────────────
    print("[3/4] Comparison (analytic + 1000 MC scenarios):")
    print()
    verdicts = print_table(add_metrics, nash_metrics)
    print()

    # ── Weight Distribution ───────────────────────────────────────
    print("[4/4] Weight distribution:")
    print()
    print(f"  {'Asset':<8} {'Return':>8} {'ADD w':>10} {'NASH w':>10} {'Delta':>10}")
    print("  " + "─" * 50)
    for i in range(N):
        d = nash_weights[i] - add_weights[i]
        print(
            f"  A{i:<6} {RETURNS[i]:>8.2f} {add_weights[i]:>10.4f} {nash_weights[i]:>10.4f} {d:>+10.4f}"
        )

    print()

    # ── Verdict ───────────────────────────────────────────────────
    nash_total = verdicts["nash_wins"]
    add_total = verdicts["add_wins"]
    tie_total = verdicts["tie"]

    print("=" * 80)
    print("VERDICT")
    print("=" * 80)

    hhi_improvement = (
        (add_metrics["hhi"] - nash_metrics["hhi"]) / add_metrics["hhi"] * 100
    )
    effective_gain = nash_metrics["n_effective"] - add_metrics["n_effective"]
    sharpe_delta = nash_metrics["mc_sharpe"] - add_metrics["mc_sharpe"]

    if nash_total > add_total:
        hypothesis_supported = True
        print(
            f"  HYPOTHESIS SUPPORTED: Nash product optimization wins {nash_total}/{nash_total + add_total + tie_total} metrics."
        )
    elif add_total > nash_total:
        hypothesis_supported = False
        print(
            f"  HYPOTHESIS NOT SUPPORTED: Additive wins {add_total}/{nash_total + add_total + tie_total} metrics."
        )
    else:
        hypothesis_supported = None
        print(
            f"  INCONCLUSIVE: Nash={nash_total}, Additive={add_total}, Tie={tie_total}"
        )

    print(f"  HHI reduction: {hhi_improvement:+.2f}% (lower = more balanced)")
    print(
        f"  Effective assets (1/HHI): {add_metrics['n_effective']:.2f} → {nash_metrics['n_effective']:.2f} (Δ={effective_gain:+.2f})"
    )
    print(f"  Sharpe delta: {sharpe_delta:+.4f}")
    print(
        f"  Worst-case delta: {nash_metrics['mc_worst_case'] - add_metrics['mc_worst_case']:+.4f}"
    )
    print()

    # ── Save RESULTS.md ──────────────────────────────────────────
    results = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "hypothesis": "Nash product (multiplicative) portfolio optimization produces more balanced allocations than additive weighted-sum",
        "hypothesis_supported": hypothesis_supported,
        "config": {
            "n_assets": N,
            "returns": RETURNS.tolist(),
            "cov_diag": COV_DIAG.tolist(),
            "w_max": W_MAX,
            "n_scenarios": N_SCENARIOS,
            "solver": "IPOPT",
        },
        "additive": add_metrics,
        "nash": nash_metrics,
        "verdicts": verdicts,
        "summary": {
            "hhi_improvement_pct": hhi_improvement,
            "effective_assets_gain": effective_gain,
            "sharpe_delta": sharpe_delta,
        },
    }

    md = []
    md.append("# Nash Product vs Additive Portfolio Optimization — Results")
    md.append("")
    md.append(f"**Timestamp:** {results['timestamp']}")
    md.append(f"**Solver:** IPOPT (nonlinear)")
    md.append(f"**Scenarios:** {N_SCENARIOS} Monte Carlo")
    md.append("")
    md.append("## Hypothesis")
    md.append("")
    md.append(f"> {results['hypothesis']}")
    md.append("")
    if hypothesis_supported:
        md.append("**Result: SUPPORTED** ✅")
    elif hypothesis_supported is False:
        md.append("**Result: NOT SUPPORTED** ❌")
    else:
        md.append("**Result: INCONCLUSIVE** ⚠️")
    md.append("")
    md.append("## Configuration")
    md.append("")
    md.append(f"- Assets: {N}")
    md.append(f"- Returns: {RETURNS.tolist()}")
    md.append(f"- Covariance (diagonal): {COV_DIAG.tolist()}")
    md.append(f"- Constraints: Σw=1, 0≤w_i≤{W_MAX}")
    md.append("")
    md.append("## Weight Allocation")
    md.append("")
    md.append("| Asset | Return | ADD w | NASH w | Delta |")
    md.append("|-------|--------|-------|--------|-------|")
    for i in range(N):
        d = nash_weights[i] - add_weights[i]
        md.append(
            f"| A{i} | {RETURNS[i]:.2f} | {add_weights[i]:.4f} | {nash_weights[i]:.4f} | {d:+.4f} |"
        )
    md.append("")
    md.append("## Metrics Comparison")
    md.append("")
    md.append("| Metric | ADDITIVE | NASH | Delta | Verdict |")
    md.append("|--------|----------|------|-------|---------|")

    metric_rows = [
        ("Expected Return", "exp_return", ".4f"),
        ("Portfolio Volatility", "port_vol", ".4f"),
        ("Analytic Sharpe", "analytic_sharpe", ".4f"),
        ("HHI (concentration)", "hhi", ".4f"),
        ("Max Weight", "max_weight", ".4f"),
        ("Min Weight", "min_weight", ".4f"),
        ("Effective # Assets (1/HHI)", "n_effective", ".2f"),
        ("MC Mean Return", "mc_mean_return", ".4f"),
        ("MC Volatility", "mc_vol", ".4f"),
        ("MC Sharpe", "mc_sharpe", ".4f"),
        ("MC Worst Case", "mc_worst_case", ".4f"),
        ("MC 5% VaR", "mc_var_5pct", ".4f"),
    ]

    for name, key, fmt in metric_rows:
        av = add_metrics[key]
        nv = nash_metrics[key]
        delta = nv - av
        if key in ("hhi", "max_weight", "mc_worst_case"):
            v = "NASH ✓" if delta < -1e-4 else ("ADD ✓" if delta > 1e-4 else "TIE")
        elif key == "min_weight":
            v = "NASH ✓" if delta > 1e-4 else ("ADD ✓" if delta < -1e-4 else "TIE")
        else:
            v = "NASH ✓" if delta > 1e-4 else ("ADD ✓" if delta < -1e-4 else "TIE")
        md.append(f"| {name} | {av:{fmt}} | {nv:{fmt}} | {delta:+{fmt}} | {v} |")

    md.append("")
    md.append("## Summary")
    md.append("")
    md.append(f"- **HHI reduction:** {hhi_improvement:+.2f}% (lower = more balanced)")
    md.append(
        f"- **Effective assets (1/HHI):** {add_metrics['n_effective']:.2f} → {nash_metrics['n_effective']:.2f} (Δ={effective_gain:+.2f})"
    )
    md.append(f"- **Sharpe delta (MC):** {sharpe_delta:+.4f}")
    md.append(
        f"- **Worst-case delta:** {nash_metrics['mc_worst_case'] - add_metrics['mc_worst_case']:+.4f}"
    )
    md.append(
        f"- **Metric wins:** Nash={nash_total}, Additive={add_total}, Tie={tie_total}"
    )
    md.append("")

    if hypothesis_supported:
        md.append("### Conclusion")
        md.append("")
        md.append(
            "The Nash product objective (multiplicative) produces **more balanced** allocations "
        )
        md.append(
            "than the additive weighted-sum objective. The log-transform in the Nash objective "
        )
        md.append(
            "acts as a concavity penalty that naturally pushes weights toward equality — "
        )
        md.append(
            "akin to a 'diversification bonus' built into the objective function itself."
        )
    elif hypothesis_supported is False:
        md.append("### Conclusion")
        md.append("")
        md.append(
            "The Nash product objective did **not** outperform the additive objective on balance. "
        )
        md.append(
            "Possible explanations: the risk penalty (0.5 * w^T Σ w) dominates, or the "
        )
        md.append(
            "diagonal covariance structure is too simple for the log-transform to show its advantage. "
        )
        md.append(
            "Nash diversification benefits typically emerge with correlated assets or "
        )
        md.append("when the return-to-risk ratio varies significantly across assets.")
    else:
        md.append("### Conclusion")
        md.append("")
        md.append("Results are inconclusive — neither approach clearly dominates.")

    md.append("")
    md.append("---")
    md.append(f"*Generated by test_nash_portfolio.py | DITEMPA BUKAN DIBERI*")

    results_path = "/root/A-FORGE/forge_work/apex-wealth-test/agent-a/RESULTS.md"
    with open(results_path, "w") as f:
        f.write("\n".join(md))
    print(f"Results saved to: {results_path}")

    return results


if __name__ == "__main__":
    main()
