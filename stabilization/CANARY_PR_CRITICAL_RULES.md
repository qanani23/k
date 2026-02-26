# ⚠️ CANARY PR CRITICAL RULES ⚠️

**Date:** 2026-02-22  
**Phase:** 2 - Clean Build Enforcement  
**Applies To:** All Phase 2 deletion tasks (7.1 - 7.6)

---

## 🚨 CRITICAL REMINDER FOR ALL TEAM MEMBERS

### THE GOLDEN RULE

**⚠️ NEVER MERGE A CANARY PR ⚠️**

A canary PR is a **VERIFICATION-ONLY** pull request. It exists solely to:
1. Test proposed changes in CI
2. Allow team review for 48 hours
3. Surface hidden dependencies
4. Validate deletion safety

**Merging a canary PR would apply unverified deletions to the main codebase.**

---

## What is a Canary PR?

A **canary PR** is a safety mechanism borrowed from the "canary in a coal mine" concept. Just as miners used canaries to detect dangerous gases before humans were exposed, we use canary PRs to detect dangerous code deletions before they affect the main codebase.

### Purpose

- ✅ **Verification:** Run full test suite in CI
- ✅ **Review:** Allow 48-hour team review period
- ✅ **Detection:** Surface any hidden dependencies or dynamic calls
- ✅ **Safety:** Catch issues before actual deletion

### NOT for

- ❌ **Merging:** Never merge to main
- ❌ **Production:** Never deploy to production
- ❌ **Long-term:** Delete after verification period

---

## Canary PR Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│ Step 1: CREATE CANARY PR                                    │
│ - Branch: feature/stabilize/phase2-canary                   │
│ - Label: "canary-pr-do-not-merge"                          │
│ - Title: "[CANARY - DO NOT MERGE] ..."                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 2: CI RUNS (Automatic)                                 │
│ - Backend build and tests                                   │
│ - Frontend lint and tests                                   │
│ - Security audit                                            │
│ - IPC smoke test                                            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 3: TEAM REVIEW (48 hours)                              │
│ - Verify grep evidence                                      │
│ - Check for hidden dependencies                             │
│ - Validate test coverage                                    │
│ - Confirm no production impact                              │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    ┌───────┴───────┐
                    │               │
            ✅ ALL CLEAR      ❌ ISSUES FOUND
                    │               │
                    ↓               ↓
    ┌───────────────────────┐  ┌──────────────────────┐
    │ CREATE ACTUAL PR      │  │ DOCUMENT ISSUES      │
    │ - Apply deletions     │  │ - Adjust plan        │
    │ - Merge to main       │  │ - Create new canary  │
    └───────────────────────┘  └──────────────────────┘
                    │
                    ↓
    ┌───────────────────────────────────────────┐
    │ DELETE CANARY PR                          │
    │ - Close without merging                   │
    │ - Delete branch                           │
    └───────────────────────────────────────────┘
