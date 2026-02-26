# Stabilization PR

## Phase
- [ ] Phase 0: Infrastructure Setup
- [ ] Phase 1: Audit
- [ ] Phase 2: Cleanup
- [ ] Phase 3: Re-Stabilization
- [ ] Phase 4: Odysee Debug Preparation
- [ ] Phase 5: Final Zero-Warning Enforcement

## Commands Run Locally

### Build
```
<paste cargo build output>
```

### Tests
```
<paste cargo test output>
```

### Clippy
```
<paste cargo clippy output>
```

### Coverage (Phase 3+)
```
<paste cargo tarpaulin output>
```

### IPC Smoke Test (Phase 1+)
```
<paste IPC smoke test output>
```

## Tag Created
- Tag name: `v-stabilize-phase-X-<description>`
- Commit SHA: `<sha>`

## Files Changed
- List key files modified
- Rationale for each change

## Deferred Items
- List any items deferred to future PRs
- Justification for deferral

## Summary
One-paragraph summary of changes and impact.

## Phase Gate Sign-Offs

### Phase 0 → Phase 1 Gate
- [ ] All infrastructure in place (reviewer: @<name>)
- [ ] Scripts executable and cross-platform (reviewer: @<name>)
- [ ] CI syntax valid (reviewer: @<name>)
- [ ] Day-1 checklist complete (reviewer: @<name>)

### Phase 1 → Phase 2 Gate
- [ ] CI passes (reviewer: @<name>)
- [ ] IPC smoke test passed (deterministic, headless) (reviewer: @<name>)
- [ ] Audit report complete with dynamic pattern detection (reviewer: @<name>)

### Phase 2 → Phase 3 Gate
- [ ] DB backup created with checksum (reviewer: @<name>)
- [ ] Idempotency verified (reviewer: @<name>)
- [ ] Cleanup documented (reviewer: @<name>)
- [ ] Canary PR reviewed (48 hours) (reviewer: @<name>)

### Phase 3 → Phase 4 Gate
- [ ] All tests pass (reviewer: @<name>)
- [ ] Module-focused coverage >= 60% (or documented exceptions) (reviewer: @<name>)
- [ ] Security audit passes (reviewer: @<name>)

### Phase 4 → Phase 5 Gate
- [ ] Reproducible claim test passes (reviewer: @<name>)
- [ ] Debug playbook complete (reviewer: @<name>)
- [ ] Privacy docs in place (reviewer: @<name>)

### Phase 5 → Complete Gate
- [ ] Zero warnings enforced (reviewer: @<name>)
- [ ] CI updated with phase conditionals (reviewer: @<name>)
- [ ] All deliverables reviewed (reviewer: @<name>)

## Checklist
- [ ] CI passes
- [ ] IPC smoke test passes (Phase 1+)
- [ ] DB backup created (Phase 2+)
- [ ] Test coverage >= 60% on critical modules (Phase 3+)
- [ ] Security audit passes
- [ ] Documentation updated
- [ ] Manual testing completed
- [ ] Reviewer assigned
- [ ] No force pushes after tag creation
- [ ] All phase gate requirements met

## Reviewer Assignment
- Primary Reviewer: @<name>
- Secondary Reviewer (optional): @<name>

## Additional Notes
<Any additional context, concerns, or information for reviewers>
