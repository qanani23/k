# Test Fixtures

This directory contains test fixtures for the Kiyya Desktop stabilization process.

## claim_working.json

**Purpose:** Reproducible test claim for Phase 4 Odysee debug preparation.

**Source:** This is a sanitized, generic claim structure based on the Odysee/LBRY claim format. It does not represent a real claim but follows the expected schema.

**Privacy & Permissions:**
- ✅ This is a synthetic test claim with no real user data
- ✅ All identifiers are placeholder values (zeros and generic strings)
- ✅ No sensitive information is included
- ✅ Safe to include in version control
- ✅ Public and permissible for testing purposes

**Selection Criteria:**
1. Follows standard Odysee claim JSON structure
2. Contains all required fields for CDN URL construction
3. Uses generic, non-sensitive placeholder data
4. Represents a typical video claim
5. Suitable for reproducible testing

## Usage

### In Tests

```javascript
// Load test claim in frontend tests
const testClaim = await fetch('/tests/fixtures/claim_working.json').then(r => r.json());

// Use with Tauri command
const url = await window.__TAURI__.invoke('build_cdn_playback_url_test', { 
  claim_id: testClaim.claim_id 
});
```

### With Environment Variable

You can override the test claim ID at runtime:

```bash
# Set custom claim ID for testing
export TEST_CLAIM_ID="your-real-claim-id-here"

# Run tests
npm test
```

### In Backend Tests

```rust
use serde_json::Value;
use std::fs;

#[test]
fn test_with_fixture_claim() {
    let claim_json = fs::read_to_string("tests/fixtures/claim_working.json")
        .expect("Failed to read test claim");
    let claim: Value = serde_json::from_str(&claim_json)
        .expect("Failed to parse test claim");
    
    let claim_id = claim["claim_id"].as_str().unwrap();
    // Use claim_id in tests...
}
```

## Privacy Considerations

⚠️ **IMPORTANT:** If you need to test with real Odysee claims:

1. **Never commit real claim data** that contains:
   - User-generated content identifiers
   - Channel names that could identify users
   - Any personally identifiable information (PII)

2. **Use environment variables** for real claim IDs:
   ```bash
   TEST_CLAIM_ID=real-claim-id npm test
   ```

3. **Document in PR** if you tested with real claims (but don't include the claim data)

## Adding New Fixtures

When adding new test fixtures:

1. Ensure data is sanitized (no PII)
2. Document the source and purpose
3. Confirm it's permissible to include in version control
4. Add usage examples to this README
5. Consider privacy implications

## Real Claim Testing

For testing with real, publicly available Odysee claims:

1. Find a public claim on odysee.com
2. Extract the claim_id from the URL
3. Use `TEST_CLAIM_ID` environment variable
4. **Do not commit** the real claim data

Example:
```bash
# Test with a real public claim (not committed to repo)
TEST_CLAIM_ID=abc123realclaimid npm run test:integration
```

## Maintenance

- Review fixtures quarterly for relevance
- Update if Odysee claim schema changes
- Ensure all fixtures remain privacy-compliant
- Remove any fixtures that are no longer needed
