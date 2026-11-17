# VERDICT — Vault Google Handle (vault_f7cd17c43d14) vs OAuth2
## Probe-Before-Act Audit · F1/F13 Binding · 2026-10-18

> **Method:** proposal yang dihantar = delegated claim → semua fakta di-probe live
> (F2). Tiga claim besar proposal **tidak lulus ujian realiti**.

---

## 1. Probe Results (evidence vs claim)

| Claim dalam proposal | Realiti (probe 2026-10-18) | Verdict |
|---|---|---|
| Vault handle = "dimensi baharu" untuk grounding | OAuth2 `/root/.secrets/google_token.json` **sudah live & verified hari ini** — Gmail 201 threads, Drive list, Calendar list semua ditarik berjaya; 3 bridge (calendar/drive/email) AKTIF; mailgw-broker aktif | ❌ **Basi** — "dimensi baharu" tu sudah wujud |
| Handle = jalan selamat (agent tak nampak plaintext) | Google **BotGuard MENOLAK** cold headless VPS login (recorded in hermes MEMORY.md) — password lane **MATI untuk automation**; cuma boleh via cookie-import/phone = escape manual | ❌ **Lane mati** untuk kegunaan agensi |
| "Cadangan: tukar ke OAuth2 / Workspace MCP" | OAuth2 + Workspace bridges **bukan alternatif — ia sistem semasa**. google_token.json: scopes `drive, gmail.modify, gmail.send, spreadsheets, calendar, userinfo.email, openid` | ❌ **Terbalik** — bukan "tukar ke", tapi "sudah ada" |
| W₃ = √(Human×AI×Earth) | Canon QG spec: W³ = **∛**(H×AI×Earth) — cube root | ⚠️ Salah formula (kecil) |
| Semua operasi hantar "wajib disekat 888_HOLD" | **`draft_send` terlepas gate** (classifier `startsWith("draft")` → REVERSIBLE padahal ia HANTAR e-mel sebenar) + `email_bridge.py` jalan sebagai **root** tanpa gate | ❌ **PALSU pada masa audit** — fixed hari ini (§3) |

## 2. Apa yang proposal betul

- **Tiga-tahap kuasa (Read / Draft / External-Mutation→888_HOLD)** — model ni betul dan
  mengikut canon. Ia patut diikat pada **OAuth surface yang hidup**, bukan pada handle
  password yang mati.
- **F6 PII filter sebelum memori** — betul, HERMES P1-7 memang untuk ini.
- **Prompt-injection risk pada kandungan e-mel** — betul, sentinel + content boundaries
  sudah wujud (browserInjectionSentinel), tapi wajib aktif untuk lane e-mel.
- **2FA akan block headless** — betul, malah lebih teruk: BotGuard dah pun block, sebelum
  2FA lagi.

## 3. Tindakan diambil hari ini (bukti)

1. **Gate hole FIXED** (`forgeGoogleWorkspace.ts`): `draft_send` kini IRREVERSIBLE →
   fail-closed 888_HOLD. Live-verified: `send` dan `draft_send` **kedua-dua HOLD**
   (A-THINK guard + classifier — dua lapis).
2. **Lane status dilabel:** password-vault lane = DEAD_FOR_AUTOMATION (BotGuard),
   escape manual sahaja (cookie-import / phone direct-URL).
3. Fail terkunci: `google_token.json` = 640 root:root + ACL `user:forge:r--`
   (gmail_bridge perlu baca; residual diketahui — see §5).

## 4. Jawapan kepada soalan F13 (binary untuk Arif)

Soalan asal: *"vault_policy.json (Read/Draft sahaja) ATAU tukar ke OAuth2 scoped?"*

**Jawapan sebenar: OAuth2 sudah pun sistem kita.** Yang tinggal bukan "tukar" — tapi
**penguncian skop**. Dua pilihan sebenar:

| | Pilihan | Apa implikasi | Kos pada awak |
|---|---|---|---|
| **A (disyorkan)** | **Kecilkan skop OAuth** → `gmail.readonly` + `gmail.compose` (draft sahaja) + `drive.readonly` + `calendar` — buang `gmail.send` + `gmail.modify` dari token | Server-side: walaupun gate bocor, API Google sendiri MENOLAK hantar. Dua lapis → tiga lapis | **2 minit sekali** — re-auth sekali di phone (consent screen) |
| **B** | Kekal skop penuh + bergantung pada gate semasa (A-THINK + classifier fix + 888_HOLD design) | Gate dah berlapis tapi semua di kotak kita; kalau gate pecah, e-mel keluar | 0 — tapi risiko tinggal pada kod kita |

**Untuk handle vault pula:** jangan buat `vault_policy.json` untuk lane yang tak boleh
jalan (Law 3 — failure class wujud tapi mekanisme itu tak akan dipanggil). Cukup:
**label lane mati** (dah dibuat) + kekalkan sebagai escape manual milik awak sahaja —
ejen tak sentuh. Kalau awak mahu cookie-import lane hidup semula, baru kita bina
governance untuknya.

## 5. Residual risk (jujur)

1. `email_bridge.py` (IMAP/SMTP app-password) jalan sebagai **root** — canon Gmail
   dah pun verdict ini: `ENFORCED_WITH_ROOT_RESIDUAL`. Perlu migrate ke uid mail-gateway.
2. `google_token.json` ACL benarkan `forge` baca — perlu untuk gmail_bridge, tapi
   mana-mana proses uid forge boleh baca token. Residual diterima setakat ini.
3. Skop token sekarang **lebih luas dari yang kita perlu** — sebab itu Pilihan A penting.
4. `gmail.modify` dalam token = label/trash boleh dilakukan tanpa gate (REVERSIBLE
   classifier) — benign tapi patut tahu.

---

**Satu ayat:** Proposal itu betul tentang risiko, tapi terbalik tentang realiti — OAuth2
dah hidup, lane password dah mati (BotGuard), dan gap sebenar (draft_send terlepas gate)
dah pun ditemui dan ditampal hari ini; tinggal satu keputusan kecil: kecilkan skop token
(2 minit kerja awak, A) atau biar (B).

DITEMPA BUKAN DIBERI ⚒️
