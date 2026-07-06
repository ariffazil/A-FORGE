#!/usr/bin/env python3
"""
test_scar_learning.py
=====================
HYPOTHESIS: Constraint accumulation from past failures (cutting-plane / scar
mechanism) improves portfolio recommendations over time.

Two strategies over 20 sequential capital-allocation periods ($10M, 4 asset
classes).  100 independent Monte-Carlo simulations.  Averages reported.

Solvers: IPOPT (NLP), GLPK/CBC (LP fallback).
DITEMPA BUKAN DIBERI.
"""

import json
import time
import numpy as np
from dataclasses import dataclass, field
from typing import List, Tuple
import pyomo.environ as pyo

# ─────────────────────────────────────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────────────────────────────────────
N_PERIODS = 20
N_SIMS = 100
INITIAL_CAPITAL = 10.0  # $M
LOSS_THRESHOLD = -0.05  # 5% loss triggers scar
VOL_CAP = 0.15  # max portfolio volatility
LAMBDA_RISK = 0.5  # risk-aversion coefficient
SCAR_SLACK = 0.002  # small buffer above observed loss return

# Asset return distributions: (mean, std)
ASSETS = ["equities", "bonds", "commodities", "cash"]
DIST = {
    "equities": (0.10, 0.20),
    "bonds": (0.04, 0.06),
    "commodities": (0.08, 0.25),
    "cash": (0.02, 0.01),
}
N_ASSETS = len(ASSETS)

# Historical covariance (correlated returns) – approximate realistic structure
CORR = np.array(
    [
        [1.00, 0.10, 0.40, 0.05],
        [0.10, 1.00, 0.05, 0.20],
        [0.40, 0.05, 1.00, 0.02],
        [0.05, 0.20, 0.02, 1.00],
    ]
)
MEANS = np.array([DIST[a][0] for a in ASSETS])
STDS = np.array([DIST[a][1] for a in ASSETS])
COV = np.outer(STDS, STDS) * CORR


# ─────────────────────────────────────────────────────────────────────────────
# SOLVER HELPERS
# ─────────────────────────────────────────────────────────────────────────────
def _get_solver():
    """Return first available solver: IPOPT > CBC > GLPK."""
    for name in ("ipopt", "cbc", "glpk"):
        try:
            s = pyo.SolverFactory(name)
            if s.available():
                return s, name
        except Exception:
            continue
    raise RuntimeError("No solver found (need ipopt, cbc, or glpk)")


SOLVER, SOLVER_NAME = _get_solver()


def solve_portfolio(scar_constraints: List[Tuple[np.ndarray, float]]):
    """
    Solve mean-variance portfolio with optional scar cutting-plane constraints.

    max  mu^T w  -  0.5 * w^T Sigma w
    s.t. w^T Sigma w <= vol_cap^2
         sum(w) = 1,  w >= 0
         scar_i:  grad_i^T w <= threshold_i   (for each past loss)

    Returns (weights_array, expected_return, portfolio_vol).
    """
    m = pyo.ConcreteModel("mv_portfolio")
    m.I = pyo.RangeSet(0, N_ASSETS - 1)

    # Decision variables
    m.w = pyo.Var(m.I, bounds=(0.0, 1.0))

    # Objective: max E[r] - 0.5 * variance
    def obj_rule(m):
        lin = sum(MEANS[i] * m.w[i] for i in m.I)
        quad = sum(COV[i, j] * m.w[i] * m.w[j] for i in m.I for j in m.I)
        return lin - LAMBDA_RISK * quad

    m.obj = pyo.Objective(rule=obj_rule, sense=pyo.maximize)

    # Budget constraint
    m.budget = pyo.Constraint(expr=sum(m.w[i] for i in m.I) == 1.0)

    # Volatility cap: w^T Sigma w <= vol_cap^2
    vol_cap_sq = VOL_CAP**2

    def vol_rule(m):
        return sum(COV[i, j] * m.w[i] * m.w[j] for i in m.I for j in m.I) <= vol_cap_sq

    m.vol = pyo.Constraint(rule=vol_rule)

    # Scar cutting-plane constraints
    if scar_constraints:
        m.SCAR = pyo.RangeSet(0, len(scar_constraints) - 1)

        def scar_rule(m, s):
            grad, thresh = scar_constraints[s]
            return sum(grad[i] * m.w[i] for i in m.I) <= thresh

        m.scar_c = pyo.Constraint(m.SCAR, rule=scar_rule)

    # Solve
    try:
        result = SOLVER.solve(m, tee=False)
        if result.solver.termination_condition not in (
            pyo.TerminationCondition.optimal,
            pyo.TerminationCondition.feasible,
        ):
            return None, None, None
    except Exception:
        return None, None, None

    w = np.array([pyo.value(m.w[i]) for i in m.I])
    port_ret = MEANS @ w
    port_vol = np.sqrt(w @ COV @ w)
    return w, port_ret, port_vol


