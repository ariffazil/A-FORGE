#!/usr/bin/env bash
# FORGE Telegram Notifier — sends messages via 777 FORGE bot (@arifOS_bot)
# Usage: forge-notify.sh "message text" [parse_mode]
# F13 SOVEREIGN: sends to Arif's personal chat only.

set -euo pipefail

TOKEN_FILE="/root/.secrets/tokens/telegram-opencode-bot"
CHAT_ID="267378578"

if [ ! -f "$TOKEN_FILE" ]; then
  echo "[NOTIFY] ERROR: Token file missing: $TOKEN_FILE"
  exit 1
fi

TOKEN=$(cat "$TOKEN_FILE" | tr -d '[:space:]')
MESSAGE="${1:-[FORGE] No message provided}"
PARSE_MODE="${2:-Markdown}"

# Sanitize message for Telegram Markdown
# Remove problematic characters that break Markdown parsing
MESSAGE=$(echo "$MESSAGE" | sed 's/≤/<=/g; s/≥/>=/g; s/ΔS/DS/g' | tr -d '\000-\037')
if [ ${#MESSAGE} -gt 4000 ]; then
  MESSAGE="${MESSAGE:0:3997}..."
fi

# Send without parse_mode to avoid Markdown parsing errors
RESPONSE=$(curl -sf -X POST "https://api.telegram.org/bot${TOKEN}/sendMessage" \
  -d chat_id="${CHAT_ID}" \
  -d text="${MESSAGE}" \
  --max-time 10 2>/dev/null || echo '{"ok":false}')

OK=$(echo "$RESPONSE" | python3 -c "import json,sys; print(json.load(sys.stdin).get('ok', False))" 2>/dev/null || echo "False")

if [ "$OK" = "True" ]; then
  echo "[NOTIFY] Sent to Arif (${CHAT_ID})"
else
  echo "[NOTIFY] FAILED to send"
fi
