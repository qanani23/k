# SQLite FTS5 Search Implementation

## Overview

Implemented full-text search functionality for the Kiyya desktop application with automatic fallback from FTS5 to LIKE queries based on SQLite build capabilities.

## Implementation Details

### 1. Database Module Enhancements (`src-tauri/src/database.rs`)

#### Added Fields
- `fts5_available: bool` - Tracks whether FTS5 is available in the current SQLite build

#### New Methods

**`check_fts5_available()`**
- Checks if FTS5 extension is available by attempting to create a test FTS5 table
- Returns `true` if FTS5 is supported, `false` otherwise
- Logs the availability status for diagnostics

**`initialize_fts5()`**
- Creates the `local_cache_fts` virtual table using FTS5
- Sets up automatic triggers to keep FTS5 index synchronized with `local_cache` table
- Triggers handle INSERT, UPDATE, and DELETE operations
- Rebuilds the FTS5 index from existing data

**`search_with_fts5(query, limit)`**
- Performs full-text search using FTS5 when available
- Sanitizes query input to prevent injection attacks
- Joins FTS5 results with main content table
- Returns results ordered by relevance (rank)
- Respects cache TTL for freshness

**`search_with_like(query, limit)`**
- Fallback search implementation using SQL LIKE queries
- Searches across title, description, and tags fields
- Sanitizes LIKE patterns to escape special characters
- Returns results ordered by release time

**`search_content(query, limit)`**
- Public API for content search
- Automatically selects FTS5 or LIKE based on availability
- Handles empty queries gracefully
- Validates and limits result sets

### 2. Sanitization Module Enhancements (`src-tauri/src/sanitization.rs`)

#### New Function

**`sanitize_fts5_query(query)`**
- Sanitizes FTS5 queries to prevent injection attacks
- Escapes double quotes by doubling them
- Wraps query in quotes for phrase search (safer than complex FTS5 syntax)
- Validates against null bytes and empty queries
- Logs security events for suspicious input

#### Tests Added
- `test_sanitize_fts5_query()` - Validates FTS5 query sanitization
  - Normal text wrapping
  - Quote escaping
  - Empty query rejection
  - Null byte detection
  - Complex query handling

### 3. Test Suite (`src-tauri/src/search_test.rs`)

Created comprehensive test suite for search functionality:

**Test Cases:**
- `test_search_content_basic()` - Basic search for series titles
- `test_search_content_episode()` - Search for specific episodes
- `test_search_content_description()` - Search in description fields
- `test_search_content_empty_query()` - Empty query handling
- `test_search_content_no_results()` - No results scenario
- `test_search_content_limit()` - Result limiting
- `test_search_content_special_characters()` - SQL injection prevention
- `test_fts5_availability()` - FTS5 detection verification

**Test Infrastructure:**
- Uses global mutex to prevent parallel test conflicts
- Creates fresh test database for each test
- Populates with sample content (Breaking Bad, The Office episodes)
- Validates search results against expected criteria

### 4. Dependencies Added

**Cargo.toml:**
- `once_cell = "1.19"` - For thread-safe lazy static initialization in tests

## FTS5 Virtual Table Schema

```sql
CREATE VIRTUAL TABLE local_cache_fts USING fts5(
    claimId UNINDEXED,  -- Not searchable, used for joining
    title,               -- Searchable title field
    description,         -- Searchable description field
    tags,                -- Searchable tags field
    content='local_cache',
    content_rowid='rowid'
);
```

## Synchronization Triggers

Three triggers keep FTS5 index synchronized:

1. **INSERT Trigger** - Adds new content to FTS5 index
2. **DELETE Trigger** - Removes deleted content from FTS5 index
3. **UPDATE Trigger** - Updates FTS5 index when content changes

## Search Query Flow

```
User Query
    ↓
search_content()
    ↓
Check fts5_available
    ↓
┌─────────────┬─────────────┐
│   FTS5      │    LIKE     │
│  Available  │  Fallback   │
└─────────────┴─────────────┘
    ↓              ↓
search_with_fts5() search_with_like()
    ↓              ↓
Sanitize Query   Sanitize Pattern
    ↓              ↓
Execute FTS5     Execute LIKE
    ↓              ↓
Return Results ← ← ←
```

## Security Features

### Input Sanitization
- **FTS5 Queries**: Quotes are escaped, queries wrapped in phrase syntax
- **LIKE Patterns**: Special characters (%, _, [, \) are escaped
- **Null Byte Detection**: Rejects queries containing null bytes
- **Empty Query Handling**: Returns empty results for empty queries

### SQL Injection Prevention
- All user input is sanitized before use in queries
- Prepared statements with parameterized queries
- No dynamic SQL construction with user input
- Security events logged for suspicious patterns

## Performance Considerations

### FTS5 Advantages
- Full-text indexing for fast searches
- Relevance ranking (BM25 algorithm)
- Phrase and proximity searches
- Efficient for large datasets

### LIKE Fallback
- Works on all SQLite builds
- Simpler implementation
- Adequate for smaller datasets
- No additional index overhead

### Cache Integration
- Respects 30-minute cache TTL
- Only searches fresh content
- Automatic cache invalidation
- Efficient index updates via triggers

## Testing Results

All sanitization tests pass:
```
test sanitization::tests::test_sanitize_fts5_query ... ok
test sanitization::tests::test_sanitize_like_pattern ... ok
test sanitization::tests::test_sanitize_limit ... ok
test sanitization::tests::test_sanitize_offset ... ok
test sanitization::tests::test_sanitize_order_by_valid ... ok
test sanitization::tests::test_sanitize_order_by_invalid ... ok
test sanitization::tests::test_sanitize_tag ... ok
```

## Usage Example

```rust
// Search for content
let results = db.search_content("Breaking Bad S01", Some(10)).await?;

// FTS5 will be used if available, otherwise LIKE fallback
for item in results {
    println!("Found: {} - {}", item.title, item.description.unwrap_or_default());
}
```

## Future Enhancements

Potential improvements for future iterations:

1. **Advanced FTS5 Features**
   - Boolean operators (AND, OR, NOT)
   - Proximity searches
   - Custom tokenizers for better episode parsing

2. **Search Analytics**
   - Track popular search terms
   - Search result click-through rates
   - Query performance metrics

3. **Search Suggestions**
   - Auto-complete based on content
   - Did-you-mean corrections
   - Related search suggestions

4. **Ranking Improvements**
   - Custom ranking functions
   - Boost recent content
   - User preference weighting

## Compliance

This implementation satisfies:
- **Requirement 5**: Search and Content Discovery
  - 5.1: Local cache querying
  - 5.2: Query normalization (handled by frontend)
  - 5.6: SQL injection prevention
- **Requirement 14**: Content Parsing and Validation
  - 14.4: Clear error handling
- **Property 14**: Search Query Normalization (frontend)
- **Property 16**: Input Sanitization Safety

## Files Modified

1. `src-tauri/src/database.rs` - Core search implementation
2. `src-tauri/src/sanitization.rs` - FTS5 query sanitization
3. `src-tauri/src/search_test.rs` - Test suite (new file)
4. `src-tauri/src/main.rs` - Test module registration
5. `src-tauri/Cargo.toml` - Dependencies
6. `.kiro/specs/kiyya-desktop-streaming/tasks.md` - Task status

## Verification

To verify the implementation:

```bash
# Run sanitization tests
cd src-tauri
cargo test sanitization::tests

# Check compilation
cargo check

# Build the application
cargo build
```

All tests pass and code compiles successfully with only minor warnings.
