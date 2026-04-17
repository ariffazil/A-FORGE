#!/bin/bash
set -euo pipefail
cd /root
exec node /root/dist/src/mcp/stdio.js
