# 🔐 API Key Security Guide for Non-Coders

## The Problem You're Experiencing

You're right - **API key technology IS outdated**. It's a hack from 2015 that creates:
- **Key sprawl**: Keys in .env files, config files, code repos
- **No expiration**: Keys live forever unless manually rotated
- **All-or-nothing access**: One key = full account access
- **No audit trail**: Who used the key when?
- **LLM friction**: AI agents refuse to handle keys in chat

---

## 🎯 Your Current Solution (Implemented)

### The Vault Pattern
```
/root/.secrets/
├── vault.env          # One file, 600 permissions, root-only
├── vault.env.backup   # Your backup
└── SECURITY_GUIDE.md  # This file
```

**Benefits:**
- ✅ Single source of truth
- ✅ 600 permissions (only root can read)
- ✅ Never in git (auto-excluded)
- ✅ Easy CLI: `vault set moonshot sk-...`

---

## 🚀 Future-Proof Alternatives (Research Summary)

### 1. **Short-Lived Tokens** (Best Balance)
**What**: Tokens that expire in 1-24 hours
**Used by**: AWS, Google Cloud, modern APIs
**Your entropy reduction**: 🟢 LOW - Set once, auto-refresh

```bash
# Instead of: MOONSHOT_API_KEY=sk-... (permanent)
# You get: MOONSHOT_SESSION_TOKEN=temp-... (1hr)
```

**Implementation for AI agents:**
```bash
# Agent requests token on-demand
vault token moonshot --duration 1h
# Returns: temp key that's auto-deleted after use
```

### 2. **Workload Identity / mTLS** (Enterprise Grade)
**What**: Your VPS proves its identity cryptographically
**Used by**: Kubernetes, cloud-native apps
**Your entropy reduction**: 🟢 VERY LOW - No keys at all!

```
Your VPS ──mTLS cert──→ API Gateway ──→ LLM Provider
    ↑                                       ↓
No API key!                        Verifies VPS identity
```

### 3. **Browser-Based Auth (OAuth)** (Most User-Friendly)
**What**: Login like Google, token managed automatically
**Used by**: GitHub CLI, modern developer tools
**Your entropy reduction**: 🟢 ZERO - Never see a key!

```bash
# aider auth kimi
# Opens browser → You login → Token auto-saved
# Never see the key, never paste it anywhere
```

### 4. **Secret Management Services** (Cloud Native)
| Service | Cost | Complexity | Best For |
|---------|------|------------|----------|
| **AWS Secrets Manager** | $0.40/secret/mo | Medium | AWS users |
| **HashiCorp Vault** | Free (self-host) | High | Enterprises |
| **Doppler** | Free tier | Low | Developers |
| **1Password Secrets** | $20/mo | Very Low | Small teams |

### 5. **Hardware Security Modules (HSM)** (Maximum Security)
**What**: Physical device or TPM that stores keys
**Used by**: Banks, government, high-security
**Your entropy reduction**: 🟢 ZERO - Keys never leave hardware

---

## 🛡️ Immediate Hardening Checklist

### ✅ Done
- [x] Vault at `/root/.secrets/vault.env` with 600 permissions
- [x] CLI tool: `vault` command for easy management
- [x] Auto-loading wrappers for aider
- [x] Git exclusion

### 🔄 Do This Weekly
- [ ] Backup: `cp ~/.secrets/vault.env ~/.secrets/vault.env.$(date +%Y%m%d)`
- [ ] Check permissions: `ls -la ~/.secrets/`
- [ ] Review which keys are active: `vault list`

### 🚨 Emergency Procedures
```bash
# If you suspect compromise:
1. vault list                    # See what needs rotation
2. # Regenerate keys at provider dashboards
3. vault edit                    # Update with new keys
4. rm ~/.secrets/vault.env.*     # Delete old backups
```

---

## 🤖 For AI Agent Context

When working with me (Kimi) or other AI agents:

### ✅ SAFE Commands (I can help with these)
```bash
vault set moonshot sk-...        # ✓ You type the key
vault load                       # ✓ Loads from vault
vault list                       # ✓ Shows masked keys
aider-kimi file.ts               # ✓ Uses vault key
```

### ❌ NEVER DO (Even with trusted AI)
```bash
cat ~/.secrets/vault.env         # ✗ Exposes all keys
echo $MOONSHOT_API_KEY           # ✗ Exposes in logs
git add ~/.secrets/              # ✗ Could commit keys
```

---

## 📊 Security Entropy Comparison

| Method | Keys to Manage | Rotation Effort | Breach Impact | Your Effort |
|--------|---------------|-----------------|---------------|-------------|
| **Before** (scattered) | 10+ files | High | Catastrophic | High |
| **Now** (Vault) | 1 file | Low | High | Low |
| **With Auto-Rotation** | 1 file | Automatic | Medium | Minimal |
| **With mTLS** | 0 | None | Very Low | Setup once |
| **With OAuth** | 0 | None | Very Low | Login once |

---

## 🔮 The Future (What's Coming)

The industry IS moving away from API keys:

1. **2025**: More providers offering session tokens
2. **2026**: OAuth becoming standard for AI tools
3. **2027**: mTLS workload identity mainstream
4. **2028**: API keys deprecated (predicted)

**Your vault setup prepares you for this transition.**
When providers offer better auth, you just update the vault format.

---

## Quick Reference

```bash
# Store a key (you type it, never paste in chat)
vault set moonshot sk-your-actual-key-here

# Use aider (auto-loads from vault)
aider-kimi src/file.ts

# See what's configured
vault list

# Load all keys into current shell
vault load
```

---

*Generated: 2026-04-07*
*Vault Location: /root/.secrets/vault.env*
