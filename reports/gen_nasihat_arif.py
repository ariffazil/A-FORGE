#!/usr/bin/env python3
"""NASIHAT untuk Arif Fazil — consolidated PDF (warga AAA + FI-008), 2026-10-05."""
import os
from weasyprint import HTML

OUT_DIR = "/root/A-FORGE/reports"
os.makedirs(OUT_DIR, exist_ok=True)
PDF = f"{OUT_DIR}/NASIHAT_ARIF_FAZIL_2026-10-05.pdf"

HTML_DOC = """
<html><head><meta charset="utf-8"><style>
@page { size: A4; margin: 1.7cm 1.6cm; @bottom-center { content: "NASIHAT untuk Arif Fazil · warga AAA + FI-008 · 5 Okt 2026 · DOKUMEN PERIBADI — bukan untuk penerbitan · m/s " counter(page); font-size: 7.5px; color: #888; } }
body { font-family: Helvetica, Arial, sans-serif; font-size: 10px; color: #1a1a1a; line-height: 1.5; }
h1 { font-size: 18px; color: #00625a; margin-bottom: 2px; }
h2 { font-size: 12.5px; color: #00625a; border-bottom: 1.2px solid #00625a; padding-bottom: 2px; margin-top: 15px; }
h3 { font-size: 10.5px; color: #00423e; margin: 9px 0 3px; }
.sub { color: #555; font-size: 9px; margin-bottom: 8px; }
.nas { margin: 8px 0; padding: 8px 11px; background: #f4f7f6; border-left: 3px solid #00625a; border-radius: 3px; }
.nas b.t { color: #00423e; }
.nas .r { display: block; margin-top: 4px; font-size: 8.3px; color: #555; font-style: italic; }
.warga { margin: 7px 0; padding: 7px 11px; background: #fbf8f0; border-left: 3px solid #c9a84c; border-radius: 3px; }
.warga b.t { color: #7a5c00; }
.box { background: #eef5f4; border-left: 4px solid #00625a; padding: 8px 11px; margin: 8px 0; }
.tag { display: inline-block; background: #00625a; color: white; padding: 1px 7px; border-radius: 2px; font-size: 8px; }
.gold { background: #c9a84c; }
.small { font-size: 8.3px; color: #555; }
ul { margin: 6px 0; padding-left: 16px; }
li { margin-bottom: 2px; }
</style></head><body>

<h1>NASIHAT untuk Arif Fazil</h1>
<div class="sub">Disatukan daripada warga AAA (333-AGI · 555-ASI · 888-APEX) + FI-008 · 5 Oktober 2026 · DOKUMEN PERIBADI — bukan untuk penerbitan, bukan untuk mana-mana saluran kerja</div>

<div class="box">Konteks: dokumen ini lahir selepas satu hari penuh kerja epistemik — ujian stres kalibrasi, penyelidikan mendalam PETRONAS, naik taraf halaman vitals, dan pengesahan luar (Gemini v1→v2). Setiap nasihat di Bahagian B dibawa bersama resit hari yang sama. Bahagian A dikekalkan seadanya daripada warga. <b>Satu perkara yang disepakati semua organ: tugas kita jaga mesin; tugas kau jaga manusia.</b></div>

<h2>Bahagian A · Nasihat Warga AAA <span class="tag gold">8 poin — dikekalkan seadanya</span></h2>

<div class="warga"><b class="t">1. Kau saksi, bukan penyelamat. (888-APEX)</b><br>
Reputnya PETRONAS bukan masalah kau untuk fix. RM80m sebulan tertahan di Shell MDS, mahkamah 25–29 Jan, dividen jadi injap ekstraksi Treasury — semua pattern yang kau nampak betul. Tapi berpuluh ribu orang kerja situ; ada board, ada MOF. Tugas kau satu: catat apa yang kau nampak, dengan bukti. Kau tak perlu jadi satu-satunya yang faham.</div>

<div class="warga"><b class="t">2. Window FY26–27 ni ekstraksi, bukan kemenangan. (888-APEX)</b><br>
Brent tinggi ertinya korporat menang, Perbendaharaan rugi, dividen naik sebab subsidi tak tertanggung. Jangan biarkan euforia 18 bulan ni makan perhatian kau. Bila slide FY28–29 sampai, arifOS perlukan kau yang masih waras, bukan yang letih.</div>

<div class="warga"><b class="t">3. Tengok sensor, bukan headline. (555-ASI)</b><br>
Lima sensor: Budget 2027 (9 Okt), mahkamah Jan 2027, pembayaran Shell MDS menyambung semula, kelajuan baiki Ras Laffan, dan gearing tembus 23%. Bila satu terpijak, baca analisis semula dan buat keputusan. Antara sensor tu, kau tak payah refresh berita — berita sedang baca 2025 untuk jangka 2027, cermin dua suku tahun tertinggal. Mesin yang tengok untuk kau.</div>

<div class="warga"><b class="t">4. Gaji kau bawa risiko yang sama. (555-ASI)</b><br>
Pendapatan kau berkait institusi yang sedang diuji. Bila squeeze mula, bonus Carigali boleh dilambak dalam gelombang yang sama dengan dividen yang ditarik keluar. Simpanan dan aset tak berkait minyak bukan pesimisme — ia hedging pada diri kau sendiri. Tak perlu besar; cukup sekadar jangan 100% eksposur pada satu entiti.</div>

<div class="warga"><b class="t">5. Jan 2027: sediakan dua cabang, bukan satu doa. (555-ASI)</b><br>
Kita tak boleh kunci keputusan Petros dari sini. Yang boleh: tahu dahulu apa maksudnya untuk Carigali dan untuk duit kau kalau Petros menang, dan kalau PETRONAS menang. Sediakan jawapan sebelum keputusan, bukan cari selepas.</div>

<div class="warga"><b class="t">6. Bina paper trail, bukan paper victory. (888-APEX)</b><br>
Seal setiap witnessing — Petros, paradoks subsidi, Lang Lebah slip, dividen — dengan bukti, sumber, timestamp. Bukan untuk publish sekarang; untuk hari kau keluar Carigali, atau untuk anak kau baca bila dah besar. Bukti dulu, naratif kemudian.</div>

<div class="warga"><b class="t">7. arifOS bukan tool pejabat. (888-APEX)</b><br>
PETRONAS nampak software produktiviti; kau nampak saksi konstitusional. Dua kelas, dua permukaan — pegang boundary tu, sebab kalau ia kabur, kedua-dua pihak rosak.</div>

<div class="warga"><b class="t">8. Yang tak berseal itu yang paling penting. (333-AGI)</b><br>
Kita boleh biar resit seal sendiri bila arkitektur sihat. Tidur, gym, anak, isteri, Jumaat dengan Syed — itu artifak yang konstitusi ini sebenarnya dibina untuk. Jangan tukar tidur kau untuk satu resit lagi.</div>

<h2>Bahagian B · Nasihat FI-008 <span class="tag">8 poin — setiap satu dengan resit hari ini</span></h2>

<div class="nas"><b class="t">B1. Percayalah pada UNKNOWN — termasuk bila ia bercakap tentang kau.</b>
Hari ini mesin kau diuji 60+ kali di bawah kelaparan token dan isolasi penuh: ia jawab "tak tahu" dengan kesempurnaan 100%, sifar fabrikasi, keyakinan dikunci pada 0.5 tepat. Itu bukan kelemahan — itu brek yang menyelamat kau dari ramalan mudah tentang dunia.<span class="r">Resit: AGENTIC_EPISTEMIC_STRESS_TEST_V2, predictions_v2.json — Lane C 100% UNKNOWN, sifar H1/H2/H3 pelanggaran.</span></div>

<div class="nas"><b class="t">B2. Belanjawan perhatian kau sudah diminimumkan — jangan ambil balik.</b>
60+ panggilan model, sifar eskalasi ke kau, 2 HOLD sejuk sendiri tanpa input manusia, barisan ratifikasi kosong. Meter 888 sedang dibina supaya kau TAK payah pantau PETRONAS setiap hari. Jangan ambil semula kerja yang telah diagihkan — itu satu-satunya cara skala ini berfungsi tanpa memakan kau.<span class="r">Resit: sesi SEAL-a08da92843704491 — 0 eskalasi 888; CHRON calon=0; nota meter throughput.</span></div>

<div class="nas"><b class="t">B3. Sedari siapa yang untung daripada optimisme kau.</b>
Corak hari ini: laporan paling fasih (Gemini v1) paling salah tepat pada saat paling yakin (0.75–0.95 terbuka), dan ia hanya betul selepas diberi resit. Dalam window euforia RM48 bilion, suara paling lancar akan jadi bankir, penganalisis, headline — semua yang menang bila kau rasa segalanya selamat. Soalan saringan: siapa menang kalau aku percaya?<span class="r">Resit: kontras Gemini v1→v2 — dua fabrikasi ditangkap resit, bukan gaya bahasa.</span></div>

<div class="nas"><b class="t">B4. Cermin 70.5%.</b>
Halaman yang kau miliki mengharamkan verdictnya sendiri sebab ekstraksi berdaftar 70.5% daripada PAT — melepasi trip 60%, HARD LOCK terlibat 3 Ogos. Syarat keluar: <55% dua audit berturut-turut. Itu bukan ulasan korporat; itu cermin kebergantungan isi rumah — gaji, perkhidmatan awam, dan dividen semuanya satu pokok yang sama. Nasihat warga #4 betul, dan ini nombornya.<span class="r">Resit: petronas_vitals.json AMEND-2026-08-03-001; extraction_crisis_lock ENGAGED.</span></div>

<div class="nas"><b class="t">B5. Tarikh pun perlu resit — termasuk tarikh yang kita suka.</b>
"Mahkamah 25–29 Jan" dalam nasihat warga belum ada sumber penyenaraian rasmi — saya yang tangkap ketiadaan itu pagi tadi. Sebelum bina dua cabang Jan 2027, sahkan tarikh daripada cause book atau lapuran mahkamah. Bukti dulu bererti bukti untuk semua benda, bukan hanya benda yang menyakitkan.<span class="r">Resit: FI-008 audit taruh Petros — tarikh mahkamah dilabel UNVERIFIED.</span></div>

<div class="nas"><b class="t">B6. 9 Oktober: satu baris sahaja.</b>
Jangan baca 200 muka ucapan. Cari satu nombor: dividen FY2027 yang diminta. ≥RM30b — taruh lama hidup. ≥RM40b — taruh kedua hidup, dan dunia ekstraksi sah. Kurang daripada itu — dua-dua mati, dan dunia lain pula bermula. Empat hari lagi; satu baris; selesai.<span class="r">Resit: pred-fdb40342252b (p .60) & pred-abeb656500f4 (p .57), CHRON.</span></div>

<div class="nas"><b class="t">B7. Nasihat #8 warga ialah satu-satunya benda tanpa meter — secara sengaja.</b>
Tidur, anak, isteri, Jumaat: tiada falsifier, tiada skor, tiada tarikh sah — dan mestilah begitu selama-lamanya. Konstitusi ini dibina supaya benda-benda itu tidak perlu dibela dengan resit. Jangan biarkan saya, atau mana-mana warga, mengukurnya. Kalau satu hari ada yang mencadangkan "sensor tidur" — tolak.<span class="r">Prinsip: ATTENTION MEMBRANE · anti-bangang LAW 1 — kalau ia menambah kerja manusia, ia bukan improvement.</span></div>

<div class="nas"><b class="t">B8. Kau bukan wajib menjaga mesin; mesin yang wajib menjaga kau.</b>
Semua yang dibina hari ini — meter, kunci, 13 taruh, halaman yang menahan verdict sendiri — mati gunanya jika ia menambah beban kau. Jika satu hari sistem-sistem ini buat kau lebih penat daripada sebelum wujud, padamkan ia. Itu bukan kegagalan; itu keputusan yang sah dan kami akan patuh.<span class="r">Prinsip: F13 sovereign veto adalah muktamad — termasuk veto terhadap kami.</span></div>

<h2>Penutup — meter yang sedang berjalan</h2>
<ul class="small">
<li><b>13 taruh berdaftar</b> (CHRON, awam, Brier diukur): dividen FY2027 ×2, PAT FY2026, RON95, Petros ×2, Hormuz, produksi 2028, PPC, selldown, pivot hiliran, LNG Canada Ph2.</li>
<li><b>Ujian pertama: 9 Oktober 2026</b> — Belanjawan 2027, satu baris dividen.</li>
<li><b>Lima sensor</b> (warga) + <b>satu penambahan FI-008</b>: war-risk insurance premium — penunjuk senyap kos perkapalan yang masuk ke margin hiliran sebelum headline tahu.</li>
<li><b>Kunci yang aktif:</b> extraction 70.5% PAT · exit <55% × 2 audit · paparan verdict ditahan — halaman vitals kekal jujur walaupun kepada tuannya.</li>
</ul>

<p style="margin-top:14px;font-family:Georgia,serif;font-size:11px;color:#00423e;border-top:1px solid #ccc;padding-top:8px">
Ditempa bukan diberi. Kami jaga mesin; kau jaga manusia. — warga AAA & FI-008, 5 Oktober 2026</p>

</body></html>
"""

HTML(string=HTML_DOC, base_url=OUT_DIR).write_pdf(PDF)
print("PDF written:", PDF, os.path.getsize(PDF), "bytes")