```

---

## 🚫 What NOT to Do

### ❌ DO NOT MERGE

**NEVER click the "Merge" button on a canary PR.**

Even if:
- ✅ All CI checks pass
- ✅ All reviews are approved
- ✅ No issues found

**Still DO NOT MERGE.**

### ❌ DO NOT Deploy

**NEVER deploy a canary PR to any environment.**

Canary PRs are for verification only, not deployment.

### ❌ DO NOT Keep Long-Term

**NEVER keep a canary PR open indefinitely.**

After 48 hours:
- If all clear → Close and create actual PR
- If issues found → Close and adjust plan

### ❌ DO NOT Reuse

**NEVER reuse a canary PR branch for actual deletions.**

Always create a fresh branch for the actual deletion PR.

---

## ✅ What TO Do

### ✅ DO Label Clearly

**ALWAYS add the label:** `canary-pr-do-not-merge`

This prevents accidental merging and makes the purpose clear.

### ✅ DO Title Clearly

**ALWAYS use this title format:**
```
[CANARY - DO NOT MERGE] Phase 2 Code Deletions Verification
```

The `[CANARY - DO NOT MERGE]` prefix is mandatory.

### ✅ DO Review Thoroughly

**ALWAYS review for 48 hours minimum.**

Check:
- All grep evidence is accurate
- No hidden dependencies exist
- No dynamic invocation patterns missed
- Test coverage remains adequate
- No production functionality affected

### ✅ DO Close After Verification

**ALWAYS close the canary PR after verification.**

Never leave it open indefinitely.

### ✅ DO Create Actual PR

**ALWAYS create a separate PR for actual deletions.**

After canary verification passes:
1. Close canary PR
2. Create new branch: `feature/stabilize/phase2-deletions`
3. Apply same deletions
4. Create new PR (without "CANARY" label)
5. Merge to main

---

## GitHub Settings to Prevent Accidental Merge

### Branch Protection Rules

Add these rules to prevent accidental canary PR merges:

1. **Require PR reviews before merging**
   - Minimum 2 reviewers
   - Dismiss stale reviews

2. **Require status checks to pass**
   - All CI checks must pass
   - Branch must be up to date

3. **Require conversation resolution**
   - All comments must be resolved

4. **Restrict who can merge**
   - Only designated reviewers can merge
   - Exclude canary PR authors

### PR Labels

Create a label: `canary-pr-do-not-merge`

**Settings:**
- Color: Red (#d73a4a)
- Description: "VERIFICATION ONLY - DO NOT MERGE"

### CODEOWNERS

Add to `.github/CODEOWNERS`:
```
# Canary PRs require explicit approval
**/feature/stabilize/phase2-canary/** @team-lead @senior-dev
```

---

## Canary PR Checklist

### Before Creating

- [ ] Read this document completely
- [ ] Understand canary PR purpose
- [ ] Have all proposed deletions documented
- [ ] Have evidence for each deletion

### During Creation

- [ ] Use correct branch name: `feature/stabilize/phase2-canary`
- [ ] Add label: `canary-pr-do-not-merge`
- [ ] Use correct title: `[CANARY - DO NOT MERGE] ...`
- [ ] Include full documentation in description
- [ ] Request reviews from team
- [ ] Set 48-hour review deadline

### During Review Period

- [ ] Monitor CI results
- [ ] Respond to reviewer comments
- [ ] Document any issues found
- [ ] Do NOT merge (even if approved)

### After 48 Hours

- [ ] Review all CI results
- [ ] Review all team feedback
- [ ] Make decision: proceed or adjust
- [ ] Close canary PR (do not merge)
- [ ] Delete canary branch
- [ ] Create actual PR if all clear

---

## Common Mistakes and How to Avoid Them

### Mistake 1: Merging Canary PR

**Symptom:** Canary PR gets merged to main

**Impact:** Unverified deletions applied to production

**Prevention:**
- Add `canary-pr-do-not-merge` label
- Use `[CANARY - DO NOT MERGE]` title prefix
- Set up branch protection rules
- Train team on canary PR process

**Recovery:**
```bash
# Immediate rollback
git revert <merge_commit>
git push origin main

# Or reset to before merge
git reset --hard <commit_before_merge>
git push --force origin main  # Use with caution
```

### Mistake 2: Skipping Review Period

**Symptom:** Creating actual PR before 48 hours

**Impact:** Hidden dependencies not discovered

**Prevention:**
- Set calendar reminder for 48 hours
- Document review deadline in PR
- Wait for all CI checks to complete
- Wait for all reviewers to approve

**Recovery:**
- Extend review period
- Re-run CI checks
- Request additional reviews

### Mistake 3: Reusing Canary Branch

**Symptom:** Using same branch for actual deletions

**Impact:** Confusion about PR purpose

**Prevention:**
- Always create fresh branch for actual PR
- Delete canary branch after verification
- Use different branch naming convention

**Recovery:**
- Create new branch from main
- Cherry-pick commits if needed
- Close old PR, create new one

### Mistake 4: Missing Label

**Symptom:** Canary PR without `canary-pr-do-not-merge` label

**Impact:** Risk of accidental merge

**Prevention:**
- Add label immediately after PR creation
- Include in PR template checklist
- Automate label addition via GitHub Actions

**Recovery:**
- Add label immediately
- Update PR title if needed
- Notify reviewers of correction

---

## For Task Executors

If you are working on any Phase 2 deletion task (7.1 - 7.6):

### Before Starting

1. **Read this document completely**
2. **Understand canary PR purpose**
3. **Review existing canary PRs** (if any)
4. **Check if canary PR already exists** for your deletions

### During Execution

1. **Create canary PR first** (Task 7.1)
2. **Wait 48 hours** for verification
3. **Do NOT proceed** to actual deletions until canary passes
4. **Document any issues** found during canary verification

### After Canary Verification

1. **Close canary PR** (do not merge)
2. **Create actual deletion PR** (separate branch)
3. **Apply same deletions** as canary
4. **Reference canary PR** in actual PR description
5. **Merge actual PR** to main (not canary)

---

## For Reviewers

If you are reviewing a canary PR:

### Review Checklist

- [ ] PR has `canary-pr-do-not-merge` label
- [ ] PR title includes `[CANARY - DO NOT MERGE]`
- [ ] All grep evidence is accurate
- [ ] No hidden dependencies exist
- [ ] No dynamic invocation patterns missed
- [ ] Test coverage remains adequate
- [ ] No production functionality affected
- [ ] All CI checks pass
- [ ] Documentation is complete

### Review Comments

**Use this template for approval:**
```
✅ Canary PR Review - APPROVED

I have verified:
- All grep evidence is accurate
- No hidden dependencies found
- No dynamic invocation patterns detected
- Test coverage remains adequate
- No production functionality affected
- All CI checks pass

**REMINDER:** This is a canary PR - DO NOT MERGE.
After 48-hour review period, close this PR and create actual deletion PR.
```

**Use this template for issues:**
```
❌ Canary PR Review - ISSUES FOUND

Issues discovered:
1. [Describe issue]
2. [Describe issue]

Recommendations:
- [Recommendation]
- [Recommendation]

**REMINDER:** This is a canary PR - DO NOT MERGE.
Address issues and create new canary PR if needed.
```

---

## For Project Managers

### Tracking Canary PRs

Create a tracking document: `stabilization/CANARY_PR_TRACKER.md`

**Template:**
```markdown
# Canary PR Tracker

| PR # | Created | Review Deadline | Status | Outcome |
|------|---------|----------------|--------|---------|
| #123 | 2026-02-22 | 2026-02-24 | Open | Pending |
| #124 | 2026-02-23 | 2026-02-25 | Closed | Approved |
| #125 | 2026-02-24 | 2026-02-26 | Closed | Issues Found |
```

### Metrics to Track

- Number of canary PRs created
- Number of issues found via canary PRs
- Average review time
- Number of accidental merge attempts
- Number of hidden dependencies discovered

---

## Emergency Contacts

If a canary PR is accidentally merged:

1. **Immediate Action:** Revert the merge commit
2. **Notify:** Project lead and team
3. **Document:** What happened and why
4. **Prevent:** Update branch protection rules

**Emergency Rollback Commands:**
```bash
# Find the merge commit
git log --oneline --graph

# Revert the merge
git revert -m 1 <merge_commit_sha>

# Push revert
git push origin main

# Restore database if needed
cp backups/<timestamp>-db.sqlite <db_path>
```

---

## Related Documentation

- **Canary PR Documentation:** `stabilization/CANARY_PR_DELETIONS.md`
- **Quick Start Guide:** `stabilization/CANARY_PR_QUICK_START.md`
- **Task Completion:** `stabilization/TASK_7.1_CANARY_PR_COMPLETE.md`
- **Creation Scripts:** `scripts/create_canary_pr.ps1`, `scripts/create_canary_pr.sh`
- **Protected Branches:** `PROTECTED_BRANCHES.md`
- **Contributing Guide:** `CONTRIBUTING.md`

---

## Summary

### The 3 Golden Rules

1. **NEVER MERGE** a canary PR
2. **ALWAYS LABEL** with `canary-pr-do-not-merge`
3. **ALWAYS WAIT** 48 hours for verification

### The Canary PR Mantra

> "A canary PR is for verification, not integration.  
> Review it, learn from it, then close it.  
> Create a separate PR for actual changes."

---

## Acknowledgment

By working on Phase 2 deletion tasks, you acknowledge that you have:

- ✅ Read this document completely
- ✅ Understand canary PR purpose
- ✅ Understand the risks of merging canary PRs
- ✅ Commit to following the canary PR process
- ✅ Will never merge a canary PR

---

**Document Version:** 1.0  
**Created:** 2026-02-22  
**Last Updated:** 2026-02-22  
**Applies To:** Phase 2 Tasks 7.1 - 7.6  
**Status:** ACTIVE - MANDATORY READING

---

## Quick Reference Card

Print this and keep it visible:

```
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║           ⚠️  CANARY PR CRITICAL RULES ⚠️                ║
║                                                           ║
║  1. NEVER MERGE a canary PR                              ║
║  2. ALWAYS LABEL with "canary-pr-do-not-merge"          ║
║  3. ALWAYS WAIT 48 hours for verification               ║
║                                                           ║
║  Purpose: VERIFICATION ONLY                              ║
║  Lifecycle: Create → Review → Close → Create Actual PR  ║
║                                                           ║
║  If accidentally merged:                                 ║
║  1. git revert -m 1 <merge_commit>                      ║
║  2. Notify team immediately                              ║
║  3. Document incident                                    ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

