# Branch Protection Rules

## Overview

This document defines branch protection rules, tag protection policies, and emergency revert procedures for the Kiyya Desktop stabilization process. These rules ensure code quality, prevent accidental history rewrites, and provide safe rollback mechanisms.

## Protected Branches

### Main Branch (`main`)

**Protection Rules:**
1. **Require pull request reviews before merging**
   - Minimum 1 approval required
   - Dismiss stale pull request approvals when new commits are pushed
   - Require review from code owners (if CODEOWNERS file exists)

2. **Require status checks to pass before merging**
   - CI build must pass
   - Backend tests must pass
   - Frontend lint must pass
   - Security audit must pass
   - IPC smoke test must pass (Phase 1+)
   - Test coverage check must pass (Phase 3+)

3. **Require branches to be up to date before merging**
   - Branch must be rebased or merged with latest main before merge

4. **No force pushes allowed**
   - Force pushes are permanently disabled
   - History must remain linear and immutable

5. **No deletions allowed**
   - Branch cannot be deleted

6. **Require linear history**
   - Merge commits preferred over squash for traceability
   - Rebase allowed before merge, but not after

### Feature Branches (`feature/stabilize/*`)

**Protection Rules:**
1. **Require status checks to pass before merging**
   - All CI checks must pass
   - Phase-specific gates must pass

2. **No force pushes after tag creation**
   - Once a tag is created on a branch, force push is prohibited
   - Tags mark immutable checkpoints

3. **Require review from assigned reviewer**
   - At least one reviewer must approve
   - Reviewer should verify phase gate completion

4. **Phase-specific requirements**
   - Phase 0: All infrastructure scripts must be tested
   - Phase 1: IPC smoke test must pass
   - Phase 2: DB backup must be verified
   - Phase 3: Test coverage >= 60% on critical modules
   - Phase 4: Reproducible claim test must pass

## Tag Protection Rules

### Stabilization Tags (`v-stabilize-*`)

**Protection Rules:**
1. **Tags cannot be deleted**
   - Once created, tags are permanent
   - Tags mark phase completion checkpoints

2. **Tags cannot be overwritten**
   - No force push to existing tags
   - Create new tag if changes needed

3. **Tag naming convention**
   - Format: `v-stabilize-phase<N>-<description>`
   - Examples:
     - `v-stabilize-phase0-complete`
     - `v-stabilize-phase1-audit-complete`
     - `v-stabilize-phase2-cleanup-complete`
     - `v-stabilize-phase3-restabilization-complete`
     - `v-stabilize-phase4-debug-prep-complete`

4. **Tag creation workflow**
   ```bash
   # Create annotated tag with message
   git tag -a v-stabilize-phase0-complete -m "Phase 0: Infrastructure setup complete"
   
   # Push tag to remote
   git push origin v-stabilize-phase0-complete
   ```

## No Force-Push Policy

### Policy Statement

**After creating a stabilization tag, force pushes are strictly prohibited.**

### Rationale

1. **Checkpoint Integrity**: Tags mark verified checkpoints that must remain stable
2. **Rollback Safety**: Emergency reverts depend on immutable tag references
3. **Audit Trail**: History must be preserved for debugging and review
4. **Team Coordination**: Prevents conflicts when multiple developers reference tags

### Enforcement

1. **GitHub Settings**: Enable branch protection with "Do not allow force pushes"
2. **Pre-push Hook**: Add git hook to prevent accidental force pushes
3. **CI Validation**: Verify tag immutability in CI pipeline

### If Changes Needed After Tag

If changes are required after creating a tag:

1. **Create new commit** (do not amend or rebase)
   ```bash
   # Make your changes
   git add .
   git commit -m "Fix: Address issue found after phase0 tag"
   ```

2. **Create new tag** for the new checkpoint
   ```bash
   git tag -a v-stabilize-phase0-complete-v2 -m "Phase 0: Complete with fixes"
   git push origin v-stabilize-phase0-complete-v2
   ```

3. **Document in DECISIONS.md**
   - Explain why new tag was needed
   - Reference original tag
   - Describe changes made

## Emergency Revert Procedures

### 3-Command Fast Revert

For critical emergencies requiring immediate rollback:

```bash
# 1. Find and revert to last stable tag
git reset --hard $(git tag -l "v-stabilize-*" | tail -1)

# 2. Restore database backup (adjust path for your platform)
cp backups/$(ls -t backups/ | head -1) ~/.kiyya/app.db

# 3. Verify application works
npm run tauri:dev
```

**Platform-specific DB paths:**
- Windows: `%APPDATA%\.kiyya\app.db`
- macOS: `~/Library/Application Support/kiyya/app.db`
- Linux: `~/.kiyya/app.db`

### Detailed Emergency Revert Checklist

Use this checklist for controlled rollback with full documentation:

#### Step 1: Find Last Stable Tag

