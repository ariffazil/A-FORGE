#!/usr/bin/env python3
"""
test_robust_npv.py — Robust vs Expected-Value NPV Optimization for Oil/Gas
===========================================================================
HYPOTHESIS: Robust (min-max) optimization gives better worst-case NPV
than expected-value optimization for oil/gas projects.

Decision variable: project scale ∈ [0.5, 1.5]
  - Capex = $500M × scale^0.7  (economies of scale)
  - Production = 50k × scale bbl/day, declining 5%/yr
  - Opex $/bbl (uncertain ±30%)
  - Oil price $/bbl (uncertain, uniform)

Three solutions:
  a. DETERMINISTIC — optimize NPV at expected values
  b. STOCHASTIC   — max E[NPV] over 1000 scenarios
  c. ROBUST       — max min(NPV) at worst-case (price=$50, opex=$26)

Evaluate all three on 1000 held-out scenarios.
"""

import json
import time
import numpy as np
import pyomo.environ as pyo

# ── Project Parameters ──────────────────────────────────────────────
CAPEX_BASE = 500.0  # $M
PROD_BASE = 50_000  # bbl/day
DECLINE = 0.05  # 5%/yr
YEARS = 10
OPEX_BASE = 20.0  # $/bbl
PRICE_BASE = 70.0  # $/bbl
DISCOUNT = 0.10
SCALE_LO = 0.5
SCALE_HI = 1.5

# Uncertainty
OPEX_RANGE = 0.30  # ±30%
PRICE_LO = 50.0
PRICE_HI = 90.0
N_SCENARIOS = 1000
RNG_SEED = 42


# ── NPV Calculator (vectorised) ─────────────────────────────────────
def npv_at(scale: float, price: float, opex: float) -> float:
    """Compute NPV ($M) for given scale, oil price, opex."""
    capex = CAPEX_BASE * scale**0.7
    npv = -capex
    for t in range(YEARS):
        prod = PROD_BASE * scale * (1 - DECLINE) ** t  # bbl/day
        annual_bbl = prod * 365.0
        cf = (price - opex) * annual_bbl / 1e6  # $M
        npv += cf / (1 + DISCOUNT) ** t
    return npv


def npv_vec(scales: np.ndarray, prices: np.ndarray, opexs: np.ndarray) -> np.ndarray:
    """Vectorised NPV over scenarios. shapes: (N,), (N,), (N,) → (N,)"""
    N = len(scales)
    capex = CAPEX_BASE * scales**0.7
    npv = -capex.copy()
    for t in range(YEARS):
        prod = PROD_BASE * scales * (1 - DECLINE) ** t
        annual_bbl = prod * 365.0
        cf = (prices - opexs) * annual_bbl / 1e6
        npv += cf / (1 + DISCOUNT) ** t
    return npv


# ── Solver Factory ──────────────────────────────────────────────────
def get_solver():
    """Try IPOPT → GLPK → CBC."""
    for name in ["ipopt", "glpk", "cbc"]:
        try:
            s = pyo.SolverFactory(name)
            if s.available():
                return s, name
        except Exception:
            continue
    raise RuntimeError("No solver found (need ipopt, glpk, or cbc)")


# ── Pyomo Models ────────────────────────────────────────────────────
def build_deterministic(price, opex):
    """Single-scenario NPV maximisation."""
    m = pyo.ConcreteModel()
    m.scale = pyo.Var(bounds=(SCALE_LO, SCALE_HI))

    # NPV expression
    capex = CAPEX_BASE * m.scale**0.7
    npv_expr = -capex
    for t in range(YEARS):
        prod = PROD_BASE * m.scale * (1 - DECLINE) ** t
        cf = (price - opex) * prod * 365.0 / 1e6
        npv_expr += cf / (1 + DISCOUNT) ** t

    m.npv = pyo.Objective(expr=npv_expr, sense=pyo.maximize)
    return m


def build_stochastic(prices, opexs):
    """Maximise expected NPV over scenarios."""
    N = len(prices)
    m = pyo.ConcreteModel()
    m.scale = pyo.Var(bounds=(SCALE_LO, SCALE_HI))
    m.scenarios = pyo.RangeSet(0, N - 1)

    # NPV per scenario (parameterised by scale)
    def npv_rule(m, i):
        capex = CAPEX_BASE * m.scale**0.7
        npv = -capex
        for t in range(YEARS):
            prod = PROD_BASE * m.scale * (1 - DECLINE) ** t
            cf = (prices[i] - opexs[i]) * prod * 365.0 / 1e6
            npv += cf / (1 + DISCOUNT) ** t
        return npv

    m.npv_s = pyo.Expression(m.scenarios, rule=npv_rule)

    # Objective: average NPV
    m.obj = pyo.Objective(
        expr=sum(m.npv_s[i] for i in m.scenarios) / N, sense=pyo.maximize
    )
    return m


