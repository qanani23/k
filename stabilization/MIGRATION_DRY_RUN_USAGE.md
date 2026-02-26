# Migration Dry-Run Mode Usage

## Overview

The migration dry-run mode allows you to preview pending database migrations without executing them. This is useful for:

- Validating SQL syntax before applying migrations
- Reviewing what changes will be made to the database
- Testing migration scripts in development
- Debugging migration issues

## API

### `run_migrations_dry_run()`

```rust
pub fn run_migrations_dry_run(&self, conn: &Connection) -> Result<Vec<MigrationPlan>>
```

**Parameters:**
- `conn`: Database connection to check current version and validate SQL

**Returns:**
- `Result<Vec<MigrationPlan>>`: A vector of migration plans describing pending migrations

**Errors:**
- Returns `Err` if the migrations table cannot be created or queried
- Returns `Err` if the current version cannot be determined

### `MigrationPlan`

```rust
pub struct MigrationPlan {
    pub version: u32,
    pub description: String,
    pub sql: String,
    pub validation_result: ValidationResult,
}
```

**Fields:**
- `version`: Migration version number
- `description`: Human-readable description of the migration
- `sql`: The SQL statements that will be executed
- `validation_result`: Result of SQL validation

### `ValidationResult`

```rust
pub enum ValidationResult {
    Valid,
    Invalid { error: String },
}
```

**Variants:**
- `Valid`: SQL syntax is valid and can be executed
- `Invalid { error }`: SQL syntax is invalid, with error message

## Usage Examples

### Basic Usage

```rust
use crate::migrations::MigrationRunner;
use rusqlite::Connection;

let conn = Connection::open("app.db")?;
let runner = MigrationRunner::new();

match runner.run_migrations_dry_run(&conn) {
    Ok(plans) => {
        if plans.is_empty() {
            println!("No pending migrations");
        } else {
            println!("Found {} pending migrations:", plans.len());
            for plan in plans {
                println!("\nMigration {}: {}", plan.version, plan.description);
                match plan.validation_result {
                    ValidationResult::Valid => println!("  ✓ SQL is valid"),
                    ValidationResult::Invalid { error } => {
                        println!("  ✗ SQL error: {}", error);
                    }
                }
            }
        }
    }
    Err(e) => eprintln!("Dry-run failed: {}", e),
}
```

### Detailed Plan Review

```rust
use crate::migrations::{MigrationRunner, ValidationResult};
use rusqlite::Connection;

let conn = Connection::open("app.db")?;
let runner = MigrationRunner::new();

let plans = runner.run_migrations_dry_run(&conn)?;

for plan in plans {
    println!("=" .repeat(60));
    println!("Migration Version: {}", plan.version);
    println!("Description: {}", plan.description);
    println!("\nSQL:");
    println!("{}", plan.sql);
    
    match plan.validation_result {
        ValidationResult::Valid => {
            println!("\n✓ Validation: PASSED");
        }
        ValidationResult::Invalid { error } => {
            println!("\n✗ Validation: FAILED");
            println!("Error: {}", error);
        }
    }
}
```

### Conditional Migration Execution

```rust
use crate::migrations::{MigrationRunner, ValidationResult};
use rusqlite::Connection;

let conn = Connection::open("app.db")?;
let runner = MigrationRunner::new();

// First, dry-run to validate
let plans = runner.run_migrations_dry_run(&conn)?;

let all_valid = plans.iter().all(|plan| {
    matches!(plan.validation_result, ValidationResult::Valid)
});

if all_valid {
    println!("All migrations are valid. Proceeding with execution...");
    runner.run_migrations(&conn)?;
    println!("Migrations completed successfully");
} else {
    eprintln!("Some migrations have invalid SQL. Aborting.");
    for plan in plans {
        if let ValidationResult::Invalid { error } = plan.validation_result {
            eprintln!("Migration {}: {}", plan.version, error);
        }
    }
}
```

### CLI Tool Example