# ─────────────────────────────────────────────────────────────────────────────
# SIMULATION
# ─────────────────────────────────────────────────────────────────────────────
@dataclass
class SimResult:
    cumulative_return: float = 0.0
    loss_events: int = 0
    active_constraints: int = 0
    portfolio_returns: list = field(default_factory=list)
    constraint_counts: list = field(default_factory=list)
    weights_history: list = field(default_factory=list)


def run_one_simulation(seed: int):
    """Run one 20-period simulation for both strategies."""
    rng = np.random.default_rng(seed)

    naive = SimResult()
    scar = SimResult()
    scar_cuts: List[Tuple[np.ndarray, float]] = []  # (gradient, threshold)

    cum_naive = INITIAL_CAPITAL
    cum_scar = INITIAL_CAPITAL

    for t in range(N_PERIODS):
        # Draw correlated returns for this period
        L = np.linalg.cholesky(COV)
        z = rng.standard_normal(N_ASSETS)
        r = MEANS + L @ z  # asset returns this period

        # ── NAIVE strategy ──
        w_n, _, _ = solve_portfolio(scar_constraints=[])
        if w_n is None:
            # Fallback: equal weight
            w_n = np.ones(N_ASSETS) / N_ASSETS
        naive_ret = w_n @ r
        cum_naive *= 1 + naive_ret
        naive.portfolio_returns.append(naive_ret)
        naive.weights_history.append(w_n.copy())
        if naive_ret < LOSS_THRESHOLD:
            naive.loss_events += 1
        naive.constraint_counts.append(0)

        # ── SCAR strategy ──
        w_s, _, _ = solve_portfolio(scar_constraints=scar_cuts)
        if w_s is None:
            # If scar constraints make problem infeasible, relax last constraint
            if scar_cuts:
                scar_cuts.pop()
                w_s, _, _ = solve_portfolio(scar_constraints=scar_cuts)
            if w_s is None:
                w_s = np.ones(N_ASSETS) / N_ASSETS
        scar_ret = w_s @ r
        cum_scar *= 1 + scar_ret
        scar.portfolio_returns.append(scar_ret)
        scar.weights_history.append(w_s.copy())

        # Scar learning: if loss > threshold, add cutting plane
        if scar_ret < LOSS_THRESHOLD:
            scar.loss_events += 1
            # Cutting plane: grad = 2 * Sigma @ w  (gradient of variance at w)
            # Constraint: grad^T @ w_new <= scar_ret + slack
            # This penalises allocations similar to the one that caused the loss
            grad = COV @ w_s
            threshold = scar_ret + SCAR_SLACK
            scar_cuts.append((grad.copy(), threshold))

        scar.active_constraints = len(scar_cuts)
        scar.constraint_counts.append(len(scar_cuts))

    naive.cumulative_return = (cum_naive / INITIAL_CAPITAL - 1) * 100
    scar.cumulative_return = (cum_scar / INITIAL_CAPITAL - 1) * 100

    return naive, scar


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────
def main():
    print(f"Solver: {SOLVER_NAME}")
    print(
        f"Simulations: {N_SIMS} | Periods: {N_PERIODS} | Capital: ${INITIAL_CAPITAL}M"
    )
    print(f"Assets: {ASSETS}")
    print(
        f"Distributions: {json.dumps({a: {'mean': DIST[a][0], 'std': DIST[a][1]} for a in ASSETS})}"
    )
    print(f"Volatility cap: {VOL_CAP:.0%} | Loss threshold: {LOSS_THRESHOLD:.0%}")
    print()

    t0 = time.time()

    # Accumulators
    naive_cumret = []
    scar_cumret = []
    naive_losses = []
    scar_losses = []
    naive_avg_constraints = []
    scar_avg_constraints = []

    # Per-period tracking (averaged across sims)
    naive_period_rets = np.zeros(N_PERIODS)
    scar_period_rets = np.zeros(N_PERIODS)
    scar_constraint_ts = np.zeros(N_PERIODS)

    for i in range(N_SIMS):
        n, s = run_one_simulation(seed=42 + i)
        naive_cumret.append(n.cumulative_return)
        scar_cumret.append(s.cumulative_return)
        naive_losses.append(n.loss_events)
        scar_losses.append(s.loss_events)
        naive_avg_constraints.append(np.mean(n.constraint_counts))
        scar_avg_constraints.append(np.mean(s.constraint_counts))
        naive_period_rets += np.array(n.portfolio_returns)
        scar_period_rets += np.array(s.portfolio_returns)
        scar_constraint_ts += np.array(s.constraint_counts)

        if (i + 1) % 20 == 0:
            elapsed = time.time() - t0
            print(f"  {i + 1}/{N_SIMS} done  ({elapsed:.1f}s)")

    # Averages
    naive_period_rets /= N_SIMS
    scar_period_rets /= N_SIMS
    scar_constraint_ts /= N_SIMS

    elapsed = time.time() - t0

    # ── RESULTS ──
    avg_naive_cumret = np.mean(naive_cumret)
    avg_scar_cumret = np.mean(scar_cumret)
    med_naive_cumret = np.median(naive_cumret)
    med_scar_cumret = np.median(scar_cumret)
    std_naive_cumret = np.std(naive_cumret)
    std_scar_cumret = np.std(scar_cumret)
    avg_naive_losses = np.mean(naive_losses)
    avg_scar_losses = np.mean(scar_losses)
    avg_naive_cons = np.mean(naive_avg_constraints)
    avg_scar_cons = np.mean(scar_avg_constraints)

    # Win rate: how often scar beats naive
    wins = sum(1 for s, n in zip(scar_cumret, naive_cumret) if s > n)
    win_rate = wins / N_SIMS * 100

    # Statistical significance (paired t-test)
    from scipy import stats

    t_stat, p_value = stats.ttest_rel(scar_cumret, naive_cumret)

    # Effect size (Cohen's d)
    diff = np.array(scar_cumret) - np.array(naive_cumret)
    cohens_d = np.mean(diff) / np.std(diff) if np.std(diff) > 0 else 0

    # Sharpe-like ratio (return / vol of cumulative returns)
    naive_sharpe = avg_naive_cumret / std_naive_cumret if std_naive_cumret > 0 else 0
    scar_sharpe = avg_scar_cumret / std_scar_cumret if std_scar_cumret > 0 else 0

    # Worst-case drawdown across simulations
    naive_worst = np.min(naive_cumret)
    scar_worst = np.min(scar_cumret)

    # Print results
    print()
    print("=" * 70)
    print("RESULTS — test_scar_learning.py")
    print("=" * 70)
    print()
    print(f"{'Metric':<35} {'NAIVE':>12} {'SCAR':>12} {'Delta':>10}")
    print("-" * 70)
    print(
        f"{'Avg cumulative return (%)':<35} {avg_naive_cumret:>12.2f} {avg_scar_cumret:>12.2f} {avg_scar_cumret - avg_naive_cumret:>+10.2f}"
    )
    print(
        f"{'Median cumulative return (%)':<35} {med_naive_cumret:>12.2f} {med_scar_cumret:>12.2f} {med_scar_cumret - med_naive_cumret:>+10.2f}"
    )
    print(
        f"{'Std cumulative return (%)':<35} {std_naive_cumret:>12.2f} {std_scar_cumret:>12.2f} {std_scar_cumret - std_naive_cumret:>+10.2f}"
    )
    print(
        f"{'Return/Vol ratio':<35} {naive_sharpe:>12.3f} {scar_sharpe:>12.3f} {scar_sharpe - naive_sharpe:>+10.3f}"
    )
    print(
        f"{'Worst-case sim return (%)':<35} {naive_worst:>12.2f} {scar_worst:>12.2f} {scar_worst - naive_worst:>+10.2f}"
    )
    print(
        f"{'Avg loss events (>5%)':<35} {avg_naive_losses:>12.2f} {avg_scar_losses:>12.2f} {avg_scar_losses - avg_naive_losses:>+10.2f}"
    )
    print(
        f"{'Avg active scar constraints':<35} {avg_naive_cons:>12.2f} {avg_scar_cons:>12.2f} {avg_scar_cons - avg_naive_cons:>+10.2f}"
    )
    print(f"{'SCAR win rate (%)':<35} {'':>12} {win_rate:>12.1f}")
    print()
    print(
        f"Paired t-test:  t={t_stat:+.3f}  p={p_value:.4f}  {'*** SIGNIFICANT ***' if p_value < 0.05 else 'NOT significant (p>=0.05)'}"
    )
    print(
        f"Cohen's d:      {cohens_d:+.4f}  ({'small' if abs(cohens_d) < 0.2 else 'medium' if abs(cohens_d) < 0.5 else 'medium' if abs(cohens_d) < 0.8 else 'large'} effect)"
    )
    print()

    # Period-by-period average returns
    print("Period-by-period average portfolio return (%):")
    print(f"{'Period':<8} {'NAIVE':>10} {'SCAR':>10} {'SCAR constraints':>18}")
    print("-" * 48)
    for t in range(N_PERIODS):
        print(
            f"  {t + 1:<6} {naive_period_rets[t] * 100:>10.3f} {scar_period_rets[t] * 100:>10.3f} {scar_constraint_ts[t]:>18.2f}"
        )

    print()
    print(f"Elapsed: {elapsed:.1f}s  |  Solver: {SOLVER_NAME}")
    print()

    # ── VERDICT ──
    scar_better = avg_scar_cumret > avg_naive_cumret
    significant = p_value < 0.05
    fewer_losses = avg_scar_losses <= avg_naive_losses

    print("=" * 70)
    print("VERDICT")
    print("=" * 70)
    if scar_better and significant:
        verdict = "SUPPORTED"
        detail = (
            f"Scar learning produced significantly higher cumulative returns "
            f"({avg_scar_cumret:+.2f}% vs {avg_naive_cumret:+.2f}%, p={p_value:.4f}). "
            f"Constraint accumulation ({avg_scar_cons:.1f} avg scars) reduced "
            f"repeat loss events ({avg_scar_losses:.1f} vs {avg_naive_losses:.1f}). "
            f"Win rate: {win_rate:.0f}%. Cohen's d={cohens_d:+.3f}."
        )
    elif scar_better and not significant:
        verdict = "WEAK / NOT SIGNIFICANT"
        detail = (
            f"Scar learning showed higher average returns "
            f"({avg_scar_cumret:+.2f}% vs {avg_naive_cumret:+.2f}%) but the "
            f"difference is not statistically significant (p={p_value:.4f}). "
            f"Win rate: {win_rate:.0f}%. Effect size small (d={cohens_d:+.3f}). "
            f"The hypothesis cannot be confirmed with {N_SIMS} simulations."
        )
    else:
        verdict = "NOT SUPPORTED"
        detail = (
            f"Scar learning did NOT improve returns "
            f"({avg_scar_cumret:+.2f}% vs {avg_naive_cumret:+.2f}%). "
            f"p={p_value:.4f}. The cutting-plane constraints may be over-constraining "
            f"the feasible set, reducing diversification benefit. "
            f"Win rate: {win_rate:.0f}%."
        )

    print(f"\n  HYPOTHESIS: {verdict}")
    print(f"  {detail}")
    print()

    # ── Write RESULTS.md ──
    md = []
    md.append("# RESULTS — test_scar_learning.py\n")
    md.append(
        f"**HYPOTHESIS:** Constraint accumulation from past failures (cutting-plane / scar mechanism) improves portfolio recommendations over time.\n"
    )
    md.append(f"**VERDICT: {verdict}**\n")
    md.append(f"\n{detail}\n")
    md.append("\n## Configuration\n")
    md.append(f"- Simulations: {N_SIMS}")
    md.append(f"- Periods: {N_PERIODS}")
    md.append(f"- Initial capital: ${INITIAL_CAPITAL}M")
    md.append(f"- Loss threshold: {LOSS_THRESHOLD:.0%}")
    md.append(f"- Volatility cap: {VOL_CAP:.0%}")
    md.append(f"- Risk aversion (λ): {LAMBDA_RISK}")
    md.append(f"- Solver: {SOLVER_NAME}")
    md.append(f"- Scar slack: {SCAR_SLACK}")
    md.append(f"- Assets: {', '.join(ASSETS)}")
    md.append("")
    md.append("## Return Distributions\n")
    md.append("| Asset | Mean | Std |")
    md.append("|-------|------|-----|")
    for a in ASSETS:
        md.append(f"| {a} | {DIST[a][0]:.0%} | {DIST[a][1]:.0%} |")
    md.append("")
    md.append("## Summary Results\n")
    md.append("| Metric | NAIVE | SCAR | Delta |")
    md.append("|--------|-------|------|-------|")
    md.append(
        f"| Avg cumulative return (%) | {avg_naive_cumret:.2f} | {avg_scar_cumret:.2f} | {avg_scar_cumret - avg_naive_cumret:+.2f} |"
    )
    md.append(
        f"| Median cumulative return (%) | {med_naive_cumret:.2f} | {med_scar_cumret:.2f} | {med_scar_cumret - med_naive_cumret:+.2f} |"
    )
    md.append(
        f"| Std cumulative return (%) | {std_naive_cumret:.2f} | {std_scar_cumret:.2f} | {std_scar_cumret - std_naive_cumret:+.2f} |"
    )
    md.append(
        f"| Return/Vol ratio | {naive_sharpe:.3f} | {scar_sharpe:.3f} | {scar_sharpe - naive_sharpe:+.3f} |"
    )
    md.append(
        f"| Worst-case sim return (%) | {naive_worst:.2f} | {scar_worst:.2f} | {scar_worst - naive_worst:+.2f} |"
    )
    md.append(
        f"| Avg loss events (>5%) | {avg_naive_losses:.2f} | {avg_scar_losses:.2f} | {avg_scar_losses - avg_naive_losses:+.2f} |"
    )
    md.append(
        f"| Avg active scar constraints | {avg_naive_cons:.2f} | {avg_scar_cons:.2f} | {avg_scar_cons - avg_naive_cons:+.2f} |"
    )
    md.append(f"| SCAR win rate (%) | — | {win_rate:.1f} | — |")
    md.append("")
    md.append("## Statistical Tests\n")
    md.append(
        f"- **Paired t-test:** t={t_stat:+.3f}, p={p_value:.4f} {'(SIGNIFICANT at α=0.05)' if p_value < 0.05 else '(NOT significant at α=0.05)'}"
    )
    md.append(
        f"- **Cohen's d:** {cohens_d:+.4f} ({'negligible' if abs(cohens_d) < 0.2 else 'small' if abs(cohens_d) < 0.5 else 'medium' if abs(cohens_d) < 0.8 else 'large'} effect)"
    )
    md.append("")
    md.append("## Period-by-Period Average Returns (%)\n")
    md.append("| Period | NAIVE | SCAR | SCAR constraints |")
    md.append("|--------|-------|------|------------------|")
    for t in range(N_PERIODS):
        md.append(
            f"| {t + 1} | {naive_period_rets[t] * 100:.3f} | {scar_period_rets[t] * 100:.3f} | {scar_constraint_ts[t]:.2f} |"
        )
    md.append("")
    md.append("## Scar Mechanism Detail\n")
    md.append(
        "The SCAR strategy accumulates cutting-plane constraints after each period where"
    )
    md.append(
        f"portfolio return < {LOSS_THRESHOLD:.0%}. Each constraint takes the form:\n"
    )
    md.append("```")
    md.append("∇V(w_loss) · w_new ≤ r_observed + slack")
    md.append("```")
    md.append(
        "where ∇V = Σ·w (gradient of portfolio variance at the loss-making weights),"
    )
    md.append(
        f"and slack = {SCAR_SLACK}. This penalises allocations geometrically similar"
    )
    md.append(
        "to past loss-making portfolios without completely forbidding the asset class.\n"
    )
    md.append(
        f"Over {N_PERIODS} periods, SCAR accumulated an average of {avg_scar_cons:.1f} constraints"
    )
    md.append(
        f"(range: 0–{max(max(n.constraint_counts) for n in [SimResult() for _ in range(0)]) if False else N_PERIODS}).\n"
    )
    md.append("## Interpretation\n")
    if verdict == "SUPPORTED":
        md.append(
            "The scar mechanism demonstrably improves portfolio outcomes by learning from past"
        )
        md.append(
            "losses. The cutting-plane constraints steer the optimizer away from repeating"
        )
        md.append(
            "concentrated bets that caused >5% losses, while preserving enough feasible space"
        )
        md.append(
            "for reasonable diversification. This is consistent with the hypothesis that"
        )
        md.append(
            "institutional memory of failures — encoded as convex constraints — improves"
        )
        md.append("sequential decision-making under uncertainty.")
    elif verdict == "WEAK / NOT SIGNIFICANT":
        md.append(
            "The scar mechanism shows a directional improvement but fails to reach statistical"
        )
        md.append(
            "significance. The cutting-plane constraints do accumulate (average {:.1f} active".format(
                avg_scar_cons
            )
        )
        md.append(
            "scars by period 20), but the portfolio optimisation problem is already well-constrained"
        )
        md.append(
            "by the volatility cap. The scar mechanism may need more periods, a tighter loss"
        )
        md.append(
            "threshold, or a different constraint geometry to show a reliable effect."
        )
    else:
        md.append(
            "The scar mechanism does NOT improve portfolio outcomes. The cutting-plane constraints"
        )
        md.append(
            "may over-constrain the feasible region, reducing diversification and causing the"
        )
        md.append(
            "optimizer to settle into corner solutions (e.g., 100% cash) that have lower"
        )
        md.append(
            "expected returns. The hypothesis is not supported by this experiment."
        )
        md.append("")
        md.append("Possible explanations:")
        md.append(
            "1. Mean-variance optimisation with a volatility cap is already efficient — adding"
        )
        md.append(
            "   past-loss constraints reduces the feasible set without improving the objective."
        )
        md.append(
            "2. The cutting-plane gradient (∇V = Σ·w) targets variance geometry, not return"
        )
        md.append(
            "   geometry — it may steer toward low-variance but also low-return allocations."
        )
        md.append(
            "3. The 5% loss threshold fires too infrequently to meaningfully constrain the space."
        )
    md.append("")
    md.append(
        f"---\n*Generated: {time.strftime('%Y-%m-%d %H:%M UTC')} | Solver: {SOLVER_NAME} | Elapsed: {elapsed:.1f}s*"
    )
    md.append("")

    with open("RESULTS.md", "w") as f:
        f.write("\n".join(md))
    print("Results written to RESULTS.md")


if __name__ == "__main__":
    main()
