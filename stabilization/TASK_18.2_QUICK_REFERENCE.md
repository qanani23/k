# Task 18.2: Quick Reference Guide

## Test Command
```bash
node scripts/test_reproducible_claim.js
```

## What This Test Does

1. **Loads** the reproducible claim fixture from `tests/fixtures/claim_working.json`
2. **Constructs** a CDN playback URL using the claim_id
3. **Validates** the URL format against expected pattern
4. **Tests** basic URL accessibility (HTTP HEAD request)
5. **Documents** results in markdown and JSON formats

## Expected Results

### ✓ Success Indicators
- Claim fixture loads successfully
- URL constructed: `https://cloud.odysee.live/content/{claim_id}/master.m3u8`
- All format validation checks pass
- Exit code: 0

### ⚠ Expected Warnings
- 403 or 404 response from CDN (test claim doesn't exist)
- Network errors (acceptable for synthetic test data)

### ✗ Failure Indicators
- Cannot load claim fixture
- URL format validation fails
- Missing required URL components
- Exit code: 1

## URL Format Requirements

A valid CDN playback URL must:
1. Use HTTPS protocol
2. Point to Odysee CDN domain (cloud.odysee.live)
3. Include claim_id in the path
4. Follow /content/{claim_id}/ structure
5. End with master.m3u8 extension

## Test Fixture Details

**Location:** `tests/fixtures/claim_working.json`

**Claim ID:** `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`

**Note:** This is a synthetic claim for testing purposes. It doesn't exist on the actual CDN.

## Output Files

After running the test:
- `stabilization/TASK_18.2_TEST_RESULTS.md` - Human-readable report
- `stabilization/TASK_18.2_TEST_RESULTS.json` - Machine-readable results

## Integration with CI/CD

This test can be integrated into CI/CD pipelines:

```yaml
- name: Test Reproducible Claim
  run: node scripts/test_reproducible_claim.js
```

## Troubleshooting

### Issue: "Fixture not found"
**Solution:** Ensure `tests/fixtures/claim_working.json` exists

### Issue: "URL format validation failed"
**Solution:** Check that `build_cdn_playback_url_test` command logic matches expected format

### Issue: Network timeout
**Solution:** This is acceptable - the test validates format, not content availability

## Related Files

- Test script: `scripts/test_reproducible_claim.js`
- Fixture: `tests/fixtures/claim_working.json`
- Fixture README: `tests/fixtures/README.md`
- Backend command: `src-tauri/src/commands.rs::build_cdn_playback_url_test`

## Requirements Satisfied

✓ Requirement 10.1: Reproducible claim fixture testing
