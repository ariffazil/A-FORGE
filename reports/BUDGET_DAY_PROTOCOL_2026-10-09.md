# BUDGET DAY PROTOCOL — 9 Oktober 2026 (Runbook FI-008)
**Trigger:** Belanjawan 2027 dibentang, Parlimen, 9 Okt 2026 (~4 petangMYT typical).
**Fungsi:** satu-satunya tugas hari itu — ambil SATU nombor, selesaikan dua taruh, kemas kini dunia. 30 minit kerja.

## 1. Data to pull (in order)
1. MOF Budget speech transcript → search "PETRONAS" / "dividen" → **FY2027 dividend figure asked from PETRONAS** (the line item, not narrative).
2. Fiscal Outlook / Anggaran Hasil report → PETRONAS dividend line for FY2027 (the printed assumption).
3. Subsidy line: fuel subsidy allocation FY2027 + any RON95 rationalisation mechanics (tiered/targeted/market-linked + date).

## 2. Decision tree (pre-registered — no improvisation on the day)
| Dividen FY2027 | Makna | Taruh resolved |
|---|---|---|
| ≥ RM40B | War-extraction regime confirmed; BIMB/Edge scenario realised | pred-abeb656500f4 (p.57) TRUE · pred-fdb40342252b (≥30b, p.60) TRUE |
| RM30B – RM40B | Partial pass-through; subsidy pressure real but tempered | pred-fdb40342252b TRUE · pred-abeb656500f4 FALSE |
| < RM30B | Extraction regime NOT confirmed at federal level; Brent pass-through lagging | both FALSE (major surprise → re-model) |

## 3. Post-read actions (within the hour)
1. `chron_record_verification` × 2 (pred-fdb40342252b, pred-abeb656500f4) with the printed figure as evidence.
2. Update /vitals/ prebudget-alert banner → result state (one block, addendum pattern; seals untouched).
3. Telegram ping to AAA group: the number + what it resolved (3 lines, no essay).
4. If < RM30B or ≥ RM48B (outside both bands): flag anomaly → deep re-model before any stake adjustment.

## 4. RON95 second read (same day)
Rationalisation mechanic announced? → log for pred-97dda4e0152c (implementation by Jun 2027, p .59). Announcement ≠ implementation — the stake tracks implementation; do NOT pre-resolve.

## 5. Explicit non-goals
- No new stakes planted on budget day (post-euphoria rule: 48h cooling before staking reactions).
- No narrative writing. The number resolves; interpretation waits for the full fiscal outlook PDF.