```bash
# List all stabilization tags
git tag -l "v-stabilize-*"

# Find most recent tag
git tag -l "v-stabilize-*" | tail -1

# Or find specific phase tag
git tag -l "v-stabilize-phase2-*" | tail -1
```

**Output example:**
```
v-stabilize-phase0-complete
v-stabilize-phase1-audit-complete
v-stabilize-phase2-cleanup-complete
```

**Action:** Note the tag you want to revert to (e.g., `v-stabilize-phase2-cleanup-complete`)

#### Step 2: Revert Code to Tag

```bash
# Revert to specific tag (DESTRUCTIVE - commits after tag will be lost)
git reset --hard v-stabilize-phase2-cleanup-complete

# Verify current state
git log --oneline -5
git status
```

**Warning:** This operation is destructive. Any commits after the tag will be lost from your working branch. Consider creating a backup branch first:

```bash
# Create backup branch before revert
git branch backup-before-revert-$(date +%Y%m%d-%H%M%S)

# Then proceed with reset
git reset --hard v-stabilize-phase2-cleanup-complete
```

#### Step 3: Restore Database Backup

```bash
# List available backups (sorted by timestamp)
ls -lt backups/

# Identify backup corresponding to the tag timestamp
# Backup format: YYYYMMDD_HHMMSS-db.sqlite

# Copy backup to application database location
# Windows (PowerShell):
cp backups/20260219_143022-db.sqlite $env:APPDATA\.kiyya\app.db

# macOS/Linux:
cp backups/20260219_143022-db.sqlite ~/Library/Application\ Support/kiyya/app.db

# Or use environment variable override
export DB_PATH="./backups/20260219_143022-db.sqlite"
```

**Verification:**
```bash
# Verify backup file exists and is not corrupted
ls -lh backups/20260219_143022-db.sqlite

# Check backup metadata (if available)
cat backups/20260219_143022-db.sqlite.meta
```

#### Step 4: Verify Application Works

```bash
# Start application in development mode
npm run tauri:dev

# Monitor for errors in console output
# Check that application starts without crashes
# Test basic functionality (navigation, content loading)
```

**Manual Testing Checklist:**
- [ ] Application starts without errors
- [ ] Database connection successful
- [ ] Main UI renders correctly
- [ ] Navigation works
- [ ] Content fetching works (if applicable)
- [ ] No console errors in DevTools

**Automated Verification:**
```bash
# Run IPC smoke test
node scripts/ipc_smoke_test.js

# Run backend tests
cd src-tauri && cargo test

# Run frontend tests (if available)
npm test
```

#### Step 5: Document Revert in DECISIONS.md

Add entry to `stabilization/DECISIONS.md`:

```markdown
## Emergency Revert - [Date]

### Reason for Revert
[Describe the critical issue that required emergency rollback]

### Reverted From
- Commit: [SHA of problematic commit]
- Tag: [Tag that was current before revert, if any]

### Reverted To
- Tag: v-stabilize-phase2-cleanup-complete
- Commit: [SHA of tag commit]

### Database Restored
- Backup file: backups/20260219_143022-db.sqlite
- Backup timestamp: 2026-02-19 14:30:22
- Backup checksum: [SHA256 if available]

### Verification Results
- [ ] Application starts successfully
- [ ] IPC smoke test passed
- [ ] Backend tests passed
- [ ] Manual testing completed

### Root Cause Analysis
[Describe what went wrong and why revert was necessary]

### Remediation Plan
[Describe steps to fix the issue and prevent recurrence]

### Timeline
- Issue detected: [timestamp]
- Revert initiated: [timestamp]
- Revert completed: [timestamp]
- Verification completed: [timestamp]

### Lessons Learned
[Document what was learned and how to prevent similar issues]
```

## Phase-Specific Rollback Procedures

### Phase 0: Infrastructure Setup Rollback

**Scenario:** Infrastructure scripts are broken or incomplete

**Rollback Steps:**
```bash
# 1. Find last working infrastructure tag (if any)
git tag -l "v-stabilize-phase0-*" | tail -1

# 2. Revert to tag or clean state
git reset --hard v-stabilize-phase0-complete

# 3. No database restore needed (Phase 0 doesn't modify DB)

# 4. Verify scripts work
./scripts/db_snapshot.sh
./scripts/generate_audit_report.sh
node scripts/ipc_smoke_test.js
```

### Phase 1: Audit Rollback

**Scenario:** Audit process revealed issues or audit scripts are faulty

**Rollback Steps:**
```bash
# 1. Revert to Phase 0 completion
git reset --hard v-stabilize-phase0-complete

# 2. No database restore needed (Phase 1 is read-only)

# 3. Re-run audit with fixes
./scripts/generate_audit_report.sh
```

### Phase 2: Cleanup Rollback

**Scenario:** Code deletion broke functionality or tests

