#!/usr/bin/env python3
"""Generate PETRONAS 3-Year Agentic Outlook PDF (2026-10-05)."""
import os
from weasyprint import HTML
from datetime import date

OUT_DIR = "/root/A-FORGE/reports"
os.makedirs(OUT_DIR, exist_ok=True)
PDF = f"{OUT_DIR}/PETRONAS_3YR_AGENTIC_OUTLOOK_2026-10-05.pdf"

HTML_DOC = """
<html><head><meta charset="utf-8"><style>
@page { size: A4; margin: 1.6cm 1.5cm; @bottom-center { content: "PETRONAS 3-Year Agentic Outlook · FI-008 · 2026-10-05 · page " counter(page); font-size: 8px; color: #777; } }
body { font-family: Helvetica, Arial, sans-serif; font-size: 9.5px; color: #1a1a1a; line-height: 1.45; }
h1 { font-size: 19px; color: #00625a; margin-bottom: 2px; }
h2 { font-size: 13px; color: #00625a; border-bottom: 1.5px solid #00625a; padding-bottom: 2px; margin-top: 14px; }
h3 { font-size: 10.5px; color: #00423e; margin-bottom: 3px; }
.sub { color: #555; font-size: 9px; margin-bottom: 8px; }
table { border-collapse: collapse; width: 100%; margin: 6px 0; font-size: 8.6px; }
th { background: #00625a; color: white; padding: 3px 5px; text-align: left; }
td { border-bottom: 0.5px solid #ccc; padding: 3px 5px; vertical-align: top; }
tr:nth-child(even) { background: #f2f8f7; }
.box { background: #eef5f4; border-left: 4px solid #00625a; padding: 7px 9px; margin: 7px 0; }
.warn { background: #fdf3e7; border-left: 4px solid #c05621; padding: 7px 9px; margin: 7px 0; }
.bm { font-size: 9px; }
.small { font-size: 7.8px; color: #555; }
.tag { display: inline-block; background: #00625a; color: white; padding: 1px 6px; border-radius: 2px; font-size: 8px; }
ol li, ul li { margin-bottom: 3px; }
</style></head><body>

<h1>PETRONAS — Agentic 3-Year Outlook (Q4 2026 → 2029)</h1>
<div class="sub">Deep-research prediction brief · prepared by FI-008 (warga-aaa) for F13 Sovereign · 5 October 2026 ·
All stakes planted in CHRON with calibration tracking · <b>SAFE_TO_STUDY — analytical input, not decision authority (WEALTH organ doctrine)</b></div>

<h2>1 · Ringkasan Eksekutif (BM)</h2>
<div class="box bm">
PETRONAS <b>tidak dalam krisis</b> — naratif media Sep-Oct 2025 ("dividen terendah 9 tahun, pemotongan 5,000 pekerja, CEO memberi amaran syarikat mungkin gagal tanpa tindakan") telah terbalik oleh realiti terukur: H1 2026 untung selepas cukai <b>RM27.2 bilion (+4%)</b>, volum LNG eksport <b>+17%</b>, dan Brent
perang <b>USD101.57</b> menjadikan senario dividen kerajaan <b>RM45-48 bilion</b> untuk FY2027 — lebih dua kali ganda anggaran lama.
Struktur sebenar 3 tahun: (1) premium perang Hormuz menyokong uptream tetapi membengkakkan bil subsidi Malaysia (RM40-50b) — tekanan
politik akan menuntut dividen lebih tinggi SEMASA PETRONAS menjana capex terbesar dekadnya (LNG Canada Ph2 RM94.7b, Suriname,
IDD Indonesia); (2) pertikaian Sarawak-Petros kini di Mahkamah Persekutuan — risiko struktur domestik No. 1 pada rantai nilai gas;
(3) penaiktarafan tenaga kerja selesai dalam regime untung terkuat sejak 2022 — setup margin, bukan kemerosotan. Ketidakpastian
dominan: laluan penyelesaian Hormuz (50/50 menjelang akhir 2027). Media arus perdana mengekstrapolasi trend harga 6 bulan;
rejim perang memecahkan ekstrapolasi itu — itulah lubang analisis yang brief ini isi.
</div>

<h2>2 · Measured Baseline (5 Oct 2026, LIVE where marked)</h2>
<table>
<tr><th>Indicator</th><th>Value</th><th>Source / Class</th></tr>
<tr><td>Brent crude (spot)</td><td><b>USD 101.57</b> · regime UPTREND (conf 0.95), EMA200 98.67</td><td>WEALTH organ LIVE feed · war premium est. +USD 25-35 vs pre-war ~70</td></tr>
<tr><td>USD/MYR · DXY · VIX · US10Y</td><td>4.09 · 102.3 · 15.85 · 5.31%</td><td>WEALTH macro snapshot — note: equity vol CALM despite war</td></tr>
<tr><td>Group H1 2026 PAT</td><td><b>RM 27.2b</b> (+4% YoY); LNG export volumes +17%</td><td>Results coverage, Sep 2026 (reported)</td></tr>
<tr><td>Dividend to govt FY2026</td><td>RM 20b confirmed (Feb 2026) — set when Brent ~65-70; scenario now RM48b if Brent holds</td><td>The Star 2026-02-27; The Edge 2026-10-02</td></tr>
<tr><td>Fuel subsidy bill</td><td>RM 40-50b at war-Brent — exceeds even the high dividend case</td><td>KLSE Screener / Edge Budget 2027 coverage</td></tr>
<tr><td>LNG Canada Phase 2</td><td><b>FID TAKEN 29-30 Sep 2026</b> — C$33b (~RM94.7b), capacity → 28 MTPA; PETRONAS JV partner</td><td>The Star 2026-09-30; lngcanada.ca</td></tr>
<tr><td>Sensitivity (MOF est.)</td><td>Every +USD 10/bbl ⇒ +RM 3-4b PETRONAS dividend</td><td>The Star 2026-10-05</td></tr>
<tr><td>Workforce</td><td>~5,000 rightsizing (announced Jun 2025), rounds Mar + Aug 2026; hiring freeze lifts Dec 2026</td><td>Reuters 2025-06-05; Activity Outlook</td></tr>
<tr><td>Sarawak / Petros</td><td>PETRONAS motion at Federal Court (filed 12 Jan 2026); High Court ruling (28 Feb 2026) on banking-law grounds only; constitutional question pending; commercial talks slipped past "early 2026"</td><td>Bloomberg/EnergyConnects 2026-01; fulcrum.sg 2026-04</td></tr>
<tr><td>Pipeline (sanctioned)</td><td>LNG Canada Ph2; Suriname Block 52 (2nd FID + FLNG targeted 2026); Indonesia IDD w/ Eni (~US$15b, FID Mar 2026); domestic 2026-2028: hold ~2 MMboe/d (Belud, Sepat, Kurma Manis EOR)</td><td>Activity Outlook 2026-2028; project releases</td></tr>
</table>

<h2>3 · Media vs Measured — Four Critical Checks</h2>
<h3>Check 1 — "Dividend collapse / lowest in 9 years" (Oct 2025 narrative)</h3>
<p>Media extrapolated the 2025 soft-price regime into fiscal policy. Measured reality: that RM20b figure was priced at Brent ~USD 65-70.
At war-Brent 100+, MOF's own sensitivity (+RM3-4b per +USD10) puts FY2027 at RM45-48b. The "collapse" narrative died within 11 months.
<b>Lesson: media extrapolates 6-month price trends; regime breaks (war) invalidate the extrapolation.</b></p>
<h3>Check 2 — "Layoffs = decline"</h3>
<p>Social media still recirculates job-cut stories with wrong dates (some claim 2023). Measured: the ~10% rightsizing was announced Jun 2025,
executed Mar-Aug 2026 — landing into the strongest earnings regime since 2022 (H1 PAT +4%, LNG +17%). Cost-out into record margin is
margin-expansion setup, not distress. Watch the hiring-freeze lift (Dec 2026) as the real inflection signal.</p>
<h3>Check 3 — "Sarawak dispute = legal technicality"</h3>
<p>Media covers episodes (filings, quotes). The structure underneath: Sarawak is securing aggregator economics on ALL new domestic gas
via institutional settlement, not displacement of PETRONAS. The May 2025 joint declaration did not hold; the constitutional question is now
at the Federal Court. Outcomes span co-existence settlement (base) → resource-access restructuring (bear). This is the single largest
DOMESTIC structural variable in the 3-year window — worth more attention than any OPEC headline.</p>
<h3>Check 4 — "War is bad for PETRONAS"</h3>
<p>Nuanced: PETRONAS is structurally net-long (upstream windfall) — the war's fiscal channel literally routes Gulf rent through
PETRONAS to Putrajaya (RM48b dividend scenario funding a RM50b subsidy bill). Real war costs sit elsewhere: Middle East import costs for
refining, war-risk insurance, downstream margin squeeze, and tail risk on shipping lanes. Media reports "oil price up = good for oil
companies"; the integrated picture is rent transfer, not simple windfall.</p>

<h2>4 · Scenario Map 2027-2029 (probabilities sum to 1.00)</h2>
<table>
<tr><th>Path</th><th>p</th><th>Key assumptions</th><th>PETRONAS face</th></tr>
<tr><td><b>BEST — Mediated peace</b></td><td>0.25</td><td>Durable Hormuz reopening by mid-2027; Brent mean-reverts USD 80-90 (elevated by lost capacity + insurance premium); RON95 reform lands; Petros settlement codified</td><td>Dividend RM38-44b; PAT normalises RM45-55b; LNGC Ph2 on schedule; capex intact; sentiment re-rating</td></tr>
<tr><td><b>BASE — Grinding conflict → late-2027 de-escalation</b></td><td>0.50</td><td>Strait impaired through 2027, partial corridors; Brent USD 90-105; subsidy bill RM45-50b forces faster reform; dividend squeezed UP politically</td><td>Dividend RM40-48b; PAT ≥ RM50b FY2026 then flattening; upstream windfall vs downstream drag; rightsizing discipline holds</td></tr>
<tr><td><b>WORST — Escalation / closure deepens</b></td><td>0.25</td><td>Direct US-Iran escalation, Gulf fully closed into 2028; Brent > USD 120 then demand destruction; global recession; MYR pressure</td><td>Windfall 2027 then crash 2028; forced over-dividend into downturn (capital-allocation damage); Petros dispute hardens; LNGC exposed to shipping risk</td></tr>
</table>
<p class="small">CIVX seed (malaysia_fiscal_2027_2040) resilience scores — BEST: fiscal 0.8 / intergenerational 0.8 · BASE: 0.5 / 0.4 · WORST: 0.2 / 0.1. SAFE_TO_STUDY, interpretive only.</p>

<h2>5 · Prediction Stakes (planted in CHRON, auto-verified, Brier-scored)</h2>
<table>
<tr><th>#</th><th>Claim</th><th>p</th><th>Verify by</th><th>Falsifier</th></tr>
<tr><td>1</td><td>PETRONAS FY2027 dividend to federal government ≥ RM40b</td><td>0.62</td><td>2027-10-09 (Budget 2028)</td><td>announced &lt; RM40b</td></tr>
<tr><td>2</td><td>Strait of Hormuz durable reopening (≥60% pre-war transits, ≥60 days) by 31 Dec 2027</td><td>0.50</td><td>2027-12-31</td><td>no such window</td></tr>
<tr><td>3</td><td>LNG Canada Phase 2 first cargo by 31 Dec 2029</td><td>0.70</td><td>2029-12-31</td><td>no Ph2 cargo shipped</td></tr>
<tr><td>4</td><td>PETRONAS-Petros commercial settlement signed by 31 Dec 2027</td><td>0.58</td><td>2027-12-31</td><td>no signed settlement</td></tr>
<tr><td>5</td><td>Group FY2026 profit after tax ≥ RM50b</td><td>0.66</td><td>2027-02-27 (results)</td><td>FY2026 PAT &lt; RM50b</td></tr>
<tr><td>6</td><td>RON95 rationalisation implemented nationwide by 30 Jun 2027</td><td>0.66</td><td>2027-06-30</td><td>flat subsidised RON95 still in effect</td></tr>
<tr><td>7</td><td>Malaysia upstream production averages ≥1.8 MMboe/d in 2028</td><td>0.72</td><td>2028-12-31</td><td>2028 avg &lt; 1.8 MMboe/d</td></tr>
</table>
<p class="small">Pre-existing related stake: "FY2027 dividend ≥ RM30b" (p=0.60) verifies 2026-10-09 Budget day — stake 1 above sharpens it.
Calibration context: institution accuracy 72.6% (n=14, INSUFFICIENT — widen intervals accordingly). No stake exceeds p=0.72: war-regime uncertainty is real.</p>

<h2>6 · What Would Change This Outlook (watchlist)</h2>
<ol>
<li><b>Hormuz transits</b> (IMF PortWatch): sustained climb above ~50/day = BEST-path trigger; strike on a major terminal = WORST trigger.</li>
<li><b>Federal Court calendar</b> for the PETRONAS-Petros constitutional question; any Sarawak ministerial language shift from "settlement" to "rights".</li>
<li><b>Budget day line items (9 Oct 2026)</b>: dividend assumption embedded in FY2027 revenue; RON95 reform language — first hard test of stakes 1 &amp; 6.</li>
<li><b>War-risk insurance premia</b> on Gulf/Red Sea lanes — the quiet tell for shipping-cost pass-through into downstream margins.</li>
<li><b>PCHEM margins</b> (Q1 2026 loss RM754m → Q2 profit RM445m): China demand stabilisation is the downstream swing factor.</li>
<li><b>Qatar/North America LNG wave 2027-2029</b>: supply wave compresses LNG margins into PETRONAS's own capacity additions — watch long-term contract sigs vs spot.</li>
</ol>

<h2>7 · Sources (primary checks, 5 Oct 2026)</h2>
<p class="small">
energiesmedia.com (H1 2026 PAT, 2026-09-08) · The Star 2026-02-27 &amp; 2026-10-05 (dividend, MOF sensitivity) · The Edge node/820285 &amp; KLSE Screener (Budget 2027, subsidy bill, RM48b scenario, 2026-10-02) · Reuters 2025-10-10 &amp; 2025-06-05 (RM20b/9-yr-low; workforce) · lngcanada.ca + The Star 2026-09-30 (Ph2 FID) · Bloomberg/EnergyConnects 2026-01-12/13 (Federal Court motion) · Borneo Post/AAS 2026-02-28 (High Court ruling) · fulcrum.sg 2026-04-09 (political stakes) · energy-pedia (Activity Outlook 2026-2028) · WEALTH organ live feed (Brent/MYR/DXY/VIX, 2026-10-05T14:17+08:00) · straits.live + thehormuzstrait.com (Hormuz Day-212 status) · opec.org (Sep meeting: production maintained).
</p>

<div class="warn"><b>Epistemic envelope:</b> UNKOWN-enforced. All numbers marked measured/reported carry source dates; forward claims carry amplitudes and will be scored publicly in CHRON (institution calibration: accuracy 72.6%, mean Brier 0.180, n=14 — INSUFFICIENT sample; treat all p values as soft).
This brief is SAFE_TO_STUDY analytical output of the WEALTH organ and FI-008 — it is not an execution authority and does not constitute investment advice. Human final authority: Arif.</div>

<p class="small" style="margin-top:10px">Generated 2026-10-05 22:2x MYT · FI-008 session SEAL-a08da92843704491 · DITEMPA BUKAN DIBERI</p>
</body></html>
"""

HTML(string=HTML_DOC, base_url=OUT_DIR).write_pdf(PDF)
print("PDF written:", PDF, os.path.getsize(PDF), "bytes")
