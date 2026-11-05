# Spatial analysis cross-validation

Compared the production `spatial-analysis.js` module with the notebook-equivalent PySAL (`esda.Moran` + libpysal) computation against the same GeoJSON inputs. Each successful run used 999 permutations and seed 54321. The CSV contains every paired run and engine-specific status/error.

## Coverage

- Statewide: 5 county summary measures × Queen/Rook contiguity = 10 runs.
- County bridge-point scale: all 99 `brcounty` values × 8 bridge measures × KNN k = 4, 6, 8, 12 = 3,168 runs.
- Total: 3,178 paired runs per engine.

## Agreement summary

| Scope | Runs | Successful pairs | Same pair count | Different pair count | I equal within 1e-10 | Median abs ΔI | Maximum abs ΔI | Median abs Δp | p<0.05 agreement |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| All runs | 3178 | 3170 | 3170 | 0 | 3170 | 5.55e-17 | 2.5e-15 | 0.004 | 3126/3170 |
| Statewide | 10 | 10 | 10 | 0 | 10 | 8.33e-17 | 1.67e-16 | 0 | 10/10 |
| County bridge points | 3168 | 3160 | 3160 | 0 | 3160 | 5.55e-17 | 2.5e-15 | 0.004 | 3116/3160 |

## Statewide results

| Measure | Weights | n | Pair count (Py / JS) | Moran I (PySAL) | Moran I (JS) | ΔI (JS − PySAL) | p (PySAL / JS) |
|---|---|---:|---:|---:|---:|---:|---:|
| br_age | queen | 99 | 293 / 293 | 0.058647 | 0.058647 | +6.94e-18 | 0.114 / 0.127 |
| br_age | rook | 99 | 223 / 223 | 0.075099 | 0.075099 | +4.16e-17 | 0.102 / 0.094 |
| br_poorper | queen | 99 | 293 / 293 | 0.296459 | 0.296459 | +5.55e-17 | 0.001 / 0.001 |
| br_poorper | rook | 99 | 223 / 223 | 0.318641 | 0.318641 | +5.55e-17 | 0.001 / 0.001 |
| fd_100per | queen | 99 | 293 / 293 | 0.266262 | 0.266262 | +1.67e-16 | 0.001 / 0.001 |
| fd_100per | rook | 99 | 223 / 223 | 0.300542 | 0.300542 | +1.11e-16 | 0.001 / 0.001 |
| fd_500per | queen | 99 | 293 / 293 | 0.233491 | 0.233491 | -1.39e-16 | 0.001 / 0.001 |
| fd_500per | rook | 99 | 223 / 223 | 0.276661 | 0.276661 | -1.11e-16 | 0.001 / 0.001 |
| fd_50per | queen | 99 | 293 / 293 | 0.271202 | 0.271202 | -5.55e-17 | 0.001 / 0.001 |
| fd_50per | rook | 99 | 223 / 223 | 0.322014 | 0.322014 | -1.11e-16 | 0.001 / 0.001 |

## County-level summary by measure and KNN k

Each row summarizes 99 county runs. `Pair-count equal` checks that both implementations built graphs with the same number of undirected neighbor pairs; this does not prove identical neighbor identities.

