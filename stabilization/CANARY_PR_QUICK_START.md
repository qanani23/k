# Canary PR Quick Start Guide

**Purpose:** Quick reference for creating and managing the canary PR for Phase 2 code deletions.

---

## What is This?

A **canary PR** is a verification-only pull request that tests proposed code deletions before actual implementation. It helps catch hidden dependencies and ensures deletions are safe.

**⚠️ CRITICAL:** DO NOT MERGE the canary PR. It's for verification only.

---

## Quick Start (5 Steps)

### Step 1: Run Creation Script

**Windows (PowerShell):**
```powershell
.\scripts\create_canary_pr.ps1
```

**Unix/Linux/macOS (Bash):**
```bash
./scripts/create_canary_pr.sh
```

**Dry Run First (Recommended):**
```powershell
# Windows
.\scripts\create_canary_pr.ps1 -DryRun

# Unix/Linux/macOS
./scripts/create_canary_pr.sh --dry-run
```

### Step 2: Manual Edits

The script will delete dead code files automatically, but you need to manually edit these files:

**Backend (Rust):**
- `src-tauri/src/error.rs` - Remove ErrorContext struct
- `src-tauri/src/gateway.rs` - Remove RangeRequest, GatewayConfig structs
- `src-tauri/src/encryption.rs` - Remove EncryptionConfig struct, unused constants
- `src-tauri/src/logging.rs` - Remove LoggingConfig struct
- `src-tauri/src/database.rs` - Remove 4 unused methods
- `src-tauri/src/download.rs` - Remove 3 unused methods, 2 unused fields
- `src-tauri/src/commands.rs` - Remove validate_cdn_reachability()
- `src-tauri/src/server.rs` - Remove vault_path field

**Frontend (TypeScript):**
- `src/lib/idle.ts` - Remove IdleCallback type
- `src/lib/memoryManager.ts` - Remove or use 'now' variable
- `src/hooks/useContent.ts` - Remove or use 'seriesKey' variable

**See:** `stabilization/CANARY_PR_DELETIONS.md` for detailed locations and evidence.

### Step 3: Verify Changes

```bash
# Backend
cd src-tauri
cargo build
cargo test
cargo clippy

# Frontend
cd ..
npm run lint
npm test

# Full suite
make test
```

### Step 4: Commit and Push

```bash
git add .
git commit -m 'canary: Propose code deletions for verification

DO NOT MERGE - This is a canary PR for verification only.

Proposed deletions:
- 2 dead code files (~937 lines)
- 5 unused structs (~130 lines)
- 10 unused methods (~150 lines)
- 5 unused fields
- 3 unused constants
- 3 unused imports
- 3 unused variables

Total: ~1,247 lines of dead code

See stabilization/CANARY_PR_DELETIONS.md for full details.
'

git push origin feature/stabilize/phase2-canary
```

### Step 5: Create PR on GitHub

1. Go to GitHub repository
2. Click "New Pull Request"
3. Select base: `main`, compare: `feature/stabilize/phase2-canary`
4. Title: `[CANARY - DO NOT MERGE] Phase 2 Code Deletions Verification`
5. Add label: `canary-pr-do-not-merge`
6. Copy description from `stabilization/CANARY_PR_DELETIONS.md`
7. Request reviews from team
8. **Wait 48 hours for CI and review**

---

## What Happens Next?

### During 48-Hour Review Period

**CI will run:**
- ✅ Backend build and tests
- ✅ Frontend lint and tests
- ✅ Security audit
- ✅ IPC smoke test

**Reviewers will verify:**
- ✅ All grep evidence is accurate
- ✅ No hidden dependencies exist
- ✅ No dynamic invocation patterns missed
- ✅ Test coverage remains adequate
- ✅ No production functionality affected

### After 48 Hours

**If All Clear (✅):**
1. Create actual deletion PR
2. Apply same deletions
3. Merge to main
4. Create tag: `v-stabilize-phase2-deletions-complete`

**If Issues Found (❌):**
1. Document hidden dependencies
2. Adjust deletion plan
3. Update `CANARY_PR_DELETIONS.md`
4. Create new canary PR if needed

---

## Rollback (If Needed)

**Immediate Rollback:**
```bash
# Find last stable tag
git tag -l "v-stabilize-*" | tail -1

# Revert code
git reset --hard <tag>

# Restore database (if needed)
cp backups/<timestamp>-db.sqlite <db_path>
```

**Partial Rollback:**
```bash
# Restore specific file
git checkout <commit> -- <file_path>
```

---

## Key Files

| File | Purpose |
|------|---------|
| `stabilization/CANARY_PR_DELETIONS.md` | Full documentation with evidence |
| `scripts/create_canary_pr.ps1` | Windows creation script |
| `scripts/create_canary_pr.sh` | Unix/Linux/macOS creation script |
| `stabilization/TASK_7.1_CANARY_PR_COMPLETE.md` | Task completion summary |
| `stabilization/CANARY_PR_QUICK_START.md` | This quick start guide |

---

## Common Issues

### Issue: Branch Already Exists

**Solution:**
```bash
git branch -D feature/stabilize/phase2-canary
# Then run creation script again
```

### Issue: Merge Conflicts

**Solution:**
```bash
git fetch origin main
git rebase origin/main
# Resolve conflicts
git rebase --continue
```

### Issue: Tests Fail After Deletions

**Solution:**
1. Identify which deletion caused failure
2. Restore that specific item
3. Document in canary PR
4. Adjust deletion plan

### Issue: CI Fails

**Solution:**
1. Check CI logs for specific error
2. Fix the issue locally
3. Commit and push fix
4. Wait for CI to re-run

---

## Help

**For detailed documentation:**
- See `stabilization/CANARY_PR_DELETIONS.md`

**For task completion summary:**
- See `stabilization/TASK_7.1_CANARY_PR_COMPLETE.md`

**For script help:**
```powershell
# Windows
.\scripts\create_canary_pr.ps1 -Help

# Unix/Linux/macOS
./scripts/create_canary_pr.sh --help
```

---

## Timeline

| Day | Action |
|-----|--------|
| Day 0 (Today) | Create canary PR |
| Day 0-2 | CI runs, reviewers verify |
| Day 2 | Review period ends |
| Day 2 | Decision: Proceed or adjust |

---

## Remember

**⚠️ DO NOT MERGE THE CANARY PR**

This is a verification-only PR. After 48 hours:
- If all clear → Create actual deletion PR
- If issues found → Document and adjust plan

---

**Quick Start Guide Version:** 1.0  
**Created:** 2026-02-22  
**Task:** 7.1 - Create canary PR for deletions

