# Rollback Procedure: Odysee CDN Playback Standardization

## Overview

This document provides the rollback procedure for the Odysee CDN playback standardization refactor. This refactor removes core playback logic and fallback behavior, which could potentially break Hero/Series/Movies sections simultaneously if issues arise.

## Safety Checkpoints

### Baseline Checkpoint
- **Branch**: `feature/odysee-cdn-standardization`
- **Commit**: Baseline checkpoint (initial commit on feature branch)
- **Tag**: Will be created as `pre-merge-cdn-standardization` before integration testing

## Rollback Scenarios

### Scenario 1: Critical Issues During Development

If critical issues are discovered during implementation (before integration testing):

1. **Check current branch**:
   ```bash
   git branch
   ```
   Ensure you're on `feature/odysee-cdn-standardization`

2. **Reset to baseline checkpoint**:
   ```bash
   git log --oneline
   # Find the baseline checkpoint commit hash
   git reset --hard <baseline-commit-hash>
   ```

3. **Alternative - Discard all changes**:
   ```bash
   git reset --hard HEAD
   ```

4. **Return to main branch** (if needed):
   ```bash
   git checkout main
   # or
   git checkout develop
   ```

### Scenario 2: Critical Issues During Integration Testing

If critical issues are discovered during integration testing (Task 11):

1. **Reset to pre-merge safety checkpoint**:
   ```bash
   git reset --hard pre-merge-cdn-standardization
   ```

2. **Analyze integration test failures**:
   - Review integration test logs
   - Check Hero/Series/Movies section behavior
   - Identify specific failure points

3. **Iterative fix on feature branch**:
   - Make corrections on feature branch
   - Re-run integration tests
   - Create new safety tag if needed

4. **If unfixable - abandon feature branch**:
   ```bash
   git checkout main
   # or
   git checkout develop
   git branch -D feature/odysee-cdn-standardization
   ```

### Scenario 3: Critical Issues After Merge (Production)

If critical issues are discovered after merging to main/develop:

1. **Immediate revert of merge commit**:
   ```bash
   git log --oneline
   # Find the merge commit hash
   git revert -m 1 <merge-commit-hash>
   git push origin main
   # or
   git push origin develop
   ```

2. **Alternative - Hard reset** (if no other commits after merge):
   ```bash
   git reset --hard <commit-before-merge>
   git push --force origin main
   # WARNING: Only use if no other developers have pulled the changes
   ```

3. **Hotfix deployment**:
   - Deploy reverted code immediately
   - Verify Hero/Series/Movies sections are functional
   - Communicate rollback to team

## Verification After Rollback

After any rollback, verify the following:

1. **Hero Section**:
   - Loads with hero_trailer video
   - Autoplay works
   - No console errors

2. **Series Section**:
   - Loads series content
   - Thumbnails display correctly
   - Playback works

3. **Movies Section**:
   - Loads movie content
   - Thumbnails display correctly
   - Playback works

4. **Backend Logs**:
   - No errors related to video URL extraction
   - No panics or crashes

## Critical Failure Indicators

Rollback should be considered if:

1. **All sections fail to load** (Hero, Series, Movies)
2. **Backend panics or crashes** during content loading
3. **No videos are playable** across the application
4. **Frontend receives malformed responses** from backend
5. **CDN URLs are malformed** or non-functional
6. **Performance degradation** (>5 second load times)

## Post-Rollback Actions

1. **Document the failure**:
   - What went wrong
   - Which sections were affected
   - Error messages and logs
   - Steps to reproduce

2. **Create issue ticket**:
   - Detailed failure description
   - Rollback commit hash
   - Proposed fix approach

3. **Communicate to stakeholders**:
   - Notify team of rollback
   - Provide timeline for fix
   - Document impact on users (if production)

## Prevention Measures

To minimize rollback risk:

1. **Follow task order strictly** (Tasks 0-12 in sequence)
2. **Run all tests** before proceeding to next task
3. **Create pre-merge safety checkpoint** (Task 10) before integration testing
4. **Test each section independently** during integration testing (Task 11)
5. **Verify section independence** (Hero failure doesn't affect Series)

## Contact Information

If rollback is needed and this procedure is unclear:

1. Review the tasks.md file for task dependencies
2. Check git log for commit history
3. Consult the design.md for architectural context
4. Review requirements.md for acceptance criteria

## Rollback Decision Matrix

| Severity | Scope | Action | Timeline |
|----------|-------|--------|----------|
| Critical | All sections broken | Immediate rollback | < 5 minutes |
| High | 2+ sections broken | Rollback after verification | < 15 minutes |
| Medium | 1 section broken | Attempt fix, rollback if unfixable | < 30 minutes |
| Low | Minor issues | Fix on feature branch | No rollback needed |

## Success Criteria After Rollback

After rollback, the application should:

- ✅ Hero section loads and plays video
- ✅ Series section displays content
- ✅ Movies section displays content
- ✅ No backend errors in logs
- ✅ No frontend console errors
- ✅ All existing functionality works as before refactor

## Notes

- Feature branch isolation ensures main/develop branches remain unaffected during development
- Pre-merge safety checkpoint (Task 10) provides clean rollback point before integration
- All rollback procedures preserve git history for post-mortem analysis
- Rollback does not require database migrations or data cleanup (zero-server architecture)
