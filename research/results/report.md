## A. Field audit: entropy and gap leakage (adjusted mutual information, 2000 permutations; p < 0.05 marked *)
| Field | Distinct | H bits | odd_revision | missing_link | pair |
|---|---|---|---|---|---|
| tests run, log2 bin | 5 | 1.95 | 0.50* | 0.09 | 0.15* |
| failed tests | 7 | 2.13 | 0.22* | -0.05 | 0.14 |
| pass share, quartile | 3 | 0.48 | 0.04 | -0.02 | -0.01 |
| criteria count | 4 | 1.74 | 0.16* | -0.02 | 0.05 |
| tests job | 2 | 1.00 | -0.01 | -0.01 | -0.02 |
| locks before T | 6 | 1.95 | 0.09 | -0.04 | 0.10 |
| locks, PR final | 6 | 2.00 | 0.40* | 0.12 | 0.32* |
| review impacts before T | 4 | 1.27 | 0.09* | -0.02 | -0.04 |
| review impacts, PR final | 5 | 2.05 | 0.39* | -0.06 | 0.22* |
| agent commits before T | 5 | 2.00 | 0.08 | 0.02 | 0.06 |
| agent commits, PR final | 6 | 2.33 | 0.54* | 0.18* | 0.33* |
| human commits before T | 9 | 2.30 | 0.15* | -0.04 | 0.19* |
| human commits, PR final | 7 | 2.37 | 0.39* | 0.25* | 0.38* |
| last commit by a human | 3 | 1.19 | 0.05 | 0.00 | 0.29* |
| gate number within the PR | 4 | 1.95 | 0.01 | 0.04 | -0.02 |
| tests run vs previous gate (sign) | 3 | 1.25 | -0.01 | 0.00 | -0.04 |
| review impacts since previous gate | 4 | 1.47 | 0.01 | -0.03 | -0.06 |
| agent commits since previous gate | 3 | 1.57 | 0.06 | -0.01 | 0.12* |
| pull request | 16 | 3.91 | 0.92* | 0.47* | 1.00* |
| day | 6 | 2.09 | 0.67* | 0.27* | 0.18* |
| outcome (after T) | 4 | 1.68 | -0.00 | 0.03 | 0.08 |
| next action (from the gap) | 4 | 1.90 | 0.60* | 0.14* | -0.03 |
| defects (from the gap) | 4 | 1.55 | 1.00* | 1.00* | 0.04 |

## B. Observers on the 63 waves of the three levels
| Level | Design | Chance | Pre-attentive | MRR | Pixel | MRR | Rule reader | Look vs data ρ (p) | Place vs data ρ (p) | Parts/rock | Colours/rock | Bytes/rock |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | current | 19% | 86% | 0.92 | 5% | 0.33 | 100% | 0.29 (0.00) | 0.02 (0.29) | 118 | 7.1 | 449 |
| 2 | current | 19% | 48% | 0.67 | 38% | 0.52 | 100% | 0.14 (0.01) | -0.00 (0.48) | 138 | 8.2 | 496 |
| 3 | current | 19% | 14% | 0.40 | 24% | 0.44 | 100% | 0.04 (0.23) | -0.04 (0.73) | 115 | 7.7 | 456 |
| 1 | proposed | 19% | 62% | 0.81 | 24% | 0.51 | 100% | 0.55 (0.00) | 0.02 (0.39) | 92 | 12.8 | 631 |
| 2 | proposed | 19% | 33% | 0.60 | 14% | 0.38 | 100% | 0.43 (0.00) | -0.08 (0.93) | 109 | 13.8 | 692 |
| 3 | proposed | 19% | 14% | 0.41 | 24% | 0.44 | 100% | 0.35 (0.00) | 0.05 (0.15) | 88 | 13.5 | 651 |