**Rollback Steps:**
```bash
# 1. Revert to pre-cleanup state
git reset --hard v-stabilize-phase1-audit-complete

# 2. Restore database backup
cp backups/$(ls -t backups/ | grep "$(git log -1 --format=%cd --date=format:%Y%m%d)" | head -1) ~/.kiyya/app.db

# 3. Verify application works
npm run tauri:dev
cd src-tauri && cargo test

# 4. Review failed deletions
# Re-categorize problematic code as "Possibly Legacy"
# Create new PR with conservative approach
```

### Phase 3: Re-Stabilization Rollback

**Scenario:** Integration work broke existing functionality

**Rollback Steps:**
```bash
# 1. Revert to Phase 2 completion
git reset --hard v-stabilize-phase2-cleanup-complete

# 2. Restore database backup
cp backups/$(ls -t backups/ | grep "$(git log -1 --format=%cd --date=format:%Y%m%d)" | head -1) ~/.kiyya/app.db

# 3. Verify tests pass
cd src-tauri && cargo test
npm test

# 4. Review integration failures
# Document issues in DECISIONS.md
# Plan incremental integration approach
```

### Phase 4: Debug Preparation Rollback

**Scenario:** Debug infrastructure interferes with normal operation

**Rollback Steps:**
```bash
# 1. Revert to Phase 3 completion
git reset --hard v-stabilize-phase3-restabilization-complete

# 2. Database restore usually not needed (Phase 4 adds observability)

# 3. Verify application works without debug infrastructure
npm run tauri:dev

# 4. Review debug tooling issues
# Adjust tracing/logging configuration
# Ensure debug mode is opt-in, not always-on
```

## GitHub Repository Configuration

### Enabling Branch Protection

**Steps to configure in GitHub:**

1. Navigate to repository **Settings** → **Branches**

2. Click **Add rule** under "Branch protection rules"

3. For `main` branch:
   - Branch name pattern: `main`
   - ✅ Require a pull request before merging
     - ✅ Require approvals: 1
     - ✅ Dismiss stale pull request approvals when new commits are pushed
   - ✅ Require status checks to pass before merging
     - ✅ Require branches to be up to date before merging
     - Add required checks:
       - `stabilization-checks`
       - `build-backend`
       - `build-frontend`
       - `test-backend`
       - `lint-frontend`
       - `security-audit`
       - `ipc-smoke-test`
   - ✅ Require conversation resolution before merging
   - ✅ Do not allow bypassing the above settings
   - ✅ Restrict who can push to matching branches (optional)

4. For `feature/stabilize/*` branches:
   - Branch name pattern: `feature/stabilize/*`
   - ✅ Require status checks to pass before merging
   - ✅ Do not allow force pushes (after tag creation)

5. Click **Create** to save the rule

### Enabling Tag Protection

**Steps to configure in GitHub:**

1. Navigate to repository **Settings** → **Tags**

2. Click **Add rule** under "Tag protection rules"

3. Configure tag protection:
   - Tag name pattern: `v-stabilize-*`
   - ✅ This tag name pattern is protected
   - Effect: Tags matching this pattern cannot be deleted or overwritten

4. Click **Create** to save the rule

## Pre-Push Git Hook (Optional)

To prevent accidental force pushes locally, add a pre-push hook:

**File:** `.git/hooks/pre-push`

```bash
#!/bin/bash

# Prevent force push to protected branches
protected_branches="main feature/stabilize/*"
current_branch=$(git symbolic-ref HEAD | sed -e 's,.*/\(.*\),\1,')

# Check if current branch is protected
for branch in $protected_branches; do
    if [[ "$current_branch" == $branch ]]; then
        # Check if this is a force push
        while read local_ref local_sha remote_ref remote_sha; do
            if [ "$remote_sha" != "0000000000000000000000000000000000000000" ]; then
                # Check if this would rewrite history
                if ! git merge-base --is-ancestor "$remote_sha" "$local_sha"; then
                    echo "ERROR: Force push to protected branch '$current_branch' is not allowed"
                    echo "Protected branches: $protected_branches"
                    exit 1
                fi
            fi
        done
    fi
done

exit 0
```

**Make executable:**
```bash
chmod +x .git/hooks/pre-push
```

## Summary

This document establishes strict branch protection and rollback procedures to ensure:

1. **Code Quality**: All changes must pass CI and review before merge
2. **History Integrity**: No force pushes after tag creation
3. **Safe Rollback**: Emergency revert procedures are documented and tested
4. **Audit Trail**: All changes are traceable and reversible
5. **Team Coordination**: Clear rules prevent conflicts and accidents

**Key Principles:**
- Tags are immutable checkpoints
- Force pushes are prohibited after tagging
- Database backups are mandatory before migrations
- Emergency reverts follow documented 3-command procedure
- All reverts must be documented in DECISIONS.md

**For Questions or Issues:**
- Review this document first
- Check `stabilization/DECISIONS.md` for historical context
- Consult with stabilization owners before force operations
- When in doubt, create a backup branch before any destructive operation
