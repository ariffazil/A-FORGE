# Branch Archive Plan — A-FORGE

| Branch | Status | Recommendation | Reason |
|--------|--------|----------------|--------|
| `main` | active | keep | primary |
| `aforge/routing-v2026-05-02` | active | keep | 2 ahead, 1 behind |
| `feat/repo-routing-validation-2026-05-02` | delete_candidate | archive only | 1 behind |

## Cleanup Commands
```bash
# To archive a branch locally before deletion:
git checkout <branch>
git tag archive/<branch>
git checkout main
git branch -D <branch>

# To delete remote (888_HOLD):
# git push origin --delete <branch>
```