## C. Noise: the same run drawn in different waves
| Level | Design | Runs seen twice+ | Same run, pixel distance | Different runs, pixel distance | Noise ratio | Position change, cells (standard vs adaptive) |
|---|---|---|---|---|---|---|
| 1 | current | 21 | 0.075 | 0.077 | 0.98 | 1.17 |
| 2 | current | 29 | 0.054 | 0.078 | 0.69 | 1.50 |
| 3 | current | 28 | 0.048 | 0.066 | 0.72 | 1.26 |
| 1 | proposed | 21 | 0.007 | 0.112 | 0.06 | 0.00 |
| 2 | proposed | 29 | 0.012 | 0.117 | 0.10 | 0.00 |
| 3 | proposed | 28 | 0.012 | 0.109 | 0.11 | 0.00 |

## D. Difficulty by step (scored waves 1-20; four waves per step)
| Level | Measure | Step 1 | Step 2 | Step 3 | Step 4 | Step 5 |
|---|---|---|---|---|---|---|
| 1 | chance | 25% | 20% | 17% | 17% | 14% |
| 1 | AI stored run | 100% | 100% | 100% | 100% | 100% |
| 1 | pre-attentive, current | 100% | 75% | 75% | 75% | 100% |
| 1 | pre-attentive, proposed look | 75% | 50% | 75% | 100% | 25% |
| 1 | pre-attentive, proposed look + context-ordered controls | 50% | 100% | 75% | 75% | 50% |
| 1 | context spread, current waves | 0.32 | 0.29 | 0.30 | 0.30 | 0.33 |
| 1 | context spread, context-ordered | 0.25 | 0.27 | 0.31 | 0.29 | 0.33 |
| 2 | chance | 25% | 20% | 17% | 17% | 14% |
| 2 | AI stored run | 100% | 100% | 75% | 100% | 100% |
| 2 | pre-attentive, current | 75% | 75% | 75% | 0% | 25% |
| 2 | pre-attentive, proposed look | 75% | 25% | 25% | 25% | 0% |
| 2 | pre-attentive, proposed look + context-ordered controls | 0% | 50% | 50% | 25% | 0% |
| 2 | context spread, current waves | 0.25 | 0.29 | 0.32 | 0.28 | 0.29 |
| 2 | context spread, context-ordered | 0.17 | 0.27 | 0.28 | 0.32 | 0.37 |
| 3 | chance | 25% | 20% | 17% | 17% | 14% |
| 3 | AI stored run | 100% | 100% | 100% | 100% | 100% |
| 3 | pre-attentive, current | 25% | 25% | 0% | 0% | 0% |
| 3 | pre-attentive, proposed look | 50% | 25% | 0% | 0% | 0% |
| 3 | pre-attentive, proposed look + context-ordered controls | 100% | 0% | 75% | 50% | 50% |
| 3 | context spread, current waves | 0.28 | 0.31 | 0.33 | 0.31 | 0.36 |
| 3 | context spread, context-ordered | 0.17 | 0.30 | 0.29 | 0.32 | 0.32 |

## E. Context-ordered controls, all 21 waves
| Level | Pre-attentive | MRR | Pixel | Rule reader | Look vs data ρ (p) |
|---|---|---|---|---|---|
| 1 | 67% | 0.83 | 19% | 100% | 0.65 (0.00) |
| 2 | 24% | 0.57 | 10% | 100% | 0.44 (0.00) |
| 3 | 52% | 0.70 | 24% | 100% | 0.53 (0.00) |