| Measure | k | Runs | Pair-count equal | Median abs ΔI | Max abs ΔI | Median abs Δp | p<0.05 agreement |
|---|---:|---:|---:|---:|---:|---:|---:|
| poor_flag | 4 | 99/99 | 99/99 | 9.02e-17 | 1.61e-15 | 0.011 | 97/99 |
| poor_flag | 6 | 99/99 | 99/99 | 6.94e-17 | 1.48e-15 | 0.008 | 97/99 |
| poor_flag | 8 | 99/99 | 99/99 | 6.59e-17 | 1.33e-15 | 0.008 | 99/99 |
| poor_flag | 12 | 99/99 | 99/99 | 4.86e-17 | 1.05e-15 | 0.01 | 96/99 |
| brage | 4 | 99/99 | 99/99 | 2.08e-17 | 4.72e-16 | 0.006 | 97/99 |
| brage | 6 | 99/99 | 99/99 | 1.39e-17 | 3.61e-16 | 0.007 | 96/99 |
| brage | 8 | 99/99 | 99/99 | 1.39e-17 | 2.78e-16 | 0.007 | 96/99 |
| brage | 12 | 99/99 | 99/99 | 1.39e-17 | 2.08e-16 | 0.006 | 99/99 |
| bradt | 4 | 99/99 | 99/99 | 5.55e-17 | 9.44e-16 | 0 | 97/99 |
| bradt | 6 | 99/99 | 99/99 | 5.55e-17 | 8.33e-16 | 0 | 99/99 |
| bradt | 8 | 99/99 | 99/99 | 5.55e-17 | 7.91e-16 | 0 | 99/99 |
| bradt | 12 | 99/99 | 99/99 | 2.78e-17 | 9.16e-16 | 0 | 98/99 |
| bradt_log1p | 4 | 99/99 | 99/99 | 1.11e-16 | 8.33e-16 | 0 | 99/99 |
| bradt_log1p | 6 | 99/99 | 99/99 | 8.33e-17 | 1.11e-15 | 0 | 98/99 |
| bradt_log1p | 8 | 99/99 | 99/99 | 6.94e-17 | 2.05e-15 | 0 | 98/99 |
| bradt_log1p | 12 | 99/99 | 99/99 | 5.55e-17 | 1.05e-15 | 0 | 99/99 |
| closure_severity | 4 | 99/99 | 99/99 | 1.25e-16 | 2.41e-15 | 0.006 | 99/99 |
| closure_severity | 6 | 99/99 | 99/99 | 6.94e-17 | 2.14e-15 | 0.006 | 97/99 |
| closure_severity | 8 | 99/99 | 99/99 | 7.81e-17 | 2.08e-15 | 0.006 | 96/99 |
| closure_severity | 12 | 99/99 | 99/99 | 6.25e-17 | 1.47e-15 | 0.006 | 96/99 |
| br50 | 4 | 97/99 | 97/97 | 1.02e-16 | 2.22e-15 | 0.006 | 96/97 |
| br50 | 6 | 97/99 | 97/97 | 7.72e-17 | 1.89e-15 | 0.008 | 95/97 |
| br50 | 8 | 97/99 | 97/97 | 8.33e-17 | 1.86e-15 | 0.007 | 96/97 |
| br50 | 12 | 97/99 | 97/97 | 5.55e-17 | 1.44e-15 | 0.006 | 92/97 |
| br100 | 4 | 99/99 | 99/99 | 1.11e-16 | 1.05e-15 | 0.006 | 99/99 |
| br100 | 6 | 99/99 | 99/99 | 7.63e-17 | 1.17e-15 | 0.007 | 98/99 |
| br100 | 8 | 99/99 | 99/99 | 7.98e-17 | 1.17e-15 | 0.007 | 98/99 |
| br100 | 12 | 99/99 | 99/99 | 4.16e-17 | 1.03e-15 | 0.006 | 98/99 |
| br500 | 4 | 99/99 | 99/99 | 1.04e-16 | 2.5e-15 | 0.005 | 99/99 |
| br500 | 6 | 99/99 | 99/99 | 8.85e-17 | 2.11e-15 | 0.004 | 99/99 |
| br500 | 8 | 99/99 | 99/99 | 7.63e-17 | 1.78e-15 | 0.005 | 98/99 |
| br500 | 12 | 99/99 | 99/99 | 6.77e-17 | 1.72e-15 | 0.005 | 96/99 |

## Observed-I consistency

All 3,170 successful pairs have equal neighbor-pair counts, and every JavaScript/PySAL observed-I difference is below 2.5 × 10⁻¹⁵. That is floating-point rounding; the engines agree on the observed statistic for every successful combination.


## Undefined cases

Eight combinations (Madison and Warren Counties, `br50`, each of k = 4, 6, 8, 12) are constant because every bridge has the same 50-year indicator. Both engines correctly report Moran’s I as undefined for these combinations. The other 3,170 combinations ran successfully in both engines.

## Interpretation

- Permutation p-values need not match even when I matches: JavaScript and NumPy use different random number generators, so a shared numeric seed does not produce the same permutations. At the p < 0.05 cutoff, 44 of 3,170 successful comparisons fall on opposite sides; interpret those threshold-sensitive results cautiously or increase the permutation count.
- Equal pair counts do not prove identical neighbor identities, although the matching I values show no material statistic difference in these runs.
- This is global Moran’s I comparison only; it does not validate local cluster labels or causal interpretation.

Detailed paired results: [`spatial-analysis-crossvalidation.csv`](spatial-analysis-crossvalidation.csv).