```rust
use crate::migrations::MigrationRunner;
use rusqlite::Connection;
use std::env;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = env::args().collect();
    
    if args.len() < 2 {
        eprintln!("Usage: {} <database-path>", args[0]);
        std::process::exit(1);
    }
    
    let db_path = &args[1];
    let conn = Connection::open(db_path)?;
    let runner = MigrationRunner::new();
    
    println!("Checking pending migrations for: {}", db_path);
    
    let plans = runner.run_migrations_dry_run(&conn)?;
    
    if plans.is_empty() {
        println!("✓ Database is up to date. No pending migrations.");
        return Ok(());
    }
    
    println!("\nPending migrations:");
    for plan in &plans {
        print!("  {} - {}: ", plan.version, plan.description);
        match &plan.validation_result {
            ValidationResult::Valid => println!("✓"),
            ValidationResult::Invalid { error } => println!("✗ ({})", error),
        }
    }
    
    println!("\nRun 'migrate apply' to execute these migrations.");
    
    Ok(())
}
```

## Validation Behavior

### What Gets Validated

The dry-run mode validates SQL syntax using SQLite's `EXPLAIN` statement. This checks:

- SQL syntax correctness
- Table and column references (if tables exist)
- SQL statement structure

### What Doesn't Get Validated

The dry-run mode does NOT validate:

- Data integrity constraints (these are checked at execution time)
- Foreign key relationships (unless tables already exist)
- Runtime errors (e.g., duplicate key violations)
- PRAGMA statements (these are skipped during validation)

### Special Cases

**PRAGMA Statements:**
PRAGMA statements cannot be validated with EXPLAIN, so they are skipped during validation. The dry-run will still report the migration as valid if other statements are valid.

**Already-Applied Migrations:**
The dry-run automatically skips migrations that have already been applied (idempotency check).

**Empty Migrations:**
Migrations with only comments or whitespace are considered valid.

## Integration with Existing Workflow

### Before Running Migrations

```bash
# 1. Backup database
./scripts/db_snapshot.sh

# 2. Dry-run to preview changes
cargo run --bin migration-dry-run -- ~/.kiyya/app.db

# 3. If all valid, run migrations
cargo run --bin migrate -- ~/.kiyya/app.db
```

### In CI/CD Pipeline

```yaml
- name: Validate pending migrations
  run: |
    cargo test --test migrations_dry_run_test
    cargo run --bin migration-dry-run -- test.db
```

### In Development

```rust
#[cfg(debug_assertions)]
{
    // In debug mode, always dry-run first
    let plans = runner.run_migrations_dry_run(&conn)?;
    for plan in &plans {
        println!("Will apply: {} - {}", plan.version, plan.description);
    }
}

runner.run_migrations(&conn)?;
```

## Testing

The dry-run functionality is tested in `src-tauri/src/migrations_dry_run_test.rs`:

```bash
# Run dry-run tests
cargo test --test migrations_dry_run_test

# Run specific test
cargo test test_dry_run_validates_valid_sql
```

## Troubleshooting

### "Dry-run failed: Failed to prepare migration history query"

**Cause:** Migrations table doesn't exist or has wrong schema.

**Solution:** The dry-run automatically creates the migrations table. If this error occurs, check database permissions.

### "SQL error: near 'X': syntax error"

**Cause:** Invalid SQL syntax in migration.

**Solution:** Review the migration SQL and fix syntax errors before applying.

### "Validation: PASSED but migration fails"

**Cause:** Validation only checks syntax, not runtime constraints.

**Solution:** This is expected. Dry-run validates syntax only. Runtime errors (like constraint violations) are caught during actual execution.

## Best Practices

1. **Always dry-run before applying migrations in production**
   ```rust
   let plans = runner.run_migrations_dry_run(&conn)?;
   // Review plans before proceeding
   runner.run_migrations(&conn)?;
   ```

2. **Log dry-run results for audit trail**
   ```rust
   let plans = runner.run_migrations_dry_run(&conn)?;
   for plan in &plans {
       info!("Pending migration: {} - {}", plan.version, plan.description);
   }
   ```

3. **Use dry-run in tests to verify migration structure**
   ```rust
   #[test]
   fn test_all_migrations_are_valid() {
       let conn = create_test_db();
       let runner = MigrationRunner::new();
       let plans = runner.run_migrations_dry_run(&conn).unwrap();
       
       for plan in plans {
           assert!(matches!(plan.validation_result, ValidationResult::Valid));
       }
   }
   ```

4. **Combine with backup for safety**
   ```bash
   ./scripts/db_snapshot.sh && cargo run --bin migration-dry-run
   ```

## Related Documentation

- [Database Migrations](./DECISIONS.md#database-migrations)
- [Migration Idempotency](./PHASE2_GATE_VERIFICATION.md#migration-idempotency)
- [Backup and Restore](./TASK_6.1_BACKUP_VERIFICATION_COMPLETE.md)