## G. Salience sweep: group encoding (mineral and outline per pull request) x context strength α (halo, craters, alien, size)
| Context | Group | α | Waves | Pre-attentive L1/L2/L3 | Context-only L1/L2/L3 | Rule reader L1/L2/L3 | Look vs data ρ L1/L2/L3 | Bytes/rock | Admissible |
|---|---|---|---|---|---|---|---|---|---|
| absolute | off | 0 | current waves | 81% / 90% / 90% | 19% / 19% / 19% | 100% / 100% / 100% | 0.21 / 0.39 / 0.37 | 447 | no |
| absolute | off | 0 | context-ordered waves | 67% / 67% / 76% | 19% / 19% / 19% | 100% / 100% / 100% | 0.34 / 0.38 / 0.46 | 444 | no |
| absolute | off | 0.25 | current waves | 52% / 19% / 14% | 24% / 14% / 5% | 100% / 100% / 100% | 0.44 / 0.41 / 0.38 | 698 | no |
| absolute | off | 0.25 | context-ordered waves | 81% / 24% / 10% | 48% / 24% / 14% | 100% / 100% / 100% | 0.48 / 0.49 / 0.37 | 695 | no |
| absolute | off | 0.5 | current waves | 52% / 19% / 10% | 19% / 10% / 0% | 100% / 100% / 100% | 0.51 / 0.41 / 0.41 | 696 | no |
| absolute | off | 0.5 | context-ordered waves | 86% / 24% / 14% | 29% / 29% / 5% | 100% / 100% / 100% | 0.53 / 0.52 / 0.38 | 694 | no |
| absolute | off | 1 | current waves | 57% / 19% / 14% | 24% / 10% / 10% | 100% / 100% / 100% | 0.53 / 0.44 / 0.44 | 680 | no |
| absolute | off | 1 | context-ordered waves | 86% / 29% / 14% | 33% / 19% / 5% | 100% / 100% / 100% | 0.54 / 0.54 / 0.40 | 677 | no |
| absolute | stable | 0 | current waves | 81% / 62% / 29% | 19% / 0% / 24% | 100% / 100% / 100% | 0.48 / 0.20 / 0.21 | 415 | no |
| absolute | stable | 0 | context-ordered waves | 76% / 48% / 24% | 24% / 14% / 29% | 100% / 100% / 100% | 0.61 / 0.15 / 0.36 | 412 | no |
| absolute | stable | 0.25 | current waves | 62% / 29% / 19% | 10% / 14% / 19% | 100% / 100% / 100% | 0.50 / 0.39 / 0.28 | 671 | no |
| absolute | stable | 0.25 | context-ordered waves | 71% / 19% / 52% | 29% / 14% / 38% | 100% / 100% / 100% | 0.62 / 0.35 / 0.51 | 667 | no |
| absolute | stable | 0.5 | current waves | 62% / 29% / 29% | 19% / 14% / 14% | 100% / 100% / 100% | 0.49 / 0.40 / 0.26 | 674 | no |
| absolute | stable | 0.5 | context-ordered waves | 81% / 29% / 52% | 52% / 10% / 33% | 100% / 100% / 100% | 0.61 / 0.35 / 0.49 | 671 | no |
| absolute | stable | 1 | current waves | 62% / 33% / 14% | 14% / 19% / 14% | 100% / 100% / 100% | 0.55 / 0.43 / 0.35 | 658 | no |
| absolute | stable | 1 | context-ordered waves | 67% / 24% / 52% | 48% / 10% / 48% | 100% / 100% / 100% | 0.65 / 0.44 / 0.53 | 655 | no |
| relative | off | 1 | current waves | 43% / 19% / 14% | 14% / 10% / 1% | 100% / 100% / 100% | 0.44 / 0.39 / 0.41 | 672 | no |
| relative | off | 1 | context-ordered waves | 81% / 24% / 14% | 13% / 26% / 10% | 100% / 100% / 100% | 0.48 / 0.48 / 0.37 | 668 | no |
| relative | stable | 0.5 | current waves | 67% / 29% / 24% | 5% / 14% / 14% | 100% / 100% / 100% | 0.47 / 0.39 / 0.23 | 649 | no |
| relative | stable | 0.5 | context-ordered waves | 81% / 29% / 52% | 24% / 5% / 38% | 100% / 100% / 100% | 0.61 / 0.33 / 0.49 | 644 | no |
| relative | stable | 1 | current waves | 62% / 24% / 14% | 5% / 19% / 10% | 100% / 100% / 100% | 0.51 / 0.41 / 0.28 | 647 | no |
| relative | stable | 1 | context-ordered waves | 86% / 24% / 48% | 24% / 10% / 38% | 100% / 100% / 100% | 0.65 / 0.40 / 0.50 | 643 | no |
- Current design for reference: pre-attentive 86% / 48% / 14%, context-only 19% / 24% / 19%, look vs data ρ 0.29 / 0.14 / 0.04, bytes/rock 467.
- Rule: highest mean ρ with rule reader 100%, pre-attentive not below the current design and context-only within 10 points of chance on every level. Chosen: none.

