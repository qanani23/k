# Legacy Code Review List

**Phase:** Phase 1 - Full Codebase Audit  
**Date:** 2026-02-22  
**Status:** In Review

## Overview

This document tracks code items that are "Possibly Legacy" - items that may have historical significance, unclear purpose, or require user confirmation before deletion.

**Total Items:** 1  
**Reviewed:** 0  
**Pending Review:** 1  
**Resolved (Keep):** 0  
**Resolved (Delete):** 0  
**Resolved (Integrate):** 0

---

## Review Process

For each legacy item:
1. **Investigate:** Research git history, comments, documentation
2. **Consult:** Ask original author or team members
3. **Decide:** Keep, Delete, or Integrate
4. **Document:** Record decision and rationale
5. **Execute:** Implement decision in Phase 2

---

## Items Pending Review

### Item 1: PlayerModal Component Duplication

**Type:** Component Duplication  
**Location:** `src/components/PlayerModal.tsx` and `src/components/PlayerModal.refactored.tsx`  
**Date Added:** [Unknown - requires git history investigation]  
**Original Author:** [Unknown - requires git blame]

**Context:**
Two implementations of the PlayerModal component exist:

1. **PlayerModal.tsx** (Production)
   - Direct usage of Plyr and hls.js
   - Fully functional video player
   - Used in production

2. **PlayerModal.refactored.tsx** (Refactored)
   - Uses PlayerAdapter abstraction
   - Separates production and test environments
   - Includes test-friendly architecture
   - Has data-testid attributes for testing

**Usage Analysis:**
```bash
# PlayerModal.tsx - Used in production
rg "PlayerModal" src --type tsx
# Result: Not directly imported in current codebase (likely used via dynamic import or context)

# PlayerModal.refactored.tsx - Not currently used
rg "PlayerModal.refactored" src --type tsx
# Result: No imports found
```

**Questions:**
- Is PlayerModal.refactored.tsx intended to replace PlayerModal.tsx?
- Is the PlayerAdapter abstraction ready for production?
- Should we keep both for A/B testing or migration purposes?
- Is PlayerModal.refactored.tsx experimental or production-ready?

**Recommendation:** **DEFER TO PHASE 2** - This is a non-blocking issue

**Options:**
1. **Keep PlayerModal.tsx only** - Delete PlayerModal.refactored.tsx if experimental
2. **Replace with PlayerModal.refactored.tsx** - If PlayerAdapter is production-ready
3. **Keep both temporarily** - If migration is in progress
4. **Move refactored to feature branch** - If it's experimental work

**Impact:** Low - Both components are functional, no runtime issues

**Assigned To:** User Decision Required  
**Review Deadline:** Phase 2 Cleanup

---

### Item 2: [Name]

**Type:** [Function/Struct/Enum/Module]  
**Location:** `[file:line]`  
**Date Added:** [YYYY-MM-DD]  
**Original Author:** [Name]

**Code:**
```rust
// Paste relevant code snippet
```

**Context:**
- **Git History:** [Summary]
- **Comments:** [Any comments]
- **Related Issues:** [Links]

**Usage Analysis:**
```bash
rg "item_name" src-tauri
# Output: [grep results]
```

**Questions:**
- [Question 1]
- [Question 2]

**Recommendation:** [Keep/Delete/Integrate] - [Rationale]

**Assigned To:** [Name]  
**Review Deadline:** [YYYY-MM-DD]

---

## Items Under Review

### Item 3: [Name]

**Type:** [Function/Struct/Enum/Module]  
**Location:** `[file:line]`  
**Status:** Under Review  
**Reviewer:** [Name]  
**Review Started:** [YYYY-MM-DD]

**Findings:**
- [Finding 1]
- [Finding 2]

**Consultation:**
- **Consulted:** [Name]
- **Date:** [YYYY-MM-DD]
- **Response:** [Summary of response]

**Preliminary Decision:** [Keep/Delete/Integrate]  
**Rationale:** [Explanation]

---

## Resolved Items

### Item 4: [Name] - KEEP

**Type:** [Function/Struct/Enum/Module]  
**Location:** `[file:line]`  
**Decision:** Keep  
**Date:** [YYYY-MM-DD]  
**Decided By:** [Name]

**Rationale:**
- [Reason 1]
- [Reason 2]

**Action Required:**
- [ ] Add documentation
- [ ] Add tests
- [ ] Integrate properly
- [ ] Update comments

**Follow-up:** [Any follow-up actions]

---

### Item 5: [Name] - DELETE

**Type:** [Function/Struct/Enum/Module]  
**Location:** `[file:line]`  
**Decision:** Delete  
**Date:** [YYYY-MM-DD]  
**Decided By:** [Name]

**Rationale:**
- [Reason 1]
- [Reason 2]

**Safety Verification:**
```bash
rg "item_name" src-tauri
# Output: (no matches)
```

**Moved To:** `stabilization/DELETIONS.md` - Item [N]  
**Deleted In:** Phase 2, Batch [N]  
**Commit:** [commit SHA]

---

### Item 6: [Name] - INTEGRATE

**Type:** [Function/Struct/Enum/Module]  
**Location:** `[file:line]`  
**Decision:** Integrate  
**Date:** [YYYY-MM-DD]  
**Decided By:** [Name]

**Rationale:**
- [Reason 1]
- [Reason 2]

**Integration Plan:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Integration Status:**
- [ ] Code integrated
- [ ] Tests added
- [ ] Documentation updated
- [ ] Verified working

