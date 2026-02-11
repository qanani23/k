# Testing Strategy: Kiyya Desktop Streaming Application

## Overview

This document outlines the comprehensive testing strategy for the Kiyya desktop streaming application. The testing approach employs a dual methodology combining traditional unit testing with property-based testing to ensure both specific behavior correctness and universal property guarantees.

## Testing Philosophy

### Dual Testing Approach

The Kiyya testing strategy uses two complementary testing methodologies:

1. **Unit Tests**: Verify specific examples, edge cases, and error conditions
2. **Property-Based Tests**: Verify universal properties that hold across all inputs

Both approaches are necessary for comprehensive coverage. Unit tests validate known scenarios and integration points, while property-based tests provide mathematical guarantees about system behavior across the entire input space.

### Core Principles

- **Correctness First**: All tests validate correctness properties defined in the design document
- **Comprehensive Coverage**: Critical paths must have both unit and property-based test coverage
- **Minimal Mocking**: Tests validate real functionality without excessive mocking
- **Deterministic Execution**: Tests produce consistent results across runs
- **Fast Feedback**: Unit tests run quickly; property tests run with sufficient iterations (100+)

## Test Organization

### Directory Structure

```
tests/
├── e2e/                    # End-to-end tests (Playwright)
│   └── app.spec.ts
├── property/               # Property-based tests (fast-check)
│   ├── api.wrapper.property.test.ts
│   ├── categorization.property.test.ts
│   ├── semver.property.test.ts
│   └── series.ordering.property.test.ts
└── unit/                   # Unit tests (Vitest)
    ├── api.test.ts
    ├── aria-labels.test.tsx
    ├── categories.test.ts
    ├── [... 40+ unit test files]
    └── useUpdateChecker.test.ts

src-tauri/src/
├── api_parsing_test.rs
├── cache_ttl_property_test.rs
├── channel_id_format_validation_property_test.rs
├── content_parsing_property_test.rs
├── database_initialization_test.rs
├── gateway_failover_property_test.rs
├── http_range_property_test.rs
├── migration_property_test.rs
├── [... additional Rust test files]
└── valid_channel_id_acceptance_property_test.rs
```

## Frontend Testing

### Unit Testing (Vitest)

**Framework**: Vitest with jsdom environment  
**Test Runner**: `npm run test:unit`  
**Coverage**: `npm run test:coverage`

#### Test Categories

**1. Component Tests**
- UI component rendering and behavior
- User interaction handling
- Accessibility compliance (ARIA labels, keyboard navigation)
- Theme switching and responsive design
- Error boundary behavior

**Example Test Files**:
- `Hero.test.tsx` - Hero section rendering and autoplay behavior
- `NavBar.test.tsx` - Navigation and dropdown functionality
- `PlayerModal.test.tsx` - Video player integration and controls
- `SeriesDetail.test.tsx` - Series organization and episode display

**2. Hook Tests**
- Custom React hooks behavior
- State management and side effects
- Debouncing and throttling logic
- Error handling in hooks

**Example Test Files**:
- `useContent.test.ts` - Content fetching and caching
- `useDebouncedSearch.test.ts` - Search debouncing logic
- `useDownloadManager.test.ts` - Download state management
- `useUpdateChecker.test.ts` - Version checking and update prompts

**3. Utility Function Tests**
- Core logic functions
- Data transformation and parsing
- Validation and sanitization
- Error handling

**Example Test Files**:
- `semver.test.ts` - Version comparison and parsing
- `search.test.ts` - Search query normalization
- `series.test.ts` - Series parsing and episode ordering
- `quality.test.ts` - Quality selection logic

**4. Integration Tests**
- API wrapper functionality
- Routing and navigation
- Storage and persistence
- Configuration validation

**Example Test Files**:
- `api.test.ts` - Tauri command invocation
- `routing.test.tsx` - React Router integration
- `storage.test.ts` - LocalStorage and favorites
- `tauri-config.test.ts` - Configuration validation

#### Configuration

```typescript
// vite.config.ts
test: {
  environment: 'jsdom',
  setupFiles: ['./src/test/setup.ts'],
  globals: true,
}
```

### Property-Based Testing (fast-check)

**Framework**: fast-check  
**Test Runner**: `npm run test:property`  
**Minimum Iterations**: 100 per property