## H. Placement: where the gap lands and how place follows data
| Level | Layout | Chance | Gap first | Gap last | Place vs data ρ (p) |
|---|---|---|---|---|---|
| 1 | current, shuffled grid | 19% | 14% | 10% | 0.02 (0.29) |
| 1 | proposed, neutral order (content hash) | 19% | 19% | 33% | 0.02 (0.39) |
| 1 | proposed, time order | 19% | 100% | 0% | 0.11 (0.03) |
| 2 | current, shuffled grid | 19% | 0% | 24% | -0.00 (0.48) |
| 2 | proposed, neutral order (content hash) | 19% | 0% | 24% | -0.08 (0.93) |
| 2 | proposed, time order | 19% | 29% | 0% | 0.05 (0.18) |
| 3 | current, shuffled grid | 19% | 14% | 19% | -0.04 (0.73) |
| 3 | proposed, neutral order (content hash) | 19% | 24% | 14% | 0.05 (0.15) |
| 3 | proposed, time order | 19% | 19% | 0% | -0.07 (0.86) |

## I. Learnable leaks: does a drawn channel predict the gap? (each run once per level; adjusted mutual information; * p < 0.05; — not drawn)
| Design | Level | mineral | halo rings | halo colour | halo arc | craters | alien eyes | alien colour | size bin |
|---|---|---|---|---|---|---|---|---|---|
| proposed | 1 | -0.02 | 0.09 | 0.01 | 0.01 | 0.07 | 0.24* | 0.05 | 0.44* |
| proposed | 2 | -0.09 | -0.02 | 0.04 | -0.00 | -0.03 | 0.02 | 0.01 | 0.12 |
| proposed | 3 | 0.11 | 0.14 | -0.06 | -0.04 | -0.08 | 0.05 | 0.34* | 0.19* |
| proposed, relative | 1 | -0.02 | 0.09 | 0.01 | 0.01 | 0.04 | 0.12* | — | — |
| proposed, relative | 2 | -0.09 | -0.02 | 0.04 | -0.00 | -0.06 | -0.00 | — | — |
| proposed, relative | 3 | 0.11 | 0.14 | -0.06 | -0.04 | -0.07 | 0.12* | — | — |
| current | 1 | -0.02 | — | — | — | — | — | — | — |
| current | 2 | -0.05 | — | — | — | — | — | — | — |
| current | 3 | 0.14 | — | — | — | — | — | — | — |

## F. Data volume
- Public gate records: 111; public gate cases: 108 over 10 days (10.8 per day).
- Public gap rows per relation: odd_revision 30, missing_link 8, pair 11, lock_only 4. JUnit case results in public gate records: 2839.
- odd_revision gaps after serio-focus#94 merged (2026-11-19T08:09:39Z): 0 of 30.
- Public gate cases whose pull request has a model-run record: 45 of 108. Game runs with pull-request context at T: 49 of 51.
- Distinct gap rows in the 20 scored waves: level 1 18 (max 2 uses), level 2 6 (max 4 uses), level 3 8 (max 3 uses).
- Share of distinct pull requests per wave: level 1 83%, level 2 87%, level 3 90%.