**Completed In:** Phase [N]  
**Commit:** [commit SHA]

---

## Categories of Legacy Code

### 1. Incomplete Features

Features that were started but never finished.

| Item | Location | Status | Recommendation |
|------|----------|--------|----------------|
| [item] | [file:line] | [status] | [Keep/Delete/Integrate] |

**Common Patterns:**
- TODO comments with no follow-up
- Partial implementations
- Unused configuration options

---

### 2. Experimental Code

Code that was added for experimentation but never productionized.

| Item | Location | Status | Recommendation |
|------|----------|--------|----------------|
| [item] | [file:line] | [status] | [Keep/Delete/Integrate] |

**Common Patterns:**
- "Experimental" or "WIP" in comments
- Alternative implementations
- Feature flags that are never enabled

---

### 3. Deprecated Approaches

Code that was replaced by a better approach but not removed.

| Item | Location | Status | Recommendation |
|------|----------|--------|----------------|
| [item] | [file:line] | [status] | [Keep/Delete/Integrate] |

**Common Patterns:**
- "Old" or "Legacy" in names
- Duplicate functionality
- Commented-out code

---

### 4. Historical Artifacts

Code that was needed in the past but may not be needed now.

| Item | Location | Status | Recommendation |
|------|----------|--------|----------------|
| [item] | [file:line] | [status] | [Keep/Delete/Integrate] |

**Common Patterns:**
- Workarounds for old bugs
- Compatibility code for old versions
- Migration helpers

---

## Git History Investigation

### Useful Commands

```bash
# Find when code was added
git log --all --full-history -- path/to/file.rs

# Find who wrote the code
git blame path/to/file.rs

# Find related commits
git log --grep="keyword" --all

# Find when code was last modified
git log -1 -- path/to/file.rs

# Find related PRs (if using GitHub)
gh pr list --search "keyword" --state all
```

---

## Consultation Log

### Consultation 1: [Item Name]

**Date:** [YYYY-MM-DD]  
**Consulted:** [Name]  
**Method:** [Email/Slack/Meeting]

**Question:**
[Question asked]

**Response:**
[Summary of response]

**Decision Impact:**
[How this affects the decision]

---

### Consultation 2: [Item Name]

**Date:** [YYYY-MM-DD]  
**Consulted:** [Name]  
**Method:** [Email/Slack/Meeting]

**Question:**
[Question asked]

**Response:**
[Summary of response]

**Decision Impact:**
[How this affects the decision]

---

## Decision Criteria

Use these criteria to decide on legacy code:

### Keep If:
- ✓ Used in production (even if rarely)
- ✓ Part of documented API
- ✓ Required for backward compatibility
- ✓ Planned for future use (with concrete plan)
- ✓ Provides important functionality

### Delete If:
- ✓ Truly unused (verified with grep)
- ✓ Superseded by better implementation
- ✓ Experimental code that failed
- ✓ No one remembers why it exists
- ✓ Adds complexity without benefit

### Integrate If:
- ✓ Partially implemented but valuable
- ✓ Works but not connected to main flow
- ✓ Missing tests/documentation only
- ✓ Quick to complete integration
- ✓ Provides clear value when integrated

---

## Review Timeline

| Phase | Deadline | Responsible |
|-------|----------|-------------|
| Initial Review | [YYYY-MM-DD] | [Name] |
| Consultation | [YYYY-MM-DD] | [Name] |
| Decision | [YYYY-MM-DD] | [Name] |
| Implementation | [YYYY-MM-DD] | [Name] |

---

## Escalation Process

If consensus cannot be reached:

1. **Document Disagreement:** Record different viewpoints
2. **Gather More Data:** Additional investigation
3. **Team Discussion:** Bring to team meeting
4. **Technical Lead Decision:** Final call by tech lead
5. **Document Decision:** Record in this file

---

## Statistics

### Review Progress
- **Total Items:** [N]
- **Reviewed:** [N] ([N%])
- **Pending:** [N] ([N%])

### Decisions
- **Keep:** [N] ([N%])
- **Delete:** [N] ([N%])
- **Integrate:** [N] ([N%])

### Timeline
- **Review Started:** [YYYY-MM-DD]
- **Target Completion:** [YYYY-MM-DD]
- **Actual Completion:** [YYYY-MM-DD]

---

## Lessons Learned

### What Made Review Easier
- [Observation]

### What Made Review Harder
- [Observation]

### Recommendations for Future
- [Recommendation]

---

## Sign-off

**Review Completed By:** [Name]  
**Date:** [YYYY-MM-DD]  
**Approved By:** [Name]  
**Date:** [YYYY-MM-DD]

---

## Appendix: Example Legacy Code Patterns

### Pattern 1: TODO with No Follow-up

```rust
// TODO: Implement caching
pub fn fetch_data() -> Result<Data, Error> {
    // Direct fetch, no caching
    fetch_from_api()
}
```

**Decision:** Delete TODO or implement caching

---

### Pattern 2: Commented-Out Code

```rust
pub fn process() {
    // Old approach (commented out)
    // let result = old_method();
    
    // New approach
    let result = new_method();
}
```

**Decision:** Delete commented code

---

### Pattern 3: Unused Feature Flag

```rust
#[cfg(feature = "experimental")]
pub fn experimental_feature() {
    // Never enabled in production
}
```

**Decision:** Delete if feature is never used
