# Makefile Usage Guide

This project includes build automation through both a traditional `Makefile` (for Unix/Linux/macOS) and a PowerShell script `make.ps1` (for Windows).

## Platform-Specific Usage

### Windows (PowerShell)
```powershell
.\make.ps1 <target>
```

### Unix/Linux/macOS (Make)
```bash
make <target>
```

**Note:** On Windows, `make` is not installed by default. Use the PowerShell script `make.ps1` instead.

## Available Targets

### Help
Display all available targets and their descriptions:
```bash
make help          # Unix/Linux/macOS
.\make.ps1 help    # Windows
```

### Build Targets

#### build-backend
Build the Rust backend using Cargo:
```bash
make build-backend
.\make.ps1 build-backend
```

#### build-frontend
Build the frontend using npm:
```bash
make build-frontend
.\make.ps1 build-frontend
```

#### build
Build both backend and frontend:
```bash
make build
.\make.ps1 build
```

### Test Targets

#### test
Run all tests (backend tests + frontend lint):
```bash
make test
.\make.ps1 test
```

### Clean Target

#### clean
Clean all build artifacts (cargo clean, remove node_modules and dist):
```bash
make clean
.\make.ps1 clean
```

### Audit Target

#### audit
Generate a comprehensive audit report using the automated audit script:
```bash
make audit
.\make.ps1 audit
```

This will:
- Capture compiler warnings
- Run clippy analysis
- Identify Tauri commands
- Generate structured JSON report

### Snapshot Target

#### snapshot
Create a database backup with checksum verification:
```bash
make snapshot
.\make.ps1 snapshot
```

This will:
- Create a timestamped backup in the `backups/` directory
- Generate backup metadata with SHA256 checksum
- Support platform-specific default DB paths
- Allow DB path override via `DB_PATH` environment variable

### Format Targets

#### format
Format all code (Rust + JavaScript/TypeScript):
```bash
make format
.\make.ps1 format
```

This will:
- Run `cargo fmt` on Rust code
- Run Prettier on frontend code

#### check-format
Check code formatting without making changes:
```bash
make check-format
.\make.ps1 check-format
```

This will:
- Check Rust formatting with `cargo fmt -- --check`
- Check frontend formatting with Prettier

### Coverage Target

#### coverage
Measure test coverage using cargo-tarpaulin:
```bash
make coverage
.\make.ps1 coverage
```

This will:
- Install cargo-tarpaulin if not already installed
- Run coverage measurement
- Generate HTML and XML reports in `stabilization/` directory

### Security Audit Target

#### security-audit
Run security audit to check for vulnerable dependencies:
```bash
make security-audit
.\make.ps1 security-audit
```

This will:
- Run `cargo audit` to check for known vulnerabilities
- Report any security issues found

### IPC Smoke Test Target

#### ipc-smoke
Run the IPC smoke test to verify Tauri connectivity:
```bash
make ipc-smoke
.\make.ps1 ipc-smoke
```

This will:
- Run the IPC smoke test script
- Verify backend-frontend communication
- Test the `test_connection` command

### Workflow Validation Target

#### validate-workflow
Validate the GitHub Actions workflow syntax:
```bash
make validate-workflow
.\make.ps1 validate-workflow
```

This will:
- Validate the stabilization workflow YAML
- Check for syntax errors
- Verify required steps and jobs

## Examples

### Complete Build and Test Workflow
```bash
# Clean previous builds
make clean

# Build everything
make build

# Run tests
make test

# Check code formatting
make check-format

# Run security audit
make security-audit
```

### Pre-Commit Workflow
```bash
# Format code
make format

# Run tests
make test

# Run IPC smoke test
make ipc-smoke
```

### Audit and Coverage Workflow
```bash
# Generate audit report
make audit

# Measure test coverage
make coverage

# Create database snapshot
make snapshot
```

## Environment Variables

### DB_PATH
Override the default database path for snapshot operations:
```bash
# Unix/Linux/macOS
DB_PATH=/custom/path/to/app.db make snapshot

# Windows
$env:DB_PATH="C:\custom\path\to\app.db"; .\make.ps1 snapshot
```

## Troubleshooting

### Windows: "make: command not found"
Use the PowerShell script instead:
```powershell
.\make.ps1 <target>
```

### Permission Denied (Unix/Linux/macOS)
Make sure scripts are executable:
```bash
chmod +x scripts/*.sh
```

### cargo-tarpaulin Installation Fails
The coverage target will attempt to install cargo-tarpaulin automatically. If it fails:
```bash
cargo install cargo-tarpaulin
```

### Node.js Scripts Not Found
Ensure you have run `npm install` first:
```bash
npm install
```

## Integration with CI/CD

These Makefile targets are designed to work seamlessly with the GitHub Actions workflow defined in `.github/workflows/stabilization.yml`. The CI pipeline uses these same commands to ensure consistency between local development and CI environments.

## Requirements

- **Rust**: cargo, rustc, rustfmt, clippy
- **Node.js**: npm, node
- **PowerShell** (Windows): Version 5.1 or higher
- **Make** (Unix/Linux/macOS): GNU Make or compatible

## Related Documentation

- [CI Workflow Documentation](stabilization/CI_WORKFLOW.md)
- [Contributing Guidelines](CONTRIBUTING.md)
- [Phase 0 Infrastructure Setup](.kiro/specs/codebase-stabilization-audit/tasks.md)
