# Agent A: Nash Product Portfolio Optimization

## Hypothesis
A multiplicative (Nash bargaining) portfolio objective produces more balanced, 
less-concentrated allocations than a standard additive (weighted-sum) objective.
The Nash product prevents sacrificing any single asset dimension for another.

## What To Build
A Python script (test_nash_portfolio.py) using Pyomo + NumPy that:

1. Defines a 5-asset portfolio problem with expected returns and covariances
2. Solves it TWO ways:
   - ADDITIVE: max Σ w_i * r_i (standard mean-variance)
   - NASH: max Π (r_i * w_i)^(w_i) (multiplicative Nash product)
3. Compares on 1000 Monte Carlo scenarios
4. Reports: concentration (HHI), worst-case return, expected return, Sharpe ratio

## Constraints
- Weights sum to 1, all non-negative
- Max single asset weight: 40% (diversification constraint)
- Use Pyomo for optimization, NumPy for simulation

## Success Criteria
- Nash portfolio has LOWER concentration (HHI) than additive
- Nash portfolio has BETTER worst-case return
- If both fail to show improvement, report HONESTLY

## Output
- test_nash_portfolio.py (runnable)
- RESULTS.md with comparison table
