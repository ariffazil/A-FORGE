# Aider API Keys Configuration
# Source this file: source ~/.aider-env.sh
# Or add to ~/.bashrc for persistence

# ============================================
# KIMI (Moonshot AI) - https://platform.moonshot.cn/
# Get API key from: https://platform.moonshot.cn/console/api-keys
# export MOONSHOT_API_KEY="your_kimi_key_here"

# ============================================
# MINIMAX - https://www.minimaxi.com/
# Get API key from: https://www.minimaxi.com/user-center/basic-information/interface-key
# export MINIMAX_API_KEY="your_minimax_key_here"

# ============================================
# OPENCODE / Custom OpenAI-compatible endpoint
# export OPENCODE_API_KEY="your_opencode_key_here"
# export OPENCODE_API_BASE="https://api.opencode.ai/v1"  # Adjust if different

echo "Aider environment configured."
echo "Uncomment and fill in your API keys in ~/.aider-env.sh"
echo ""
echo "Usage:"
echo "  aider-kimi <files>     # Use Kimi K2"
echo "  aider-minimax <files>  # Use MiniMax"
echo "  aider-opencode <files> # Use OpenCode endpoint"
