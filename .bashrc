export PATH="/root/.local/share/uv/tools/kimi-cli/bin:$PATH"
export KIMI_API_KEY="sk-kimi-UmOZSyoLhaEK4bRCyN3JixVWvzFcWMxZRvEBaORwOMIacNkK6QSTnHi4WyOdPqby"

# uv
export PATH="/root/.local/bin:$PATH"

# ============================================
# Aider Helper Functions
# ============================================

# Quick setup reminder on login
alias aider-setup='cat ~/.aider-env.sh'
alias aider-models='echo "Available models:
  Kimi:     moonshot/kimi-k2-0711-preview, moonshot/kimi-k1.5-preview
  MiniMax:  minimax/minimax-text-01
  Custom:   Set OPENAI_API_BASE + OPENAI_API_KEY for any OpenAI-compatible API"'

# Load aider API keys if file exists
if [ -f ~/.aider-env.sh ]; then
    # Only source if keys are uncommented (user has configured it)
    if grep -q "^export MOONSHOT_API_KEY=" ~/.aider-env.sh 2>/dev/null || \
       grep -q "^export MINIMAX_API_KEY=" ~/.aider-env.sh 2>/dev/null || \
       grep -q "^export OPENCODE_API_KEY=" ~/.aider-env.sh 2>/dev/null; then
        source ~/.aider-env.sh 2>/dev/null
    fi
fi

# ═══════════════════════════════════════════════════════════════
# VAULT AUTO-EXPORT (888_JUDGE | 999_SEAL)
# Auto-load API keys from canonical vault
# ═══════════════════════════════════════════════════════════════
[ -f /root/.secrets/vault.env ] && eval "$(vault export 2>/dev/null)"

# OpenClaw Completion
source "/root/.openclaw/completions/openclaw.bash"
export OLLAMA_API_KEY="ollama-local-no-key-required"
export OLLAMA_API_KEY="ollama-local-no-key-required"
export TELEGRAM_BOT_TOKEN="8149595687:AAGQ3DSI5_AKDLNcyKORyy8g_bz5QSsbufA"
