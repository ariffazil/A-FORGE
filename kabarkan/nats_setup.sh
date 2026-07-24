#!/bin/bash
# KABARKAN — NATS JetStream Stream Setup
# DITEMPA BUKAN DIBERI
# Run once: bash nats_setup.sh
# Requires: nats CLI (already installed at /usr/local/bin/nats)

set -e

NATS_SERVER="${NATS_SERVER:-nats://127.0.0.1:4222}"
STREAM_NAME="kabarkan_ingest"

echo "=== Kabarkan NATS Setup ==="
echo "Server:  $NATS_SERVER"
echo "Stream:  $STREAM_NAME"
echo ""

# Check existing streams
EXISTING=$(nats stream ls --server "$NATS_SERVER" 2>&1 || true)
if echo "$EXISTING" | grep -qF "$STREAM_NAME"; then
    echo "✅ Stream '$STREAM_NAME' already exists"
    nats stream info "$STREAM_NAME" --server "$NATS_SERVER" 2>&1
    exit 0
fi

# Check for overlapping subjects
nats stream ls --server "$NATS_SERVER" -j 2>/dev/null | python3 -c "
import json, sys
try:
    streams = json.load(sys.stdin)
    for s in streams:
        for subj in s.get('subjects', s.get('config', {}).get('subjects', [])):
            if 'kabarkan' in subj:
                print(f'OVERLAP: stream={s[\"name\"]} overlaps with kabarkan.* subjects')
                sys.exit(1)
except: pass
" && echo "No subject overlap detected" || {
    echo "⚠ Subject overlap detected — checking if kabarkan stream exists under another name..."
    for s in $(nats stream ls --server "$NATS_SERVER" -j 2>/dev/null | python3 -c "
import json, sys
try:
    for s in json.load(sys.stdin):
        print(s.get('name',''))
except: pass
"); do
        echo "  Existing: $s"
    done
}

# Create the stream
echo ""
echo "Creating stream '$STREAM_NAME'..."
nats stream add "$STREAM_NAME" \
    --server "$NATS_SERVER" \
    --subjects="kabarkan.ingest.*" \
    --storage=file \
    --retention=limits \
    --max-age=7d \
    --max-msgs=-1 \
    --max-bytes=4GB \
    --replicas=1 \
    --discard=old \
    --dupe-window=2m \
    --defaults

echo ""
echo "✅ Stream created. Verifying..."
nats stream info "$STREAM_NAME" --server "$NATS_SERVER" -j 2>/dev/null | python3 -c "
import json, sys
d = json.load(sys.stdin)
config = d.get('config', d)
print(f'  Name:       {config.get(\"name\")}')
print(f'  Subjects:   {config.get(\"subjects\")}')
print(f'  Storage:    {config.get(\"storage\")}')
print(f'  Retention:  {config.get(\"retention\")}')
print(f'  Max Age:    {config.get(\"max_age\")}')
print(f'  Max Bytes:  {config.get(\"max_bytes\")}')
print(f'  Messages:   {d.get(\"state\",{}).get(\"messages\",0)}')
"

echo ""
echo "=== Kabarkan NATS Ready ==="
