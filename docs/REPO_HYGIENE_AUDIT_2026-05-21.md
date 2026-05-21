# Repo Hygiene Audit - 2026-05-21

## git status --short
```
MM README.md
M  docs/AGENT_LAYOUT_CONTRACT.md
AM docs/REPO_HYGIENE_AUDIT_2026-05-21.md
A  docs/archive/ENTROPY_REDUCTION_2026-05-20.md
M  scripts/hooks/pre-push/repo_guard.py
```

## git branch --show-current
```
chore/repo-hygiene-aforge-20260521
```

## git log --oneline --decorate --graph --max-count=12
```
* f9be225 (HEAD -> chore/repo-hygiene-aforge-20260521, origin/main, origin/HEAD, main) docs(README): update layout, entropy seals, and cleanup record
* 2033a85 chore(A-FORGE): remove GEOX app manifest and GEOX security policy
* 3196ca8 docs(A-FORGE): evict GEOX documentation to canonical repo
* d006ca1 forge(A-FORGE): final entropy sweep — hidden GEOX artifacts
* 78dda9a forge(A-FORGE): final foreign artifact sweep and UI reorganization
* f827cad forge(A-FORGE): relocate foreign deploy configs to canonical repos
* be5cbe1 forge(A-FORGE): evict GEOX artifacts, dead code, and foreign deploy configs
* 5508d17 docs: refresh README and SOT canon
* 7a6afba refactor: reduce shadow casts and split governance/resources
* b619eb1 chore: seal entropy reduction and docs topology
* f03ddf8 REPO=ariffazil/A-FORGE
* 6a62be6 deps: remove dead deps, move dev tools to devDependencies
```

## git log --oneline origin/main..HEAD
```
```

## git diff --stat
```
 README.md                             |  8 ++++----
 docs/REPO_HYGIENE_AUDIT_2026-05-21.md | 21 ++-------------------
 2 files changed, 6 insertions(+), 23 deletions(-)
```

## git diff --check
```
PASS
```

## verification after README alignment

```txt
npm run build: PASS
npm test: PASS (7/7)
note: LongTermMemory federation Qdrant upsert/search emitted non-fatal fetch warnings during tests.
```