def build_robust(wc_price, wc_opex):
    """Maximise worst-case NPV (single worst-case scenario)."""
    # Identical to deterministic but at worst-case params
    return build_deterministic(wc_price, wc_opex)


def build_robust_minmax(prices, opexs):
    """Max-min over all scenarios (full min-max robust)."""
    N = len(prices)
    m = pyo.ConcreteModel()
    m.scale = pyo.Var(bounds=(SCALE_LO, SCALE_HI))
    m.z = pyo.Var()  # worst-case NPV lower bound
    m.scenarios = pyo.RangeSet(0, N - 1)

    m.obj = pyo.Objective(expr=m.z, sense=pyo.maximize)

    # z ≤ NPV_i for all scenarios
    def worst_case_rule(m, i):
        capex = CAPEX_BASE * m.scale**0.7
        npv = -capex
        for t in range(YEARS):
            prod = PROD_BASE * m.scale * (1 - DECLINE) ** t
            cf = (prices[i] - opexs[i]) * prod * 365.0 / 1e6
            npv += cf / (1 + DISCOUNT) ** t
        return m.z <= npv

    m.wc_con = pyo.Constraint(m.scenarios, rule=worst_case_rule)
    return m


# ── Main ────────────────────────────────────────────────────────────
def main():
    t0 = time.time()
    rng = np.random.default_rng(RNG_SEED)

    print("=" * 70)
    print("ROBUST vs EXPECTED-VALUE NPV OPTIMIZATION — Oil/Gas Project")
    print("=" * 70)

    # ── Generate scenarios ───────────────────────────────────────────
    # Training scenarios (for stochastic & robust optimisation)
    train_prices = rng.uniform(PRICE_LO, PRICE_HI, N_SCENARIOS)
    train_opexs = OPEX_BASE * rng.uniform(1 - OPEX_RANGE, 1 + OPEX_RANGE, N_SCENARIOS)

    # Held-out evaluation scenarios
    eval_prices = rng.uniform(PRICE_LO, PRICE_HI, N_SCENARIOS)
    eval_opexs = OPEX_BASE * rng.uniform(1 - OPEX_RANGE, 1 + OPEX_RANGE, N_SCENARIOS)

    # Worst-case parameters
    wc_price = PRICE_LO  # $50
    wc_opex = OPEX_BASE * 1.30  # $26

    print(
        f"\nProject: Capex ${CAPEX_BASE}M, Prod {PROD_BASE / 1000:.0f}kbbl/d, "
        f"Decline {DECLINE * 100:.0f}%/yr, {YEARS}yr"
    )
    print(f"Opex: ${OPEX_BASE}/bbl ±{OPEX_RANGE * 100:.0f}%")
    print(f"Price: ${PRICE_BASE}/bbl uniform [${PRICE_LO}, ${PRICE_HI}]")
    print(f"Discount: {DISCOUNT * 100:.0f}%")
    print(f"Worst-case: price=${wc_price}, opex=${wc_opex}")
    print(f"Scenarios: {N_SCENARIOS} train + {N_SCENARIOS} held-out")

    solver, solver_name = get_solver()
    print(f"Solver: {solver_name}\n")

    results = {}

    # ── (a) DETERMINISTIC ────────────────────────────────────────────
    print("─" * 50)
    print("[A] DETERMINISTIC: optimise at expected values")
    m_det = build_deterministic(PRICE_BASE, OPEX_BASE)
    res = solver.solve(m_det, tee=False)
    scale_det = pyo.value(m_det.scale)
    npv_det_train = npv_at(scale_det, PRICE_BASE, OPEX_BASE)
    print(f"    Scale = {scale_det:.4f}")
    print(f"    NPV(expected) = ${npv_det_train:.1f}M")
    results["deterministic"] = {"scale": scale_det}

    # ── (b) STOCHASTIC (max E[NPV]) ──────────────────────────────────
    print("\n" + "─" * 50)
    print("[B] STOCHASTIC: max E[NPV] over 1000 scenarios")

    # For this problem NPV is LINEAR in (price - opex), so E[NPV] = NPV at E[price], E[opex].
    # We solve it explicitly anyway to demonstrate the framework.
    # Use a subsample of 200 scenarios to keep Pyomo model tractable
    N_sub = 200
    idx = rng.choice(N_SCENARIOS, N_sub, replace=False)
    sub_prices = train_prices[idx]
    sub_opexs = train_opexs[idx]

    m_sto = build_stochastic(sub_prices, sub_opexs)
    res = solver.solve(m_sto, tee=False)
    scale_sto = pyo.value(m_sto.scale)
    npv_sto_train = np.mean(
        npv_vec(np.full(N_SCENARIOS, scale_sto), train_prices, train_opexs)
    )
    print(f"    Scale = {scale_sto:.4f}")
    print(f"    E[NPV](train) = ${npv_sto_train:.1f}M")
    results["stochastic"] = {"scale": scale_sto}

    # ── (c) ROBUST (max worst-case NPV) ──────────────────────────────
    print("\n" + "─" * 50)
    print("[C] ROBUST: max min(NPV) at worst-case (price=${wc_price}, opex=${wc_opex})")
    m_rob = build_robust(wc_price, wc_opex)
    res = solver.solve(m_rob, tee=False)
    scale_rob = pyo.value(m_rob.scale)
    npv_rob_wc = npv_at(scale_rob, wc_price, wc_opex)
    print(f"    Scale = {scale_rob:.4f}")
    print(f"    NPV(worst-case) = ${npv_rob_wc:.1f}M")
    results["robust"] = {"scale": scale_rob}

    # ── (c2) ROBUST MIN-MAX (full scenario set) ──────────────────────
    # This would have N_SCENARIOS constraints — use subsample
    print("\n" + "─" * 50)
    print("[C2] ROBUST MIN-MAX: max min_i(NPV_i) over 200 scenarios")
    m_mm = build_robust_minmax(sub_prices, sub_opexs)
    res = solver.solve(m_mm, tee=False)
    scale_mm = pyo.value(m_mm.scale)
    npv_mm_wc = npv_at(scale_mm, wc_price, wc_opex)
    print(f"    Scale = {scale_mm:.4f}")
    print(f"    Worst-case NPV = ${npv_mm_wc:.1f}M")
    results["robust_minmax"] = {"scale": scale_mm}

    # ── EVALUATE ON HELD-OUT SCENARIOS ───────────────────────────────
    print("\n" + "=" * 70)
    print("EVALUATION ON 1000 HELD-OUT SCENARIOS")
    print("=" * 70)

    scales = {
        "Deterministic": scale_det,
        "Stochastic": scale_sto,
        "Robust(wc)": scale_rob,
        "Robust(minmax)": scale_mm,
    }

    eval_results = {}
    for name, sc in scales.items():
        npvs = npv_vec(np.full(N_SCENARIOS, sc), eval_prices, eval_opexs)
        ev = np.mean(npvs)
        wc = np.min(npvs)
        prob_loss = np.mean(npvs < 0)
        # CVaR(5%): mean of worst 5%
        sorted_npvs = np.sort(npvs)
        cvar5 = np.mean(sorted_npvs[: int(0.05 * N_SCENARIOS)])

        eval_results[name] = {
            "scale": round(sc, 4),
            "expected_npv": round(ev, 1),
            "worst_case_npv": round(wc, 1),
            "prob_loss": round(prob_loss, 4),
            "cvar_5pct": round(cvar5, 1),
            "best_case_npv": round(np.max(npvs), 1),
            "std_npv": round(np.std(npvs), 1),
        }

    # ── Print comparison table ───────────────────────────────────────
    hdr = f"{'Metric':<22} {'Deterministic':>15} {'Stochastic':>15} {'Robust(wc)':>15} {'Robust(mm)':>15}"
    print("\n" + hdr)
    print("─" * len(hdr))

    metrics = [
        ("Scale", "scale"),
        ("Expected NPV ($M)", "expected_npv"),
        ("Worst-case NPV ($M)", "worst_case_npv"),
        ("Best-case NPV ($M)", "best_case_npv"),
        ("Std Dev ($M)", "std_npv"),
        ("Prob(Loss)", "prob_loss"),
        ("CVaR 5% ($M)", "cvar_5pct"),
    ]

    for label, key in metrics:
        vals = []
        for name in ["Deterministic", "Stochastic", "Robust(wc)", "Robust(minmax)"]:
            v = eval_results[name][key]
            if key == "prob_loss":
                vals.append(f"{v:>14.1%}")
            elif key == "scale":
                vals.append(f"{v:>15.4f}")
            else:
                vals.append(f"{v:>15.1f}")
        print(f"{label:<22} {''.join(vals)}")

    # ── Verdict ──────────────────────────────────────────────────────
    print("\n" + "=" * 70)
    print("VERDICT")
    print("=" * 70)

    det_wc = eval_results["Deterministic"]["worst_case_npv"]
    rob_wc = eval_results["Robust(wc)"]["worst_case_npv"]
    mm_wc = eval_results["Robust(minmax)"]["worst_case_npv"]
    det_ev = eval_results["Deterministic"]["expected_npv"]
    rob_ev = eval_results["Robust(wc)"]["expected_npv"]

    wc_improvement = rob_wc - det_wc
    ev_sacrifice = det_ev - rob_ev

    print(f"\nDeterministic scale: {scale_det:.4f}")
    print(f"Robust(wc) scale:    {scale_rob:.4f}")
    print(f"Robust(mm) scale:    {scale_mm:.4f}")
    print(f"\nWorst-case NPV improvement (robust vs det): ${wc_improvement:+.1f}M")
    print(f"Expected NPV sacrifice (det vs robust):     ${ev_sacrifice:+.1f}M")

    if wc_improvement > 0:
        print(f"\n✅ HYPOTHESIS SUPPORTED: Robust optimisation improves worst-case NPV")
        print(
            f"   by ${wc_improvement:.1f}M at the cost of ${ev_sacrifice:.1f}M expected NPV."
        )
        print(
            f"   The robust strategy downscales from {scale_det:.3f} to {scale_rob:.3f},"
        )
        print(f"   reducing capex exposure under adverse conditions.")
    else:
        print(f"\n❌ HYPOTHESIS NOT SUPPORTED: Robust optimisation does NOT improve")
        print(f"   worst-case NPV over expected-value optimisation.")

    # Linearity insight
    sto_ev = eval_results["Stochastic"]["expected_npv"]
    print(f"\n📐 STRUCTURAL INSIGHT: NPV is linear in (price - opex).")
    print(f"   Therefore E[NPV(price, opex)] = NPV(E[price], E[opex]).")
    print(f"   Deterministic expected NPV: ${det_ev:.1f}M")
    print(f"   Stochastic expected NPV:    ${sto_ev:.1f}M")
    print(
        f"   Difference: ${abs(det_ev - sto_ev):.1f}M (≈0 as expected for linear model)"
    )
    print(f"   Stochastic ≠ Robust: the value of robust optimisation comes from")
    print(f"   protecting the tail, not from better expected-value estimation.")

    # Trade-off ratio
    if ev_sacrifice > 0:
        ratio = wc_improvement / ev_sacrifice
        print(
            f"\n📊 TRADE-OFF RATIO: ${wc_improvement:.1f}M worst-case gain / "
            f"${ev_sacrifice:.1f}M expected sacrifice = {ratio:.2f}x"
        )

    elapsed = time.time() - t0
    print(f"\n⏱  Completed in {elapsed:.1f}s")

    # ── Save JSON ────────────────────────────────────────────────────
    output = {
        "hypothesis": "Robust (min-max) optimization gives better worst-case NPV than expected-value optimization",
        "verdict": "SUPPORTED" if wc_improvement > 0 else "NOT_SUPPORTED",
        "project_params": {
            "capex_M": CAPEX_BASE,
            "prod_bbl_d": PROD_BASE,
            "decline_pct": DECLINE * 100,
            "years": YEARS,
            "opex_base": OPEX_BASE,
            "price_base": PRICE_BASE,
            "discount_pct": DISCOUNT * 100,
        },
        "uncertainty": {
            "price_range": [PRICE_LO, PRICE_HI],
            "opex_range_pct": OPEX_RANGE * 100,
            "worst_case": {"price": wc_price, "opex": wc_opex},
        },
        "scales": {k: round(v, 4) for k, v in scales.items()},
        "evaluation": eval_results,
        "tradeoff": {
            "wc_improvement_M": round(wc_improvement, 1),
            "ev_sacrifice_M": round(ev_sacrifice, 1),
            "ratio": round(wc_improvement / max(ev_sacrifice, 0.01), 2),
        },
        "solver": solver_name,
        "scenarios": {"train": N_SCENARIOS, "held_out": N_SCENARIOS},
        "elapsed_s": round(elapsed, 1),
    }

    with open(
        "/root/A-FORGE/forge_work/apex-wealth-test/agent-b/results.json", "w"
    ) as f:
        json.dump(output, f, indent=2)
    print("\n📁 Results saved to results.json")

    return output


if __name__ == "__main__":
    main()