#### Implemented Properties

**Property 1: Content Categorization Consistency**
- **File**: `tests/property/categorization.property.test.ts`
- **Validates**: Requirements 1.2, 1.4
- **Description**: Content items are placed in exactly one primary category based on base tags, and appear in all applicable filter subcategories
- **Generators**: Base tags, filter tags, content items with valid tag combinations

**Property 3: Series Episode Ordering Preservation**
- **File**: `tests/property/series.ordering.property.test.ts`
- **Validates**: Requirements 2.1, 2.3, 2.4
- **Description**: Episode order matches playlist order when available; falls back to parsed season/episode numbers with consistent sorting
- **Generators**: Playlist data, episode titles, season/episode number combinations

**Property 17: Version Comparison Accuracy**
- **File**: `tests/property/semver.property.test.ts`
- **Validates**: Requirements 19.3, 8.2
- **Description**: Semantic version comparison follows semver rules correctly for all version string formats
- **Generators**: Version strings with major/minor/patch, prerelease tags, build metadata

**Property 20: API Wrapper Resilience**
- **File**: `tests/property/api.wrapper.property.test.ts`
- **Validates**: Requirements 14.1, 14.2, 14.3
- **Description**: API response parsing handles malformed data gracefully without crashing
- **Generators**: Malformed JSON, missing fields, invalid data types

#### Property Test Format

All property tests follow this structure:

```typescript
/**
 * Property-Based Tests for [Feature Name]
 * 
 * **Feature: kiyya-desktop-streaming, Property {N}: {Property Statement}**
 * 
 * {Detailed property description}
 * 
 * Validates: Requirements {X.Y}, {Z.W}
 */

describe('Property-Based Tests: [Feature Name]', () => {
  describe('Property {N}: {Property Name}', () => {
    it('should {property behavior}', () => {
      fc.assert(
        fc.property(arbitraryGenerator, (input) => {
          // Test property holds for all generated inputs
          expect(actualBehavior(input)).toSatisfy(propertyCondition);
        }),
        { numRuns: 100 }
      );
    });
  });
});
```

### End-to-End Testing (Playwright)

**Framework**: Playwright  
**Test Runner**: `npm run test:e2e`  
**Browsers**: Chromium, Firefox, WebKit

#### Test Scenarios

**1. Application Startup**
- Hero content loading and display
- Navigation rendering
- Initial state verification
- Error handling for failed loads

**2. Hero System**
- Random hero selection and session persistence
- Autoplay behavior (muted, with fallback to poster)
- Play, favorite, and shuffle button interactions
- Metadata display (title, description, duration)
- Reduced motion preference handling

**3. Navigation and Routing**
- Category page navigation (Movies, Series, Sitcoms, Kids)
- Search functionality
- Downloads and Favorites pages
- Settings page access
- URL state management

**4. Content Interaction**
- Content card hover and click
- Video playback initiation
- Quality selection
- Download management
- Favorite toggling

**5. Series Browsing** (Currently Skipped)
- Series detail page display
- Season expansion/collapse
- Episode information display
- Episode action buttons (Play, Download, Favorite)

**Note**: Series browsing tests are temporarily skipped due to stack overflow in test environment (not affecting production).

**6. Accessibility**
- Keyboard navigation
- Focus management
- Screen reader compatibility
- Reduced motion support
- ARIA label verification

**7. Responsive Design**
- Mobile viewport adaptation
- Touch interaction support
- Layout responsiveness

**8. Error Handling**
- Network error recovery
- Loading state display
- User-friendly error messages
- Retry functionality

#### Configuration

```typescript
// playwright.config.ts
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://localhost:1420',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run tauri:dev',
    url: 'http://localhost:1420',
    timeout: 120000,
  },
});
```

## Backend Testing (Rust)

### Unit Testing

**Framework**: Rust built-in testing (`#[cfg(test)]`)  
**Test Runner**: `cargo test`  
**Location**: Inline with source files or separate test modules

#### Test Categories

**1. Command Tests**
- Tauri command interface validation
- Parameter parsing and validation
- Response serialization
- Error handling and propagation

**Example Test Files**:
- `commands.rs` - Inline tests for all Tauri commands
- `input_validation_test.rs` - Input sanitization and validation

**2. Database Tests**
- SQLite operations and queries
- Migration execution and rollback
- Transaction handling
- Index performance
- Data integrity

**Example Test Files**:
- `database_initialization_test.rs` - Database setup and schema
- `database_optimization_test.rs` - Query performance
- `migrations_error_handling_test.rs` - Migration failure recovery

**3. Gateway Tests**
- API request handling
- Failover logic
- Retry mechanisms
- Health tracking
- Response parsing

**Example Test Files**:
- `gateway.rs` - Inline gateway client tests
- `api_parsing_test.rs` - API response parsing

**4. Security Tests**
- Input sanitization
- SQL injection prevention
- Path traversal protection
- Encryption/decryption
- Key management

**Example Test Files**:
- `sql_injection_test.rs` - SQL injection attack prevention
- `input_validation_test.rs` - Input sanitization
- `security_logging_integration_test.rs` - Security event logging

**5. Server Tests**
- HTTP Range header support
- Concurrent connection handling
- Content streaming
- Error responses

**Example Test Files**:
- `server.rs` - Inline local HTTP server tests
- `integration_test.rs` - Full server integration tests

### Property-Based Testing (proptest)

**Framework**: proptest  
**Test Runner**: `cargo test`  
**Minimum Iterations**: 100 per property (configured via proptest)

#### Implemented Properties

**Property 2: Cache TTL Behavior**
- **File**: `src-tauri/src/cache_ttl_property_test.rs`
- **Validates**: Requirements 1.3, 7.6, 13.1
- **Description**: Cached content is returned without API calls when TTL is valid; fresh API calls are made when TTL expires
- **Generators**: Timestamps, TTL durations, cache states

**Property 11: Gateway Failover Resilience**
- **File**: `src-tauri/src/gateway_failover_property_test.rs`
- **Validates**: Requirements 6.2, 6.3, 6.5, 16.2, 16.3
- **Description**: Gateway priority order is immutable; exponential backoff follows 300ms → 1s → 2s pattern; system functions with at least one responsive gateway
- **Generators**: Gateway configurations, failure patterns, retry scenarios

**Property 12: HTTP Range Support Compliance**
- **File**: `src-tauri/src/http_range_property_test.rs`
- **Validates**: Requirements 17.2, 17.3, 17.4, 17.7, 4.5
- **Description**: Range requests return correct 206 responses with proper headers; invalid ranges return 416; concurrent connections are supported
- **Generators**: Range specifications, file sizes, concurrent request patterns

**Property 20: Content Parsing Resilience**
- **File**: `src-tauri/src/content_parsing_property_test.rs`
- **Validates**: Requirements 14.1, 14.2, 14.3, 14.4, 1.5
- **Description**: Content parser extracts metadata from multiple field locations; returns clear errors for malformed data without crashing
- **Generators**: Malformed JSON, missing fields, invalid URLs, codec variations

**Additional Property Tests**:
- `migration_property_test.rs` - Database migration safety and rollback
- `channel_id_format_validation_property_test.rs` - Channel ID validation
- `valid_channel_id_acceptance_property_test.rs` - Valid channel ID acceptance

#### Property Test Format

All Rust property tests follow this structure:

```rust
// Property-Based Test for [Feature Name]
// **Feature: kiyya-desktop-streaming, Property {N}: {Property Statement}**
//
// Property Statement:
// {Detailed property description}
//
// **Validates: Requirements {X.Y}, {Z.W}**

use proptest::prelude::*;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn property_test_name() {
        proptest!(|(
            input in arbitrary_generator(),
        )| {
            // Test property holds for all generated inputs
            prop_assert!(property_condition(input));
        });
    }
}
```

## Test Execution

### Running Tests

**Frontend Tests**:
```bash
# Run all unit tests
npm run test:unit

# Run property-based tests
npm run test:property

# Run end-to-end tests
npm run test:e2e

# Run all tests
npm run test:all

# Run with coverage
npm run test:coverage

# Run accessibility tests only
npm run test:a11y
```

**Backend Tests**:
```bash
# Run all Rust tests
cd src-tauri && cargo test

# Run specific test file
cargo test --test gateway_failover_property_test

# Run with output
cargo test -- --nocapture

# Run property tests with more iterations
cargo test -- --test-threads=1
```

### Continuous Integration

The CI pipeline executes the following test sequence:

1. **Linting and Type Checking**
   ```bash
   npm run lint
   npm run type-check
   ```

2. **Frontend Unit Tests**
   ```bash
   npm run test:unit
   ```

3. **Frontend Property Tests**
   ```bash
   npm run test:property
   ```

4. **Backend Tests**
   ```bash
   cd src-tauri && cargo test
   ```

5. **End-to-End Tests** (Headless)
   ```bash
   npm run test:e2e
   ```

6. **Coverage Analysis**
   ```bash
   npm run test:coverage
   ```

### Coverage Requirements

**Critical Path Coverage Targets**:
- Content discovery and caching: >90%
- Video playback and quality management: >85%
- Download and offline playback: >85%
- Series organization and playlist handling: >80%
- Gateway failover and error recovery: >90%
- Database migrations and data integrity: >95%

**Overall Coverage Targets**:
- Frontend: >80% line coverage
- Backend: >85% line coverage
- Property tests: 100+ iterations per property

## Property-Based Testing Details

### Why Property-Based Testing?

Property-based testing provides mathematical guarantees about system behavior by:

1. **Exhaustive Input Coverage**: Tests across the entire input space, not just known examples
2. **Edge Case Discovery**: Automatically finds edge cases developers might miss
3. **Specification Validation**: Verifies universal properties hold for all inputs
4. **Regression Prevention**: Shrinks failing inputs to minimal counterexamples

### Property Test Workflow

1. **Define Property**: Identify a universal property that should always hold
2. **Create Generators**: Build arbitraries that generate valid input data
3. **Write Assertion**: Express the property as a testable assertion
4. **Run Iterations**: Execute 100+ test iterations with random inputs
5. **Analyze Failures**: Review counterexamples when properties fail
6. **Refine Implementation**: Fix code or refine property based on failures

### Property Test Best Practices

**DO**:
- Test universal properties that hold for all inputs
- Use smart generators that constrain to valid input space
- Run minimum 100 iterations per property
- Reference design document properties in test comments
- Shrink counterexamples to minimal failing cases

**DON'T**:
- Test UI behavior with property tests (use unit/E2E instead)
- Use property tests for integration testing
- Mock extensively in property tests
- Test implementation details instead of properties
- Skip property tests due to execution time

## Accessibility Testing

### Automated Accessibility Tests

**Tools**: Playwright with accessibility assertions  
**Test Runner**: `npm run test:a11y`

**Test Coverage**:
- ARIA labels on all interactive elements
- Keyboard navigation for all components
- Focus management in modals and dropdowns
- Screen reader compatibility
- Color contrast ratios
- Reduced motion support

**Example Tests**:
- `aria-labels.test.tsx` - ARIA label presence and correctness
- `keyboard-navigation.test.tsx` - Tab order and keyboard shortcuts
- `modal-focus-management.test.tsx` - Focus trapping in modals
- `screen-reader.test.tsx` - Screen reader announcements

### Manual Accessibility Testing

**Screen Readers**:
- NVDA (Windows)
- JAWS (Windows)
- VoiceOver (macOS)

**Keyboard Navigation**:
- Tab/Shift+Tab: Navigate between interactive elements
- Enter/Space: Activate buttons and links
- Escape: Close modals and dropdowns
- Arrow keys: Navigate within components

**Visual Testing**:
- High contrast mode
- Zoom levels (100% - 200%)
- Reduced motion preferences
- Color blindness simulation

## Performance Testing

### Metrics Monitored

**Frontend Performance**:
- Initial page load time
- Time to interactive (TTI)
- First contentful paint (FCP)
- Largest contentful paint (LCP)
- Cumulative layout shift (CLS)

**Backend Performance**:
- Gateway response times
- Database query execution times
- Cache hit/miss ratios
- Download throughput
- Memory usage

### Performance Tests

**Example Test Files**:
- `memoryManager.test.ts` - Memory management and cleanup
- `database_optimization_test.rs` - Query performance
- `monitoring_local_test.rs` - Performance metric collection

## Security Testing

### Automated Security Tests

**Test Coverage**:
- SQL injection prevention
- Input sanitization
- Path traversal protection
- Network domain restrictions
- Filesystem access restrictions
- Encryption key management

**Example Test Files**:
- `sql_injection_test.rs` - SQL injection attack prevention
- `input_validation_test.rs` - Input sanitization and validation
- `security_logging_integration_test.rs` - Security event logging
- `path_security.rs` - Path traversal prevention

### Security Audit Checklist

- [ ] Network requests restricted to approved Odysee domains
- [ ] Filesystem access limited to application data folder
- [ ] No API tokens or secrets embedded in code
- [ ] Encryption keys stored only in OS keystore
- [ ] All user inputs sanitized before use
- [ ] SQL queries use prepared statements
- [ ] No `unwrap()` on external data in Rust
- [ ] No unchecked type casts in TypeScript

## Test Maintenance

### Adding New Tests

**When to Add Unit Tests**:
- New component or function implementation
- Bug fix (regression test)
- Edge case discovery
- Integration point changes

**When to Add Property Tests**:
- New correctness property identified
- Core algorithm implementation
- Data transformation logic
- Universal invariant to verify

**When to Add E2E Tests**:
- New user workflow
- Critical path addition
- Cross-component interaction
- Platform-specific behavior

### Test Naming Conventions

**Unit Tests**:
- `describe('[Component/Function Name]', () => {})`
- `it('should [expected behavior]', () => {})`

**Property Tests**:
- `describe('Property-Based Tests: [Feature Name]', () => {})`
- `describe('Property {N}: [Property Name]', () => {})`
- `it('should [property statement]', () => {})`

**E2E Tests**:
- `test.describe('[Feature Area]', () => {})`
- `test('should [user action and expected result]', () => {})`

### Test Documentation

All tests should include:
- Clear description of what is being tested
- Reference to requirements or design properties
- Expected behavior documentation
- Edge cases and error conditions covered

## Troubleshooting

### Common Test Issues

**Issue**: Tests fail intermittently  
**Solution**: Check for timing issues, race conditions, or insufficient waits in E2E tests

**Issue**: Property tests fail with obscure counterexamples  
**Solution**: Use proptest shrinking to find minimal failing case; review generator constraints

**Issue**: E2E tests timeout  
**Solution**: Increase timeout values; check if dev server is starting correctly

**Issue**: Coverage reports missing files  
**Solution**: Verify test setup files are configured correctly; check file patterns in coverage config

**Issue**: Rust tests fail to compile  
**Solution**: Ensure dev-dependencies are installed; check for feature flag requirements

### Debugging Tests

**Frontend**:
```bash
# Run tests in watch mode
npm run test:watch

# Run specific test file
npm run test tests/unit/semver.test.ts

# Run with debugging
node --inspect-brk node_modules/.bin/vitest
```

**Backend**:
```bash
# Run with output
cargo test -- --nocapture

# Run specific test
cargo test property_gateway_priority_immutability

# Run with backtrace
RUST_BACKTRACE=1 cargo test
```

**E2E**:
```bash
# Run in headed mode
npm run test:e2e -- --headed

# Run specific test
npm run test:e2e -- --grep "hero content"

# Debug mode
npm run test:e2e -- --debug
```

## Future Testing Enhancements

### Planned Additions

1. **Visual Regression Testing**: Screenshot comparison for UI consistency
2. **Load Testing**: Stress testing with large content libraries
3. **Cross-Platform Testing**: Automated testing on Windows, macOS, Linux
4. **Mutation Testing**: Verify test suite effectiveness
5. **Fuzz Testing**: Random input generation for security testing

### Test Infrastructure Improvements

1. **Parallel Test Execution**: Faster CI pipeline with parallel test runs
2. **Test Result Caching**: Skip unchanged tests in CI
3. **Flaky Test Detection**: Automatic identification and quarantine
4. **Coverage Trending**: Track coverage changes over time
5. **Performance Benchmarking**: Automated performance regression detection

## Conclusion

The Kiyya testing strategy provides comprehensive coverage through a dual approach of unit and property-based testing. This methodology ensures both specific behavior correctness and universal property guarantees, resulting in a robust and reliable application.

All tests are designed to be:
- **Fast**: Quick feedback during development
- **Reliable**: Consistent results across runs
- **Maintainable**: Clear structure and documentation
- **Comprehensive**: Coverage of critical paths and edge cases
- **Automated**: Integrated into CI/CD pipeline

By following this testing strategy, the Kiyya application maintains high quality standards and provides confidence in correctness across all system components.
